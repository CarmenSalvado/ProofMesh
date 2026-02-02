from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache
import json


class Settings(BaseSettings):
    # Database
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/proofmesh"
    
    # Redis
    redis_url: str = "redis://localhost:6379"
    
    # API Keys
    gemini_api_key: str = ""
    
    # JWT Auth
    jwt_secret_key: str = "change-me-in-production-super-secret-key"
    
    # App
    debug: bool = True
    cors_origins: list[str] = ["http://localhost:3000", "http://127.0.0.1:3000"]
    
    # Lean Runner
    lean_runner_url: str = "http://lean-runner:9008"
    lean_timeout: int = 60

    # S3 / MinIO
    s3_endpoint: str = "http://localhost:9000"
    s3_access_key: str = "proofmesh"
    s3_secret_key: str = "proofmesh"
    s3_bucket: str = "proofmesh"
    s3_region: str = "us-east-1"
    s3_secure: bool = False

    # LaTeX
    latex_compiler_url: str = "http://texlive-compiler:9009"
    latex_compile_timeout: int = 60

    @field_validator("debug", mode="before")
    @classmethod
    def parse_debug(cls, value):
        if isinstance(value, str):
            return value.lower() in ("true", "1", "yes", "on")
        return value
    
    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value):
        if isinstance(value, str):
            raw = value.strip()
            if not raw:
                return []
            try:
                parsed = json.loads(raw)
                if isinstance(parsed, list):
                    return parsed
            except json.JSONDecodeError:
                pass
            return [origin.strip() for origin in raw.split(",") if origin.strip()]
        return value
    
    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
