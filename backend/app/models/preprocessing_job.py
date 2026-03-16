import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class PreprocessingJob(Base):
    __tablename__ = "preprocessing_jobs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    dataset_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("image_datasets.id", ondelete="CASCADE"), nullable=False
    )
    vm_instance_id: Mapped[str | None] = mapped_column(String(255))
    vm_ip: Mapped[str | None] = mapped_column(String(255))
    config: Mapped[dict] = mapped_column(JSONB, nullable=False)
    status: Mapped[str] = mapped_column(String(30), default="pending")
    progress: Mapped[int] = mapped_column(Integer, default=0)
    webhook_token: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    images_total: Mapped[int] = mapped_column(Integer, default=0)
    images_processed: Mapped[int] = mapped_column(Integer, default=0)
    images_excluded: Mapped[int] = mapped_column(Integer, default=0)
    exclusion_summary: Mapped[dict | None] = mapped_column(JSONB, default=dict)
    logs: Mapped[str | None] = mapped_column(Text)
    error_message: Mapped[str | None] = mapped_column(Text)
    resource_usage: Mapped[dict | None] = mapped_column(JSONB, default=dict)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    dataset = relationship("ImageDataset", back_populates="preprocessing_jobs")

    __table_args__ = (
        Index("idx_preprocess_dataset", "dataset_id"),
        Index("idx_preprocess_status", "status"),
    )
