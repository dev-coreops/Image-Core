from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models.image_dataset import ImageDataset
from app.models.image_record import ImageRecord
from app.models.preprocessing_job import PreprocessingJob
from app.schemas.preprocessing import (
    PreprocessDispatchResponse,
    PreprocessJobOut,
    PreprocessRequest,
    WebhookUpdate,
)
from app.services.preprocessing import dispatch_preprocessing

router = APIRouter()


@router.post(
    "/datasets/{dataset_id}/preprocess",
    response_model=PreprocessDispatchResponse,
    status_code=201,
)
async def start_preprocessing(
    dataset_id: str,
    body: PreprocessRequest,
    db: AsyncSession = Depends(get_db),
):
    dataset = await db.get(ImageDataset, dataset_id)
    if not dataset:
        raise HTTPException(404, "Dataset not found")

    if dataset.status not in ("uploaded", "uploading", "created"):
        raise HTTPException(400, f"Cannot preprocess dataset in '{dataset.status}' status")

    job = await dispatch_preprocessing(
        db=db,
        dataset=dataset,
        vm_ip=body.vm_ip,
        vm_instance_id=body.vm_instance_id,
        config=body.config.model_dump(),
    )

    return PreprocessDispatchResponse(
        job_id=job.id,
        status=job.status,
        webhook_token=job.webhook_token,
        dataset_id=dataset.id,
        vm_ip=body.vm_ip,
    )


@router.get(
    "/datasets/{dataset_id}/preprocess/latest",
    response_model=PreprocessJobOut,
)
async def get_latest_job(
    dataset_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PreprocessingJob)
        .where(PreprocessingJob.dataset_id == dataset_id)
        .order_by(PreprocessingJob.created_at.desc())
        .limit(1)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "No preprocessing job found")
    return job


@router.get(
    "/datasets/{dataset_id}/preprocess/{job_id}",
    response_model=PreprocessJobOut,
)
async def get_job(
    dataset_id: str,
    job_id: str,
    db: AsyncSession = Depends(get_db),
):
    job = await db.get(PreprocessingJob, job_id)
    if not job or job.dataset_id != dataset_id:
        raise HTTPException(404, "Preprocessing job not found")
    return job


@router.post("/webhooks/preprocess-update")
async def preprocess_webhook(
    body: WebhookUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    # Authenticate via webhook token
    token = body.webhook_token
    result = await db.execute(
        select(PreprocessingJob).where(PreprocessingJob.webhook_token == token)
    )
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(401, "Invalid webhook token")

    # Update status
    if body.status in ("running", "completed", "failed"):
        job.status = body.status
        if body.status == "running" and not job.started_at:
            job.started_at = datetime.now(timezone.utc)
        elif body.status in ("completed", "failed"):
            job.completed_at = datetime.now(timezone.utc)

    # Update progress
    if body.progress is not None:
        job.progress = min(100, max(0, body.progress))

    # Append logs
    if body.logs:
        job.logs = (job.logs or "") + "\n" + body.logs

    # Update stats
    if body.images_processed is not None:
        job.images_processed = body.images_processed
    if body.images_excluded is not None:
        job.images_excluded = body.images_excluded
    if body.exclusion_summary is not None:
        job.exclusion_summary = body.exclusion_summary
    if body.resource_usage is not None:
        job.resource_usage = body.resource_usage
    if body.error:
        job.error_message = body.error

    # On completion: update image_records and dataset
    if body.status == "completed" and body.result:
        await _process_completion(db, job, body.result)

    await db.commit()
    return {"message": "Update received", "job_id": job.id, "status": job.status}


async def _process_completion(
    db: AsyncSession, job: PreprocessingJob, result: dict
) -> None:
    dataset = await db.get(ImageDataset, job.dataset_id)
    if not dataset:
        return

    # Delete raw image records (replaced by processed ones)
    raw_stmt = select(ImageRecord).where(
        ImageRecord.dataset_id == job.dataset_id,
        ImageRecord.status == "raw",
    )
    raw_result = await db.execute(raw_stmt)
    for record in raw_result.scalars().all():
        await db.delete(record)

    # Create image_records for processed images
    for img in result.get("image_manifest", []):
        record = ImageRecord(
            dataset_id=job.dataset_id,
            s3_key=img["s3_key"],
            filename=img["filename"],
            width=img.get("width"),
            height=img.get("height"),
            size_bytes=img.get("size_bytes"),
            format=img.get("format"),
            content_hash=img.get("content_hash"),
            perceptual_hash=img.get("perceptual_hash"),
            status="processed",
        )
        db.add(record)

    # Update dataset stats
    dataset.image_count = len(result.get("image_manifest", []))
    dataset.total_size_bytes = sum(
        img.get("size_bytes", 0) for img in result.get("image_manifest", [])
    )
    dataset.status = "preprocessed"
    dataset.preprocessing_config = job.config
