from datetime import datetime

from pydantic import BaseModel


class FileUploadRequest(BaseModel):
    filename: str
    content_type: str
    size_bytes: int


class PresignedUploadRequest(BaseModel):
    files: list[FileUploadRequest]


class PresignedUploadItem(BaseModel):
    filename: str
    s3_key: str
    presigned_url: str


class PresignedUploadResponse(BaseModel):
    uploads: list[PresignedUploadItem]


class RegisterImageItem(BaseModel):
    s3_key: str
    filename: str
    size_bytes: int
    content_type: str


class RegisterImagesRequest(BaseModel):
    images: list[RegisterImageItem]


class RegisterImagesResponse(BaseModel):
    registered: int
    dataset_image_count: int


class ImageOut(BaseModel):
    id: str
    dataset_id: str
    filename: str
    width: int | None
    height: int | None
    size_bytes: int | None
    format: str | None
    status: str
    exclusion_reason: str | None
    presigned_url: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
