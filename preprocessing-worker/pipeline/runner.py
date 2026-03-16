import tempfile

from pipeline import validator, normalizer, deduplicator, augmentor
from s3_client import S3Client
from webhook import WebhookReporter


async def run_pipeline(
    job_id: str,
    s3_bucket: str,
    s3_input_prefix: str,
    s3_output_prefix: str,
    config: dict,
    webhook_url: str,
    webhook_token: str,
    s3_endpoint_url: str | None = None,
    s3_access_key: str | None = None,
    s3_secret_key: str | None = None,
) -> None:
    webhook = WebhookReporter(webhook_url, webhook_token)
    s3 = S3Client(
        endpoint_url=s3_endpoint_url,
        access_key=s3_access_key,
        secret_key=s3_secret_key,
    )

    try:
        await webhook.report(status="running", progress=0, logs="Starting pipeline...")

        with tempfile.TemporaryDirectory() as tmpdir:
            # 1. Download raw images from S3
            raw_images = s3.download_prefix(s3_bucket, s3_input_prefix, tmpdir)
            total = len(raw_images)
            await webhook.report(
                progress=5, logs=f"Downloaded {total} images from S3"
            )

            # 2. Validate (compulsory)
            valid, excluded_validation = validator.validate(
                raw_images, config.get("validation", {})
            )
            await webhook.report(
                progress=25,
                logs=f"Validation: {len(valid)} valid, {len(excluded_validation)} excluded",
                images_processed=len(valid),
                images_excluded=len(excluded_validation),
            )

            # 3. Normalize (compulsory)
            normalized = normalizer.normalize(valid, config.get("normalization", {}))
            await webhook.report(
                progress=45, logs=f"Normalized {len(normalized)} images"
            )

            # 4. Deduplicate (optional)
            dedup_config = config.get("deduplication", {})
            if dedup_config.get("enabled", False):
                deduped, excluded_dupes = deduplicator.deduplicate(
                    normalized, dedup_config
                )
                await webhook.report(
                    progress=65,
                    logs=f"Dedup: kept {len(deduped)}, removed {len(excluded_dupes)} duplicates",
                    images_excluded=len(excluded_validation) + len(excluded_dupes),
                )
            else:
                deduped = normalized
                excluded_dupes = []

            # 5. Augment (optional)
            aug_config = config.get("augmentation", {})
            if aug_config.get("enabled", False):
                augmented = augmentor.augment(deduped, aug_config)
                final_images = deduped + augmented
                await webhook.report(
                    progress=80,
                    logs=f"Augmented: {len(augmented)} new images generated",
                )
            else:
                final_images = deduped

            # 6. Upload processed images to S3
            image_manifest = s3.upload_images(s3_bucket, s3_output_prefix, final_images)
            await webhook.report(
                progress=95, logs=f"Uploaded {len(final_images)} images to S3"
            )

            # 7. Build exclusion summary
            all_excluded = excluded_validation + excluded_dupes
            exclusion_summary: dict[str, int] = {}
            for item in all_excluded:
                reason = item["reason"].split(":")[0]
                exclusion_summary[reason] = exclusion_summary.get(reason, 0) + 1

            # 8. Report completion
            await webhook.report(
                status="completed",
                progress=100,
                logs="Pipeline complete.",
                images_processed=len(final_images),
                images_excluded=len(all_excluded),
                exclusion_summary=exclusion_summary,
                result={
                    "output_s3_prefix": s3_output_prefix,
                    "image_manifest": image_manifest,
                },
            )
    except Exception as e:
        await webhook.report(
            status="failed",
            error=str(e),
            logs=f"Pipeline failed: {e}",
        )
    finally:
        await webhook.close()
