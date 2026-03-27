"""Central configuration loaded from environment variables."""
import os
from functools import lru_cache


class Settings:
    database_url: str = os.environ["DATABASE_URL"]
    internal_api_key: str = os.environ.get("INTERNAL_API_KEY", "")
    qstash_url: str = os.environ.get("QSTASH_URL", "")
    qstash_token: str = os.environ.get("QSTASH_TOKEN", "")
    service_url: str = os.environ.get("COMMERCE_SERVICE_URL", "http://localhost:8001")
    encryption_key: str = os.environ.get("CREDENTIALS_ENCRYPTION_KEY", "")
    port: int = int(os.environ.get("PORT", "8001"))
    environment: str = os.environ.get("ENVIRONMENT", "development")

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
