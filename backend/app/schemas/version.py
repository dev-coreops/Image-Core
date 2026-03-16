from datetime import datetime

from pydantic import BaseModel


class VersionCreate(BaseModel):
    name: str | None = None
    description: str | None = None
    annotation_format: str = "coco"


class VersionOut(BaseModel):
    id: str
    dataset_id: str
    version_number: int
    name: str | None
    description: str | None
    status: str
    image_count: int | None
    annotation_count: int | None
    total_size_bytes: int | None
    label_distribution: dict | None
    annotation_format: str
    s3_manifest_key: str | None
    s3_annotations_key: str | None
    s3_meta_key: str | None
    preprocessing_config: dict | None
    label_config: dict | None
    created_by: str
    created_at: datetime

    model_config = {"from_attributes": True}


class VersionCreateResponse(BaseModel):
    version_id: str
    version_number: int
    status: str
