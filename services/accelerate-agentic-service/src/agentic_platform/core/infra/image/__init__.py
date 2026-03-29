"""Image generation infrastructure — providers, gateway, models.

This module is the infrastructure layer. Tool definitions and block schemas
live in domains/common/ (the domain layer).

Usage:
    from src.agentic_platform.core.infra.image import ImageGateway, ImageResult
    from src.agentic_platform.core.infra.gcs_client import GCSClient
"""

from src.agentic_platform.core.infra.image.models import ImageResult, PartialImage, ImageGenParams
from src.agentic_platform.core.infra.image.provider import ImageGateway

__all__ = [
    "ImageGateway",
    "ImageResult",
    "PartialImage",
    "ImageGenParams",
]
