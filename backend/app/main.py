from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import datasets, images, preprocessing, versions
from app.core.config import settings
from app.core.errors import ProblemDetail, problem_detail_handler


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    yield
    # Shutdown


app = FastAPI(
    title="ImageDataCore",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_exception_handler(ProblemDetail, problem_detail_handler)

app.include_router(datasets.router, prefix="/api/v1", tags=["datasets"])
app.include_router(images.router, prefix="/api/v1", tags=["images"])
app.include_router(preprocessing.router, prefix="/api/v1", tags=["preprocessing"])
app.include_router(versions.router, prefix="/api/v1", tags=["versions"])


@app.get("/api/v1/health")
async def health():
    return {"status": "ok"}
