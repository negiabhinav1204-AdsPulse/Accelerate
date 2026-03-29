import os
from functools import lru_cache

class Settings:
    database_url: str = os.environ.get("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/accelerate")
    internal_api_key: str = os.environ.get("INTERNAL_API_KEY", "")
    redis_url: str = os.environ.get("REDIS_URL", "redis://localhost:6379")
    litellm_api_key: str = os.environ.get("LITELLM_API_KEY", "")
    litellm_base_url: str = os.environ.get("LITELLM_BASE_URL", "")
    environment: str = os.environ.get("ENVIRONMENT", "development")
    edge_cache_ttl: int = int(os.environ.get("EDGE_CACHE_TTL", "60"))

@lru_cache
def get_settings() -> Settings:
    return Settings()
