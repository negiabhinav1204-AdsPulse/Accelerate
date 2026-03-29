"""ImageGateway — routes image generation to the correct provider.

Supports: OpenAI (gpt-image-1), Imagen 3, Gemini native.
Provider routing: explicit provider param > edit_image_url detection > settings default.
"""

import logging
from typing import Callable, Optional, Awaitable

from src.agentic_platform.core.config import settings, IMAGE_MODELS
from src.agentic_platform.core.infra.image.models import ImageResult, ImageGenParams, PartialImage
from src.agentic_platform.core.infra.image.openai_provider import OpenAIImageProvider
from src.agentic_platform.core.infra.image.google_provider import ImagenProvider, GeminiNativeProvider
from src.agentic_platform.core.infra.gcs_client import GCSClient

logger = logging.getLogger(__name__)


class ImageGateway:
    """Routes image generation requests to the correct provider."""

    def __init__(self) -> None:
        self._openai = OpenAIImageProvider()
        self._imagen = ImagenProvider()
        self._gemini = GeminiNativeProvider(model_key="gemini")
        self._gemini_preview = GeminiNativeProvider(model_key="gemini-preview")
        self._gemini_pro_preview = GeminiNativeProvider(model_key="gemini-pro-preview")
        self._gcs = GCSClient()

    def _resolve_provider(self, provider: str, edit_image_url: str = "") -> str:
        """Determine which provider to use."""
        if provider != "auto":
            return provider
        # If editing, prefer gemini (native multi-turn) over openai
        if edit_image_url:
            return "gemini"
        return settings.image_gen_model

    async def generate(
        self,
        params: ImageGenParams,
        provider: str = "auto",
        on_partial: Optional[Callable[[PartialImage], Awaitable[None]]] = None,
    ) -> ImageResult:
        """Generate an image using the resolved provider."""
        resolved = self._resolve_provider(provider, params.edit_image_url)

        if params.edit_image_url:
            return await self.edit(params.edit_image_url, params.prompt, params, resolved)

        if resolved == "openai":
            return await self._openai.generate(params, on_partial)
        elif resolved == "imagen":
            return await self._imagen.generate(params)
        elif resolved == "gemini":
            return await self._gemini.generate(params)
        elif resolved == "gemini-preview":
            return await self._gemini_preview.generate(params)
        elif resolved == "gemini-pro-preview":
            return await self._gemini_pro_preview.generate(params)
        else:
            logger.warning("Unknown image provider %s, falling back to openai", resolved)
            return await self._openai.generate(params, on_partial)

    async def edit(
        self,
        image_url: str,
        prompt: str,
        params: ImageGenParams,
        provider: str = "openai",
    ) -> ImageResult:
        """Edit an existing image. Routes to correct provider."""
        if provider in ("gemini", "gemini-preview", "gemini-pro-preview"):
            image_bytes = await self._gcs.download(image_url)
            if not image_bytes:
                raise RuntimeError(f"Could not download image from {image_url}")
            gen = {"gemini": self._gemini, "gemini-preview": self._gemini_preview, "gemini-pro-preview": self._gemini_pro_preview}[provider]
            return await gen.edit(image_bytes, prompt, params)
        else:
            # OpenAI accepts URL directly
            return await self._openai.edit(image_url, prompt, params)
