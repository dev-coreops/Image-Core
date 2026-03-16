from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.image_dataset import ImageDataset
from app.models.image_record import ImageRecord
from app.schemas.image import (
    ImageOut,
    PresignedUploadRequest,
    PresignedUploadResponse,
    PresignedUploadItem,
    RegisterImagesRequest,
    RegisterImagesResponse,
)
from app.schemas.pagination import CursorPage
from app.services.s3_service import S3Service

router = APIRouter()


@router.post(
    "/datasets/{dataset_id}/presign-upload",
    response_model=PresignedUploadResponse,
)
async def presign_upload(
    dataset_id: str,
    body: PresignedUploadRequest,
    db: AsyncSession = Depends(get_db),
):
    dataset = await db.get(ImageDataset, dataset_id)
    if not dataset:
        raise HTTPException(404, "Dataset not found")

    s3_service = S3Service()
    uploads = []

    for file_req in body.files:
        s3_key = f"{dataset.s3_prefix}raw/{file_req.filename}"
        presigned_url = s3_service.generate_presigned_put(
            s3_key, file_req.content_type
        )
        uploads.append(
            PresignedUploadItem(
                filename=file_req.filename,
                s3_key=s3_key,
                presigned_url=presigned_url,
            )
        )

    return PresignedUploadResponse(uploads=uploads)


@router.post(
    "/datasets/{dataset_id}/register-images",
    response_model=RegisterImagesResponse,
    status_code=201,
)
async def register_images(
    dataset_id: str,
    body: RegisterImagesRequest,
    db: AsyncSession = Depends(get_db),
):
    dataset = await db.get(ImageDataset, dataset_id)
    if not dataset:
        raise HTTPException(404, "Dataset not found")

    content_type_to_format = {
        "image/jpeg": "jpeg",
        "image/png": "png",
        "image/webp": "webp",
        "image/bmp": "bmp",
        "image/tiff": "tiff",
    }

    for img in body.images:
        record = ImageRecord(
            dataset_id=dataset_id,
            s3_key=img.s3_key,
            filename=img.filename,
            size_bytes=img.size_bytes,
            format=content_type_to_format.get(img.content_type),
            status="raw",
        )
        db.add(record)

    # Update dataset counters
    dataset.image_count += len(body.images)
    dataset.total_size_bytes += sum(img.size_bytes for img in body.images)
    if dataset.status == "created":
        dataset.status = "uploading"

    await db.commit()

    return RegisterImagesResponse(
        registered=len(body.images),
        dataset_image_count=dataset.image_count,
    )


@router.get("/datasets/{dataset_id}/images", response_model=CursorPage[ImageOut])
async def list_images(
    dataset_id: str,
    status: str | None = None,
    cursor: str | None = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
):
    dataset = await db.get(ImageDataset, dataset_id)
    if not dataset:
        raise HTTPException(404, "Dataset not found")

    query = select(ImageRecord).where(ImageRecord.dataset_id == dataset_id)

    if status:
        query = query.where(ImageRecord.status == status)

    if cursor:
        query = query.where(ImageRecord.id > cursor)

    query = query.order_by(ImageRecord.created_at.desc()).limit(limit + 1)

    result = await db.execute(query)
    images = list(result.scalars().all())

    next_cursor = None
    if len(images) > limit:
        next_cursor = images[limit - 1].id
        images = images[:limit]

    # Generate presigned URLs for viewing
    s3_service = S3Service()
    image_outs = []
    for img in images:
        img_out = ImageOut.model_validate(img)
        img_out.presigned_url = s3_service.generate_presigned_get(img.s3_key)
        image_outs.append(img_out)

    return CursorPage(items=image_outs, next_cursor=next_cursor)


@router.get(
    "/datasets/{dataset_id}/images/{image_id}",
    response_model=ImageOut,
)
async def get_image(
    dataset_id: str,
    image_id: str,
    db: AsyncSession = Depends(get_db),
):
    image = await db.get(ImageRecord, image_id)
    if not image or image.dataset_id != dataset_id:
        raise HTTPException(404, "Image not found")

    s3_service = S3Service()
    img_out = ImageOut.model_validate(image)
    img_out.presigned_url = s3_service.generate_presigned_get(image.s3_key)
    return img_out
