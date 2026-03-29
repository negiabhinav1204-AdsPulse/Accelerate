"""Image generation tool — shared, domain-agnostic.

Any agent can register this. Campaigns registers it for ad creatives;
a future "design assistant" agent could register the same tool.

Block lifecycle (single block_id, in-place replacement):
  1. image_preview (placeholder spinner) → immediate on tool start
  2. image_preview (partial b64)         → as partials arrive from OpenAI
  3. generated_image (final CDN URL)     → replaces preview in-place
"""

import logging
import time
from typing import Annotated
from uuid import uuid4

from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool, InjectedToolArg

from src.agentic_platform.core.engine.models import AgenticTool, ToolResponse
from src.agentic_platform.core.engine.context import get_emitter, get_org_id
from src.agentic_platform.core.infra.image.models import ImageGenParams, PartialImage
from src.agentic_platform.core.infra.image.provider import ImageGateway
from src.agentic_platform.app.common.blocks import (
    generated_image, GeneratedImageData,
    image_preview, ImagePreviewData,
)
from src.agentic_platform.core.infra.gcs_client import GCSClient

logger = logging.getLogger(__name__)

_gateway = ImageGateway()
_gcs = GCSClient()


@tool("generate_image")
async def _generate_image(
    prompt: str,
    provider: str = "auto",
    size: str = "1024x1024",
    quality: str = "auto",
    background: str = "auto",
    image_style: str = "",
    image_mood: str = "",
    brand_colors: list[str] = [],
    stream_preview: bool = True,
    edit_image_url: str = "",
    config: Annotated[RunnableConfig, InjectedToolArg()] = None,
) -> dict:
    """Generate an AI image from a text description. Use for creating campaign banners,
    ad creatives, product visuals, and marketing imagery.

    Args:
        prompt: Detailed description of the image to generate.
        provider: Image provider — "auto" (default), "openai", "imagen", or "gemini".
        size: Image dimensions — "1024x1024", "1536x1024" (landscape), or "1024x1536" (portrait).
        quality: Image quality — "low", "medium", "high", or "auto".
        background: Background style — "transparent", "opaque", or "auto". OpenAI only.
        image_style: Visual style — "cartoonistic", "photorealistic", "flat illustration", "editorial", "minimal".
        image_mood: Mood/atmosphere — "warm and inviting", "cool and professional", "vibrant and energetic".
        brand_colors: Brand color palette as hex codes for the image, e.g. ["#1a5f2a", "#f5f0e1"].
        stream_preview: Whether to show partial previews during generation.
        edit_image_url: CDN URL of a previously generated image to edit/modify.
    """
    start = time.monotonic()
    emitter = get_emitter(config) if config else None
    org_id = get_org_id(config) if config else "unknown"

    # Enrich prompt with structured creative params
    enriched_prompt = prompt
    if image_style:
        enriched_prompt += f" Style: {image_style}."
    if image_mood:
        enriched_prompt += f" Mood: {image_mood}."
    if brand_colors:
        color_desc = ", ".join(brand_colors[:5])
        enriched_prompt += f" Use this color palette: {color_desc}."

    params = ImageGenParams(
        prompt=enriched_prompt,
        size=size,
        quality=quality,
        background=background,
        stream_preview=stream_preview,
        edit_image_url=edit_image_url,
    )

    # Stable block_id for the entire lifecycle: placeholder → partials → final
    block_id = f"img-{uuid4().hex[:12]}"

    # Emit immediate placeholder spinner (before any API call)
    if emitter and stream_preview:
        emitter.block(
            "image_preview",
            ImagePreviewData(
                b64_data="",
                index=-1,
                total=0,
                prompt=prompt,
            ).model_dump(),
            block_id=block_id,
        )

    # Partial preview callback — replaces placeholder in-place
    async def on_partial(partial: PartialImage) -> None:
        if emitter and stream_preview:
            emitter.block(
                "image_preview",
                ImagePreviewData(
                    b64_data=partial.b64_data,
                    index=partial.index,
                    total=partial.total,
                    prompt=prompt,
                ).model_dump(),
                block_id=block_id,
            )

    result = await _gateway.generate(
        params,
        provider=provider,
        on_partial=on_partial if (emitter and stream_preview) else None,
    )

    # Upload to GCS
    cdn_url = await _gcs.upload(result.image_bytes, org_id=org_id)
    if not cdn_url:
        return ToolResponse(
            summary="Image generation succeeded but upload failed. Please try again.",
        ).model_dump()

    elapsed_ms = int((time.monotonic() - start) * 1000)

    # Emit final generated_image with SAME block_id — replaces preview in-place
    if emitter:
        emitter.block(
            "generated_image",
            GeneratedImageData(
                cdn_url=cdn_url,
                prompt=result.revised_prompt or prompt,
                original_prompt=prompt,
                provider=result.provider,
                model=result.model,
                size=size,
                generation_time_ms=elapsed_ms,
            ).model_dump(),
            block_id=block_id,
        )

    # No ui_blocks — the emitter already streamed the generated_image block
    # (reducer persists it from the CUSTOM event)
    return ToolResponse(
        summary=f"Generated image ({result.provider}/{result.model}). CDN: {cdn_url}",
        data={"cdn_url": cdn_url, "provider": result.provider, "model": result.model},
    ).model_dump()


generate_image = AgenticTool(
    func=_generate_image,
    thinking_messages=[
        "Creating your image...",
        "Generating visual...",
        "Crafting your creative...",
    ],
    tags=[],
    timeout=120,
)
