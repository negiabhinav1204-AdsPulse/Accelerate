"""Central configuration loaded from environment variables."""
import os
from functools import lru_cache


class Settings:
    database_url: str = os.environ["DATABASE_URL"]
    internal_api_key: str = os.environ.get("INTERNAL_API_KEY", "")
    service_url: str = os.environ.get("ANALYTICS_SERVICE_URL", "http://localhost:8093")
    port: int = int(os.environ.get("PORT", "8093"))
    environment: str = os.environ.get("ENVIRONMENT", "development")
    # Commerce service URL for fetching order/revenue data
    commerce_service_url: str = os.environ.get("COMMERCE_SERVICE_URL", "http://localhost:8082")
    # LiteLLM proxy for insight generation
    litellm_base_url: str = os.environ.get("LITELLM_BASE_URL", "")
    litellm_api_key: str = os.environ.get("LITELLM_API_KEY", "")

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
