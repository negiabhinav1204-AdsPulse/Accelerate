from __future__ import annotations
import os
from functools import lru_cache


class Settings:
    database_url: str = os.environ["DATABASE_URL"]
    internal_api_key: str = os.environ.get("INTERNAL_API_KEY", "")
    port: int = int(os.environ.get("PORT", "8002"))
    environment: str = os.environ.get("ENVIRONMENT", "development")


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
