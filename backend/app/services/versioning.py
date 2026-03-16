import json
import zipfile
from io import BytesIO

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db_session
from app.models.dataset_version import DatasetVersion
from app.models.image_dataset import ImageDataset
from app.models.image_record import ImageRecord
from app.services.label_tool_client import LabelToolClient
from app.services.s3_service import S3Service


def extract_annotations_from_zip(zip_bytes: bytes, format: str) -> dict:
    with zipfile.ZipFile(BytesIO(zip_bytes)) as zf:
        for name in zf.namelist():
            if name.endswith(".json"):
                return json.loads(zf.read(name))
    return {"images": [], "annotations": [], "categories": []}


def compute_label_distribution(annotations_json: dict) -> dict:
    categories = {c["id"]: c["name"] for c in annotations_json.get("categories", [])}
    distribution: dict[str, int] = {}
    for ann in annotations_json.get("annotations", []):
        cat_name = categories.get(ann.get("category_id"), "unknown")
        distribution[cat_name] = distribution.get(cat_name, 0) + 1
    return distribution


def count_annotations(annotations_json: dict) -> int:
    return len(annotations_json.get("annotations", []))


async def build_version(version_id: str) -> None:
    async with get_db_session() as db:
        version = await db.get(DatasetVersion, version_id)
        if not version:
            return

        dataset = await db.get(ImageDataset, version.dataset_id)
        if not dataset:
            version.status = "failed"
            await db.commit()
            return

        try:
            s3_service = S3Service()

            # 1. Build image manifest from processed records
            result = await db.execute(
                select(ImageRecord)
                .where(ImageRecord.dataset_id == dataset.id)
                .where(ImageRecord.status == "processed")
            )
            images = result.scalars().all()

            manifest = {
                "version": version.version_number,
                "dataset_id": dataset.id,
                "dataset_name": dataset.name,
                "created_at": version.created_at.isoformat(),
                "created_by": version.created_by,
                "image_count": len(images),
                "images": [
                    {
                        "id": str(img.id),
                        "s3_key": img.s3_key,
                        "filename": img.filename,
                        "width": img.width,
                        "height": img.height,
                        "size_bytes": img.size_bytes,
                        "format": img.format,
                        "content_hash": img.content_hash,
                    }
                    for img in images
                ],
            }

            # 2. Export annotations from Label Tool (if labeling project exists)
            annotations_json: dict = {
                "images": [],
                "annotations": [],
                "categories": [],
            }
            if dataset.annotation_project_id:
                try:
                    label_client = LabelToolClient()
                    annotations_zip = await label_client.export_annotations(
                        dataset.annotation_project_id,
                        format=version.annotation_format,
                    )
                    annotations_json = extract_annotations_from_zip(
                        annotations_zip, version.annotation_format
                    )
                    await label_client.close()
                except Exception:
                    pass  # Label Tool may not be available; version still valid without annotations

            # 3. Compute label distribution
            label_dist = compute_label_distribution(annotations_json)

            # 4. Build meta.json
            total_size = sum(img.size_bytes or 0 for img in images)
            meta = {
                "version_number": version.version_number,
                "dataset_id": dataset.id,
                "dataset_name": dataset.name,
                "created_at": version.created_at.isoformat(),
                "image_count": len(images),
                "annotation_count": count_annotations(annotations_json),
                "annotation_format": version.annotation_format,
                "label_distribution": label_dist,
                "label_config": dataset.label_config,
                "preprocessing_config": dataset.preprocessing_config,
                "total_size_bytes": total_size,
            }

            # 5. Upload all three files to S3
            s3_service.put_json(version.s3_manifest_key, manifest)
            s3_service.put_json(version.s3_annotations_key, annotations_json)
            s3_service.put_json(version.s3_meta_key, meta)

            # 6. Update version record
            version.status = "completed"
            version.image_count = len(images)
            version.annotation_count = meta["annotation_count"]
            version.total_size_bytes = total_size
            version.label_distribution = label_dist
            await db.commit()

        except Exception:
            version.status = "failed"
            await db.commit()
            raise
