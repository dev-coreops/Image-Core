from datetime import datetime

from pydantic import BaseModel, Field


class LabelClassConfig(BaseModel):
    name: str
    color: str


class DatasetCreate(BaseModel):
    name: str = Field(..., max_length=255)
    description: str | None = None
    source_type: str = "upload"
    label_config: list[LabelClassConfig] = Field(default_factory=list)


class DatasetUpdate(BaseModel):
    name: str | None = Field(None, max_length=255)
    description: str | None = None
    status: str | None = None
    label_config: list[LabelClassConfig] | None = None


class DatasetOut(BaseModel):
    id: str
    organization_id: str
    project_id: str
    name: str
    description: str | None
    source_type: str
    s3_bucket: str
    s3_prefix: str
    image_count: int
    total_size_bytes: int
    status: str
    label_config: list[LabelClassConfig]
    preprocessing_config: dict | None
    annotation_project_id: str | None
    created_by: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
