"""Block schemas for common domain — shared across all agents.

Two block types for image generation:
  - generated_image (INLINE) — final image with CDN URL (persisted)
  - image_preview   (INLINE) — ephemeral b64 preview during streaming
"""

from pydantic import BaseModel, Field

from src.agentic_platform.core.engine.blocks import BlockSpec, register_block_spec
from src.agentic_platform.core.engine.models import BlockDisplay


# ── Generated Image (final, persisted) ───────────────────────────

class GeneratedImageData(BaseModel):
    """Final generated image — rendered as an inline image card in chat."""
    cdn_url: str = Field(description="CDN URL of the generated image")
    prompt: str = Field(description="Enhanced prompt sent to API")
    original_prompt: str = Field(description="User's raw input prompt")
    provider: str = Field(description="Provider used: openai, imagen, gemini")
    model: str = Field(description="Model ID used for generation")
    size: str = Field(description="Image dimensions (e.g. 1024x1024)")
    generation_time_ms: int = Field(default=0, description="Generation time in ms")

generated_image = register_block_spec(BlockSpec(
    block_type="generated_image",
    data_schema=GeneratedImageData,
    display=BlockDisplay.INLINE,
    description="AI-generated image with CDN URL — rendered inline in chat with metadata.",
))


# ── Image Preview (ephemeral, streaming) ─────────────────────────

class ImagePreviewData(BaseModel):
    """Partial/preview image during streaming generation."""
    b64_data: str = Field(description="Base64-encoded partial image data")
    index: int = Field(description="Preview index (0-based)")
    total: int = Field(description="Total expected previews")
    prompt: str = Field(description="The generation prompt")

image_preview = register_block_spec(BlockSpec(
    block_type="image_preview",
    data_schema=ImagePreviewData,
    display=BlockDisplay.INLINE,
    description="Ephemeral partial image preview during streaming generation.",
))
