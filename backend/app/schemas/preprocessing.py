from datetime import datetime

from pydantic import BaseModel, Field


class ValidationConfig(BaseModel):
    min_width: int = 32
    min_height: int = 32
    max_file_size_mb: int = 50
    allowed_formats: list[str] = Field(
        default_factory=lambda: ["jpeg", "png", "webp", "bmp", "tiff"]
    )


class NormalizationConfig(BaseModel):
    target_format: str = "jpeg"
    target_quality: int = 95
    fix_orientation: bool = True
    convert_rgb: bool = True
    max_dimension: int | None = None


class DeduplicationConfig(BaseModel):
    enabled: bool = True
    method: str = "phash"
    hash_size: int = 16
    threshold: int = 8


class AugmentationOperation(BaseModel):
    type: str
    probability: float = 0.5
    limit: int | None = None
    brightness_limit: float | None = None


class AugmentationConfig(BaseModel):
    enabled: bool = False
    operations: list[AugmentationOperation] = Field(default_factory=list)
    augmentations_per_image: int = 2


class PreprocessConfig(BaseModel):
    validation: ValidationConfig = Field(default_factory=ValidationConfig)
    normalization: NormalizationConfig = Field(default_factory=NormalizationConfig)
    deduplication: DeduplicationConfig = Field(default_factory=DeduplicationConfig)
    augmentation: AugmentationConfig = Field(default_factory=AugmentationConfig)


class PreprocessRequest(BaseModel):
    vm_ip: str
    vm_instance_id: str | None = None
    config: PreprocessConfig


class PreprocessJobOut(BaseModel):
    id: str
    dataset_id: str
    status: str
    progress: int
    vm_ip: str | None
    images_total: int
    images_processed: int
    images_excluded: int
    exclusion_summary: dict | None
    logs: str | None
    error_message: str | None
    resource_usage: dict | None
    started_at: datetime | None
    completed_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class PreprocessDispatchResponse(BaseModel):
    job_id: str
    status: str
    webhook_token: str
    dataset_id: str
    vm_ip: str


class WebhookUpdate(BaseModel):
    webhook_token: str
    status: str | None = None
    progress: int | None = None
    logs: str | None = None
    images_processed: int | None = None
    images_excluded: int | None = None
    exclusion_summary: dict | None = None
    result: dict | None = None
    error: str | None = None
    resource_usage: dict | None = None
