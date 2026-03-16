import json

from app.core.config import settings
from app.core.s3 import get_s3_client, get_s3_public_client


class S3Service:
    def __init__(self):
        self.client = get_s3_client()
        self.public_client = get_s3_public_client()
        self.bucket = settings.S3_BUCKET_NAME

    def generate_presigned_put(
        self, s3_key: str, content_type: str, expires_in: int = 3600
    ) -> str:
        return self.public_client.generate_presigned_url(
            "put_object",
            Params={
                "Bucket": self.bucket,
                "Key": s3_key,
                "ContentType": content_type,
            },
            ExpiresIn=expires_in,
        )

    def generate_presigned_get(self, s3_key: str, expires_in: int = 3600) -> str:
        return self.public_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": s3_key},
            ExpiresIn=expires_in,
        )

    def list_objects(self, prefix: str) -> list[dict]:
        result = []
        paginator = self.client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=self.bucket, Prefix=prefix):
            for obj in page.get("Contents", []):
                result.append(
                    {"key": obj["Key"], "size": obj["Size"], "modified": obj["LastModified"]}
                )
        return result

    def put_json(self, s3_key: str, data: dict) -> None:
        self.client.put_object(
            Bucket=self.bucket,
            Key=s3_key,
            Body=json.dumps(data, indent=2, default=str),
            ContentType="application/json",
        )

    def delete_prefix(self, prefix: str) -> int:
        objects = self.list_objects(prefix)
        if not objects:
            return 0
        delete_keys = [{"Key": obj["key"]} for obj in objects]
        self.client.delete_objects(
            Bucket=self.bucket, Delete={"Objects": delete_keys}
        )
        return len(delete_keys)
