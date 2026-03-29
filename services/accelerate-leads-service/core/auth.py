"""Internal API key authentication dependency."""
from fastapi import Header, HTTPException
from core.config import get_settings


async def verify_internal_key(x_internal_key: str = Header(default="")) -> None:
    settings = get_settings()
    if settings.is_production and settings.internal_api_key:
        if x_internal_key != settings.internal_api_key:
            raise HTTPException(status_code=401, detail="Invalid internal API key")
