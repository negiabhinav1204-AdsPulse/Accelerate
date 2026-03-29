"""Central configuration loaded from environment variables."""
import os
from functools import lru_cache


class Settings:
    database_url: str = os.environ["DATABASE_URL"]
    internal_api_key: str = os.environ.get("INTERNAL_API_KEY", "")
    service_url: str = os.environ.get("LEADS_SERVICE_URL", "http://localhost:8005")
    port: int = int(os.environ.get("PORT", "8005"))
    environment: str = os.environ.get("ENVIRONMENT", "development")

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
