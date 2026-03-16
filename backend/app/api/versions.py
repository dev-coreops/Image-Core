from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.config import settings
from app.core.database import get_db
from app.models.dataset_version import DatasetVersion
from app.models.image_dataset import ImageDataset
from app.schemas.pagination import CursorPage
from app.schemas.version import VersionCreate, VersionCreateResponse, VersionOut
from app.services.s3_service import S3Service
from app.services.versioning import build_version
from app.services.label_tool_client import LabelToolClient
from app.models.image_record import ImageRecord

router = APIRouter()


@router.post(
    "/datasets/{dataset_id}/versions",
    response_model=VersionCreateResponse,
    status_code=202,
)
async def create_version(
    dataset_id: str,
    body: VersionCreate,
    background_tasks: BackgroundTasks,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    dataset = await db.get(ImageDataset, dataset_id)
    if not dataset:
        raise HTTPException(404, "Dataset not found")

    user_id = get_current_user(request)

    # Auto-increment version number
    latest = await db.execute(
        select(func.max(DatasetVersion.version_number)).where(
            DatasetVersion.dataset_id == dataset_id
        )
    )
    next_version = (latest.scalar() or 0) + 1

    version = DatasetVersion(
        dataset_id=dataset_id,
        version_number=next_version,
        name=body.name or f"v{next_version}",
        description=body.description,
        status="processing",
        annotation_format=body.annotation_format,
        s3_manifest_key=f"datasets/{dataset_id}/versions/v{next_version}/manifest.json",
        s3_annotations_key=f"datasets/{dataset_id}/versions/v{next_version}/annotations.json",
        s3_meta_key=f"datasets/{dataset_id}/versions/v{next_version}/meta.json",
        preprocessing_config=dataset.preprocessing_config,
        label_config=dataset.label_config,
        created_by=user_id,
    )
    db.add(version)
    await db.commit()
    await db.refresh(version)

    # Build version in background
    background_tasks.add_task(build_version, version.id)

    return VersionCreateResponse(
        version_id=version.id,
        version_number=next_version,
        status="processing",
    )


@router.get(
    "/datasets/{dataset_id}/versions",
    response_model=CursorPage[VersionOut],
)
async def list_versions(
    dataset_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DatasetVersion)
        .where(DatasetVersion.dataset_id == dataset_id)
        .order_by(DatasetVersion.version_number.desc())
    )
    versions = list(result.scalars().all())
    return CursorPage(items=versions, total=len(versions))


@router.get(
    "/datasets/{dataset_id}/versions/{version_id}",
    response_model=VersionOut,
)
async def get_version(
    dataset_id: str,
    version_id: str,
    db: AsyncSession = Depends(get_db),
):
    version = await db.get(DatasetVersion, version_id)
    if not version or version.dataset_id != dataset_id:
        raise HTTPException(404, "Version not found")
    return version


@router.get("/datasets/{dataset_id}/versions/{version_id}/manifest")
async def get_manifest(
    dataset_id: str,
    version_id: str,
    db: AsyncSession = Depends(get_db),
):
    version = await db.get(DatasetVersion, version_id)
    if not version or version.dataset_id != dataset_id:
        raise HTTPException(404, "Version not found")
    if not version.s3_manifest_key:
        raise HTTPException(404, "Manifest not available")

    s3_service = S3Service()
    url = s3_service.generate_presigned_get(version.s3_manifest_key)
    return RedirectResponse(url=url)


@router.get("/datasets/{dataset_id}/versions/{version_id}/annotations")
async def get_annotations(
    dataset_id: str,
    version_id: str,
    db: AsyncSession = Depends(get_db),
):
    version = await db.get(DatasetVersion, version_id)
    if not version or version.dataset_id != dataset_id:
        raise HTTPException(404, "Version not found")
    if not version.s3_annotations_key:
        raise HTTPException(404, "Annotations not available")

    s3_service = S3Service()
    url = s3_service.generate_presigned_get(version.s3_annotations_key)
    return RedirectResponse(url=url)


# --- Labeling endpoints ---


@router.post("/datasets/{dataset_id}/start-labeling")
async def start_labeling(
    dataset_id: str,
    db: AsyncSession = Depends(get_db),
):
    dataset = await db.get(ImageDataset, dataset_id)
    if not dataset:
        raise HTTPException(404, "Dataset not found")
    if dataset.status not in ("preprocessed", "completed"):
        raise HTTPException(400, "Dataset must be preprocessed before labeling")

    label_client = LabelToolClient()

    # 1. Create project in Label Tool
    project = await label_client.create_project(
        name=f"[ImageData] {dataset.name}",
        label_config=dataset.label_config,
    )

    # 2. Get processed images
    result = await db.execute(
        select(ImageRecord)
        .where(ImageRecord.dataset_id == dataset_id)
        .where(ImageRecord.status == "processed")
    )
    images = result.scalars().all()

    # 3. Create tasks in Label Tool
    image_data = [
        {
            "s3_key": img.s3_key,
            "width": img.width,
            "height": img.height,
            "filename": img.filename,
        }
        for img in images
    ]
    await label_client.create_tasks(project["id"], image_data)

    # 4. Update dataset
    dataset.annotation_project_id = project["id"]
    dataset.status = "labeling"
    await db.commit()

    await label_client.close()

    return {
        "annotation_project_id": project["id"],
        "label_tool_url": f"{settings.LABEL_TOOL_BASE_URL}/projects/{project['id']}",
    }


@router.get("/datasets/{dataset_id}/labeling-progress")
async def labeling_progress(
    dataset_id: str,
    db: AsyncSession = Depends(get_db),
):
    dataset = await db.get(ImageDataset, dataset_id)
    if not dataset:
        raise HTTPException(404, "Dataset not found")
    if not dataset.annotation_project_id:
        raise HTTPException(400, "Labeling has not been started")

    label_client = LabelToolClient()
    analytics = await label_client.get_analytics(dataset.annotation_project_id)
    await label_client.close()

    total_tasks = analytics.get("total_tasks", 0)
    completed_tasks = analytics.get("completed_tasks", 0)

    return {
        "annotation_project_id": dataset.annotation_project_id,
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "progress_percent": round(
            (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0, 1
        ),
        "label_tool_url": f"{settings.LABEL_TOOL_BASE_URL}/projects/{dataset.annotation_project_id}",
    }
