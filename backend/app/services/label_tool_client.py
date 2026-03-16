import logging

import httpx

from app.core.config import settings
from app.services.s3_service import S3Service

logger = logging.getLogger(__name__)


class LabelToolClient:
    def __init__(self):
        self.base_url = settings.LABEL_TOOL_BASE_URL
        self.client = httpx.AsyncClient(timeout=30.0)

    async def health_check(self) -> bool:
        """Check if the Label Tool service is reachable."""
        try:
            response = await self.client.get(f"{self.base_url}/health", timeout=5.0)
            return response.status_code == 200
        except httpx.HTTPError:
            return False

    async def create_project(self, name: str, label_config: list[dict]) -> dict:
        try:
            response = await self.client.post(
                f"{self.base_url}/api/v1/projects",
                json={"name": name, "label_config": label_config},
            )
            response.raise_for_status()
            return response.json()
        except httpx.ConnectError:
            logger.error("Label Tool service is not reachable at %s", self.base_url)
            raise httpx.ConnectError(
                f"Label Tool service is not reachable at {self.base_url}. "
                "Ensure the Label Tool container is running."
            )

    async def create_tasks(
        self, project_id: str, images: list[dict]
    ) -> list[dict]:
        s3_service = S3Service()
        tasks = []
        for img in images:
            presigned_url = s3_service.generate_presigned_get(img["s3_key"])
            tasks.append(
                {
                    "data": {
                        "image": {
                            "url": presigned_url,
                            "width": img["width"],
                            "height": img["height"],
                            "filename": img["filename"],
                        }
                    }
                }
            )

        response = await self.client.post(
            f"{self.base_url}/api/v1/projects/{project_id}/tasks",
            json=tasks,
        )
        response.raise_for_status()
        return response.json()

    async def get_analytics(self, project_id: str) -> dict:
        response = await self.client.get(
            f"{self.base_url}/api/v1/projects/{project_id}/analytics",
        )
        response.raise_for_status()
        return response.json()

    async def export_annotations(
        self, project_id: str, format: str = "coco"
    ) -> bytes:
        response = await self.client.post(
            f"{self.base_url}/api/v1/projects/{project_id}/export",
            json={"format": format},
        )
        response.raise_for_status()
        job = response.json()

        download_response = await self.client.get(
            f"{self.base_url}/api/v1/export-jobs/{job['id']}/download",
        )
        download_response.raise_for_status()
        return download_response.content

    async def close(self):
        await self.client.aclose()
