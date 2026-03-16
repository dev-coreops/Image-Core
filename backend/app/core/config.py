from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str
    S3_ENDPOINT_URL: str
    S3_ACCESS_KEY: str
    S3_SECRET_KEY: str
    S3_BUCKET_NAME: str = "imagedata"
    S3_REGION: str = "us-east-1"
    S3_PUBLIC_URL: str = ""
    LABEL_TOOL_BASE_URL: str = "http://localhost:8004"
    BACKEND_CALLBACK_URL: str = "http://localhost:8005"
    WORKER_PORT: int = 8000
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
    UVICORN_HOST: str = "0.0.0.0"
    UVICORN_PORT: int = 8005

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
