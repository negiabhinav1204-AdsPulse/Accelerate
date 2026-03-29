"""Prompt enhancement for image generation.

Uses a fast/cheap LLM to enhance vague prompts with advertising context.
Falls back to original prompt on error.
"""

import logging

from src.agentic_platform.core.config import settings
from src.agentic_platform.core.llm import get_llm

logger = logging.getLogger(__name__)

_ENHANCE_SYSTEM = """You are an expert advertising creative director. Your job is to enhance
image generation prompts to produce stunning, professional advertising imagery.

Rules:
- Keep the enhanced prompt under 500 characters
- Add specific visual details: lighting, composition, color palette, mood
- Include advertising-appropriate framing (clean backgrounds, product focus)
- Never add text, logos, or watermarks to the description
- Preserve the user's core intent — enhance, don't replace
- Output ONLY the enhanced prompt, nothing else"""


async def enhance_prompt(original: str) -> str:
    """Enhance a prompt for image generation. Returns original on error."""
    try:
        llm = get_llm(settings.image_prompt_enhance_model, temperature=0.7)
        response = await llm.ainvoke([
            {"role": "system", "content": _ENHANCE_SYSTEM},
            {"role": "user", "content": original},
        ])
        enhanced = response.content.strip()
        if enhanced:
            logger.debug("Enhanced prompt: %s -> %s", original[:50], enhanced[:50])
            return enhanced
    except Exception:
        logger.warning("Prompt enhancement failed, using original", exc_info=True)

    return original
