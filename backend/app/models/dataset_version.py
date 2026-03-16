import uuid
from datetime import datetime, timezone

from sqlalchemy import BigInteger, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class DatasetVersion(Base):
    __tablename__ = "dataset_versions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    dataset_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("image_datasets.id", ondelete="CASCADE"), nullable=False
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str | None] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), default="processing")
    image_count: Mapped[int | None] = mapped_column(Integer)
    annotation_count: Mapped[int | None] = mapped_column(Integer)
    total_size_bytes: Mapped[int | None] = mapped_column(BigInteger)
    label_distribution: Mapped[dict | None] = mapped_column(JSONB)
    annotation_format: Mapped[str] = mapped_column(String(30), default="coco")
    s3_manifest_key: Mapped[str | None] = mapped_column(String(500))
    s3_annotations_key: Mapped[str | None] = mapped_column(String(500))
    s3_meta_key: Mapped[str | None] = mapped_column(String(500))
    preprocessing_config: Mapped[dict | None] = mapped_column(JSONB)
    label_config: Mapped[dict | None] = mapped_column(JSONB)
    created_by: Mapped[str] = mapped_column(String(36), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    dataset = relationship("ImageDataset", back_populates="versions")

    __table_args__ = (
        Index(
            "idx_version_dataset_number",
            "dataset_id",
            "version_number",
            unique=True,
        ),
        Index("idx_version_dataset", "dataset_id"),
    )
