from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user, get_organization_id, get_project_id
from app.core.config import settings
from app.core.database import get_db
from app.models.image_dataset import ImageDataset
from app.schemas.dataset import DatasetCreate, DatasetOut, DatasetUpdate
from app.schemas.pagination import CursorPage
from app.services.s3_service import S3Service

router = APIRouter()


@router.post("/datasets", response_model=DatasetOut, status_code=201)
async def create_dataset(
    body: DatasetCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user_id = get_current_user(request)
    org_id = get_organization_id(request)
    project_id = get_project_id(request)

    dataset = ImageDataset(
        organization_id=org_id,
        project_id=project_id,
        name=body.name,
        description=body.description,
        source_type=body.source_type,
        s3_bucket=settings.S3_BUCKET_NAME,
        s3_prefix="",  # Will be set after ID is generated
        label_config=[lc.model_dump() for lc in body.label_config],
        created_by=user_id,
    )
    db.add(dataset)
    await db.flush()

    # Set s3_prefix now that we have the ID
    dataset.s3_prefix = f"datasets/{dataset.id}/"
    await db.commit()
    await db.refresh(dataset)

    return dataset


@router.get("/datasets", response_model=CursorPage[DatasetOut])
async def list_datasets(
    request: Request,
    status: str | None = None,
    cursor: str | None = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    org_id = get_organization_id(request)
    project_id = get_project_id(request)

    query = select(ImageDataset).where(
        ImageDataset.organization_id == org_id,
        ImageDataset.project_id == project_id,
    )

    if status:
        query = query.where(ImageDataset.status == status)

    if cursor:
        query = query.where(ImageDataset.id > cursor)

    query = query.order_by(ImageDataset.created_at.desc()).limit(limit + 1)

    result = await db.execute(query)
    datasets = list(result.scalars().all())

    next_cursor = None
    if len(datasets) > limit:
        next_cursor = datasets[limit].id
        datasets = datasets[:limit]

    # Get total count
    count_query = select(func.count(ImageDataset.id)).where(
        ImageDataset.organization_id == org_id,
        ImageDataset.project_id == project_id,
    )
    if status:
        count_query = count_query.where(ImageDataset.status == status)
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    return CursorPage(items=datasets, next_cursor=next_cursor, total=total)


@router.get("/datasets/{dataset_id}", response_model=DatasetOut)
async def get_dataset(
    dataset_id: str,
    db: AsyncSession = Depends(get_db),
):
    dataset = await db.get(ImageDataset, dataset_id)
    if not dataset:
        raise HTTPException(404, "Dataset not found")
    return dataset


@router.patch("/datasets/{dataset_id}", response_model=DatasetOut)
async def update_dataset(
    dataset_id: str,
    body: DatasetUpdate,
    db: AsyncSession = Depends(get_db),
):
    dataset = await db.get(ImageDataset, dataset_id)
    if not dataset:
        raise HTTPException(404, "Dataset not found")

    if body.name is not None:
        dataset.name = body.name
    if body.description is not None:
        dataset.description = body.description
    if body.status is not None:
        allowed_statuses = {"created", "uploading", "uploaded", "preprocessing", "preprocessed", "labeling", "completed"}
        if body.status not in allowed_statuses:
            raise HTTPException(400, f"Invalid status: {body.status}")
        dataset.status = body.status
    if body.label_config is not None:
        dataset.label_config = [lc.model_dump() for lc in body.label_config]

    await db.commit()
    await db.refresh(dataset)
    return dataset


@router.delete("/datasets/{dataset_id}", status_code=204)
async def delete_dataset(
    dataset_id: str,
    db: AsyncSession = Depends(get_db),
):
    dataset = await db.get(ImageDataset, dataset_id)
    if not dataset:
        raise HTTPException(404, "Dataset not found")

    # Delete S3 objects
    s3_service = S3Service()
    s3_service.delete_prefix(dataset.s3_prefix)

    await db.delete(dataset)
    await db.commit()
