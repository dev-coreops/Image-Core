import os
import tempfile
from pathlib import Path

import boto3
from botocore.config import Config as BotoConfig

from config import config


class S3Client:
    def __init__(self, endpoint_url: str | None = None, access_key: str | None = None, secret_key: str | None = None):
        self.client = boto3.client(
            "s3",
            endpoint_url=endpoint_url or config.S3_ENDPOINT_URL,
            aws_access_key_id=access_key or config.S3_ACCESS_KEY,
            aws_secret_access_key=secret_key or config.S3_SECRET_KEY,
            region_name=config.S3_REGION,
            config=BotoConfig(signature_version="s3v4"),
        )

    def download_prefix(self, bucket: str, prefix: str, local_dir: str) -> list[dict]:
        """Download all objects under a prefix to a local directory."""
        downloaded = []
        paginator = self.client.get_paginator("list_objects_v2")

        for page in paginator.paginate(Bucket=bucket, Prefix=prefix):
            for obj in page.get("Contents", []):
                key = obj["Key"]
                filename = os.path.basename(key)
                if not filename:
                    continue

                local_path = os.path.join(local_dir, filename)
                self.client.download_file(bucket, key, local_path)
                downloaded.append({
                    "s3_key": key,
                    "local_path": local_path,
                    "filename": filename,
                    "size_bytes": obj["Size"],
                })

        return downloaded

    def upload_file(self, bucket: str, s3_key: str, local_path: str, content_type: str = "image/jpeg") -> dict:
        """Upload a single file to S3."""
        self.client.upload_file(
            local_path,
            bucket,
            s3_key,
            ExtraArgs={"ContentType": content_type},
        )
        size = os.path.getsize(local_path)
        return {"s3_key": s3_key, "size_bytes": size}

    def upload_images(self, bucket: str, prefix: str, images: list[dict]) -> list[dict]:
        """Upload a list of processed images to S3."""
        manifest = []
        for img in images:
            s3_key = f"{prefix}{img['filename']}"
            content_type = f"image/{img.get('format', 'jpeg')}"
            self.upload_file(bucket, s3_key, img["local_path"], content_type)

            manifest.append({
                "s3_key": s3_key,
                "filename": img["filename"],
                "width": img.get("width"),
                "height": img.get("height"),
                "size_bytes": os.path.getsize(img["local_path"]),
                "format": img.get("format", "jpeg"),
                "content_hash": img.get("content_hash"),
                "perceptual_hash": img.get("perceptual_hash"),
            })

        return manifest
