from pydantic_settings import BaseSettings
from functools import lru_cache


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
    cors_origins: list[str] = ["http://localhost:3000"]
    
    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
