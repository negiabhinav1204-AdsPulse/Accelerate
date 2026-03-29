"""OpenAI image generation provider.

Supports sync and streaming (partial previews) generation.

Streaming event types (from OpenAI SDK):
  - ImageGenPartialImageEvent (type="image_generation.partial_image")
      Fields: b64_json, partial_image_index, size, quality, background, ...
  - ImageGenCompletedEvent (type="image_generation.completed")
      Fields: b64_json, size, quality, background, usage, ...
"""

import base64
import io
import logging
import time
from typing import Callable, Optional, Awaitable

import httpx
from openai import AsyncOpenAI

from src.agentic_platform.core.config import settings, IMAGE_MODELS
from src.agentic_platform.core.infra.image.models import ImageResult, ImageGenParams, PartialImage

logger = logging.getLogger(__name__)


class OpenAIImageProvider:
    """OpenAI image generation via gpt-image-1.5."""

    def __init__(self) -> None:
        self._client = AsyncOpenAI()

    async def generate(
        self,
        params: ImageGenParams,
        on_partial: Optional[Callable[[PartialImage], Awaitable[None]]] = None,
    ) -> ImageResult:
        """Generate an image. Uses streaming with partial previews when on_partial is set."""
        start = time.monotonic()

        if params.stream_preview and on_partial:
            return await self._generate_streaming(params, on_partial, start)
        return await self._generate_sync(params, start)

    async def _generate_sync(self, params: ImageGenParams, start: float) -> ImageResult:
        """Non-streaming generation."""
        response = await self._client.images.generate(
            model=IMAGE_MODELS["openai"],
            prompt=params.prompt,
            size=params.size,
            quality=params.quality,
            background=params.background,
            output_format="png",
            n=1,
        )

        b64_data = response.data[0].b64_json
        image_bytes = base64.b64decode(b64_data)

        return ImageResult(
            image_bytes=image_bytes,
            provider="openai",
            model=IMAGE_MODELS["openai"],
            size=params.size,
            revised_prompt=getattr(response.data[0], "revised_prompt", None) or params.prompt,
        )

    async def _generate_streaming(
        self,
        params: ImageGenParams,
        on_partial: Callable[[PartialImage], Awaitable[None]],
        start: float,
    ) -> ImageResult:
        """Streaming generation with partial previews."""
        partial_count = settings.image_partial_count
        final_b64: str | None = None

        try:
            stream = await self._client.images.generate(
                model=IMAGE_MODELS["openai"],
                prompt=params.prompt,
                size=params.size,
                quality=params.quality,
                background=params.background,
                output_format="png",
                n=1,
                stream=True,
                partial_images=partial_count,
            )

            async for event in stream:
                if event.type == "image_generation.partial_image":
                    await on_partial(PartialImage(
                        b64_data=event.b64_json,
                        index=event.partial_image_index,
                        total=partial_count,
                    ))
                elif event.type == "image_generation.completed":
                    final_b64 = event.b64_json

        except Exception as e:
            error_msg = str(e).lower()
            if "safety" in error_msg or "content_policy" in error_msg or "moderation" in error_msg:
                raise RuntimeError(
                    "Image was rejected by content moderation. "
                    "Try a different prompt without copyrighted characters or prohibited content."
                ) from e
            raise

        if not final_b64:
            raise RuntimeError(
                "Image generation was blocked by content moderation. "
                "Try a different prompt without copyrighted characters or prohibited content."
            )

        image_bytes = base64.b64decode(final_b64)
        return ImageResult(
            image_bytes=image_bytes,
            provider="openai",
            model=IMAGE_MODELS["openai"],
            size=params.size,
            revised_prompt=params.prompt,
        )

    async def edit(
        self,
        image_url: str,
        prompt: str,
        params: ImageGenParams,
    ) -> ImageResult:
        """Edit an existing image."""
        # Download source image from CDN
        async with httpx.AsyncClient() as http:
            resp = await http.get(image_url, timeout=30)
            resp.raise_for_status()
            source_bytes = resp.content

        response = await self._client.images.edit(
            model=IMAGE_MODELS["openai"],
            image=[("image.png", source_bytes, "image/png")],
            prompt=prompt,
            size=params.size,
            n=1,
        )

        b64_data = response.data[0].b64_json
        image_bytes = base64.b64decode(b64_data)

        return ImageResult(
            image_bytes=image_bytes,
            provider="openai",
            model=IMAGE_MODELS["openai"],
            size=params.size,
            revised_prompt=getattr(response.data[0], "revised_prompt", None) or prompt,
        )
