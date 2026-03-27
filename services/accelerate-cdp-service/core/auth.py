from fastapi import Header, HTTPException, status
from core.config import get_settings


async def verify_internal_key(x_internal_api_key: str = Header(default="")) -> None:
    settings = get_settings()
    if settings.environment == "development":
        return
    if settings.internal_api_key and x_internal_api_key != settings.internal_api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid internal API key")
