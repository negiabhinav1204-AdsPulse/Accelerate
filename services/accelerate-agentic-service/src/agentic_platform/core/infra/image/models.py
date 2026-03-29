"""Image generation models — unified across all providers."""

from pydantic import BaseModel


class PartialImage(BaseModel):
    """A partial/preview image from streaming generation."""
    b64_data: str
    index: int
    total: int


class ImageResult(BaseModel):
    """Result from an image generation provider."""
    image_bytes: bytes
    provider: str
    model: str
    size: str
    revised_prompt: str = ""

    class Config:
        arbitrary_types_allowed = True


class ImageGenParams(BaseModel):
    """Unified generation params — mapped to each provider's API."""
    prompt: str
    size: str = "1024x1024"          # 1024x1024, 1536x1024, 1024x1536
    quality: str = "auto"            # low, medium, high, auto
    background: str = "auto"         # transparent, opaque, auto (OpenAI only)
    stream_preview: bool = False     # Callers opt-in; True only for interactive tool use
    edit_image_url: str = ""         # CDN URL of image to edit (Phase 4)
