"""Google image generation providers — Imagen 3 and Gemini native.

Both use google-genai SDK (from google import genai), async client.
"""

import base64
import io
import logging
from typing import Optional

from google import genai
from google.genai import types

from src.agentic_platform.core.config import IMAGE_MODELS
from src.agentic_platform.core.infra.image.models import ImageResult, ImageGenParams

logger = logging.getLogger(__name__)

# ── Size mapping: unified size -> Google aspect_ratio ─────────────
_SIZE_TO_ASPECT = {
    "1024x1024": "1:1",
    "1536x1024": "3:2",
    "1024x1536": "2:3",
}

# ── Quality mapping: unified quality -> Google image_size ─────────
_QUALITY_TO_SIZE = {
    "low": "512",
    "medium": "1K",
    "high": "2K",
    "auto": "1K",
}


class ImagenProvider:
    """Google Imagen — text-to-image only, no editing, no streaming."""

    def __init__(self) -> None:
        self._client = genai.Client()
        self._model_id = IMAGE_MODELS["imagen"]

    async def generate(self, params: ImageGenParams) -> ImageResult:
        """Generate image via Imagen."""
        aspect_ratio = _SIZE_TO_ASPECT.get(params.size, "1:1")

        response = await self._client.aio.models.generate_images(
            model=self._model_id,
            prompt=params.prompt,
            config=types.GenerateImagesConfig(
                number_of_images=1,
                aspect_ratio=aspect_ratio,
            ),
        )

        if not response.generated_images:
            raise RuntimeError("Imagen returned no images")

        image = response.generated_images[0]
        image_bytes = image.image.image_bytes

        return ImageResult(
            image_bytes=image_bytes,
            provider="imagen",
            model=self._model_id,
            size=params.size,
            revised_prompt=params.prompt,
        )


class GeminiNativeProvider:
    """Google Gemini native image generation — supports multi-turn editing."""

    def __init__(self, model_key: str = "gemini") -> None:
        self._client = genai.Client()
        self._model_id = IMAGE_MODELS[model_key]

    async def generate(self, params: ImageGenParams) -> ImageResult:
        """Generate image via Gemini native (text-to-image)."""
        response = await self._client.aio.models.generate_content(
            model=self._model_id,
            contents=params.prompt,
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"],
            ),
        )

        image_bytes = self._extract_image(response)
        return ImageResult(
            image_bytes=image_bytes,
            provider="gemini",
            model=self._model_id,
            size=params.size,
            revised_prompt=params.prompt,
        )

    async def edit(
        self,
        image_bytes: bytes,
        prompt: str,
        params: ImageGenParams,
    ) -> ImageResult:
        """Edit image via Gemini native (multi-turn with image context)."""
        from PIL import Image

        img = Image.open(io.BytesIO(image_bytes))

        response = await self._client.aio.models.generate_content(
            model=self._model_id,
            contents=[prompt, img],
            config=types.GenerateContentConfig(
                response_modalities=["IMAGE"],
            ),
        )

        result_bytes = self._extract_image(response)
        return ImageResult(
            image_bytes=result_bytes,
            provider="gemini",
            model=self._model_id,
            size=params.size,
            revised_prompt=prompt,
        )

    def _extract_image(self, response) -> bytes:
        """Extract image bytes from Gemini response."""
        for part in response.candidates[0].content.parts:
            if part.inline_data and part.inline_data.mime_type.startswith("image/"):
                data = part.inline_data.data
                if isinstance(data, (bytes, bytearray)):
                    return bytes(data)
                # Fallback: if SDK ever returns base64 string
                return base64.b64decode(data)
        raise RuntimeError("Gemini response contained no image data")
