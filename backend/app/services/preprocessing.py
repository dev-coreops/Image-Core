import secrets

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.image_dataset import ImageDataset
from app.models.image_record import ImageRecord
from app.models.preprocessing_job import PreprocessingJob


def generate_webhook_token(job_id: str) -> str:
    return f"job_{job_id}_{secrets.token_urlsafe(32)}"


async def dispatch_preprocessing(
    db: AsyncSession,
    dataset: ImageDataset,
    vm_ip: str,
    vm_instance_id: str | None,
    config: dict,
) -> PreprocessingJob:
    # Count raw images
    result = await db.execute(
        select(ImageRecord)
        .where(ImageRecord.dataset_id == dataset.id)
        .where(ImageRecord.status == "raw")
    )
    raw_images = result.scalars().all()

    # Create job record
    job = PreprocessingJob(
        dataset_id=dataset.id,
        vm_ip=vm_ip,
        vm_instance_id=vm_instance_id,
        config=config,
        status="pending",
        webhook_token=generate_webhook_token(str(dataset.id)),
        images_total=len(raw_images),
    )
    db.add(job)
    await db.flush()

    # Build dispatch payload
    payload = {
        "job_id": job.id,
        "s3_bucket": dataset.s3_bucket,
        "s3_input_prefix": f"{dataset.s3_prefix}raw/",
        "s3_output_prefix": f"{dataset.s3_prefix}processed/",
        "config": config,
        "webhook_url": f"{settings.BACKEND_CALLBACK_URL}/api/v1/webhooks/preprocess-update",
        "webhook_token": job.webhook_token,
        "s3_endpoint_url": settings.S3_ENDPOINT_URL,
        "s3_access_key": settings.S3_ACCESS_KEY,
        "s3_secret_key": settings.S3_SECRET_KEY,
    }

    # Dispatch to worker instance
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"http://{vm_ip}:{settings.WORKER_PORT}/preprocess", json=payload
            )
            response.raise_for_status()
        job.status = "queued"
    except Exception as e:
        job.status = "failed"
        job.error_message = str(e)

    # Update dataset status
    dataset.status = "preprocessing"
    dataset.preprocessing_config = config
    await db.commit()

    return job
