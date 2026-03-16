import asyncio
import logging

from fastapi import BackgroundTasks, FastAPI
from pydantic import BaseModel

from pipeline.runner import run_pipeline

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

app = FastAPI(title="ImageDataCore Preprocessing Worker", version="0.1.0")


class PreprocessRequest(BaseModel):
    job_id: str
    s3_bucket: str
    s3_input_prefix: str
    s3_output_prefix: str
    config: dict
    webhook_url: str
    webhook_token: str
    s3_endpoint_url: str | None = None
    s3_access_key: str | None = None
    s3_secret_key: str | None = None


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/preprocess")
async def preprocess(body: PreprocessRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(
        run_pipeline,
        job_id=body.job_id,
        s3_bucket=body.s3_bucket,
        s3_input_prefix=body.s3_input_prefix,
        s3_output_prefix=body.s3_output_prefix,
        config=body.config,
        webhook_url=body.webhook_url,
        webhook_token=body.webhook_token,
        s3_endpoint_url=body.s3_endpoint_url,
        s3_access_key=body.s3_access_key,
        s3_secret_key=body.s3_secret_key,
    )
    return {"message": "Preprocessing started", "job_id": body.job_id}
