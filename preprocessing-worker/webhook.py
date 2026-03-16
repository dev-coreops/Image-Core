import asyncio
import logging

import httpx

logger = logging.getLogger(__name__)

MAX_RETRIES = 3
RETRY_BACKOFF = 2.0


class WebhookReporter:
    def __init__(self, webhook_url: str, webhook_token: str):
        self.webhook_url = webhook_url
        self.webhook_token = webhook_token
        self.client = httpx.AsyncClient(timeout=30.0)

    async def report(
        self,
        status: str | None = None,
        progress: int | None = None,
        logs: str | None = None,
        images_processed: int | None = None,
        images_excluded: int | None = None,
        exclusion_summary: dict | None = None,
        result: dict | None = None,
        error: str | None = None,
        resource_usage: dict | None = None,
    ) -> None:
        payload: dict = {"webhook_token": self.webhook_token}

        if status is not None:
            payload["status"] = status
        if progress is not None:
            payload["progress"] = progress
        if logs is not None:
            payload["logs"] = logs
        if images_processed is not None:
            payload["images_processed"] = images_processed
        if images_excluded is not None:
            payload["images_excluded"] = images_excluded
        if exclusion_summary is not None:
            payload["exclusion_summary"] = exclusion_summary
        if result is not None:
            payload["result"] = result
        if error is not None:
            payload["error"] = error
        if resource_usage is not None:
            payload["resource_usage"] = resource_usage

        last_exc: Exception | None = None
        for attempt in range(MAX_RETRIES):
            try:
                response = await self.client.post(self.webhook_url, json=payload)
                response.raise_for_status()
                return
            except Exception as e:
                last_exc = e
                logger.warning(
                    "Webhook report failed (attempt %d/%d): %s",
                    attempt + 1,
                    MAX_RETRIES,
                    e,
                )
                if attempt < MAX_RETRIES - 1:
                    await asyncio.sleep(RETRY_BACKOFF * (attempt + 1))

        logger.error(
            "Webhook report failed after %d attempts: %s (status=%s)",
            MAX_RETRIES,
            last_exc,
            payload.get("status"),
        )

    async def close(self):
        await self.client.aclose()
