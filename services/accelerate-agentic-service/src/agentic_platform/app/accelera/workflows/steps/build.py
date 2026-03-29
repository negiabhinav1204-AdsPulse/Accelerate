"""Step 4: Generate text assets + images in parallel using GPT-Pro and ImageGateway."""

import asyncio
import logging
from typing import Any

from src.agentic_platform.core.engine import NodeResponse, WorkflowContext, is_rejection
from src.agentic_platform.core.llm import structured_llm_call

logger = logging.getLogger(__name__)


async def _generate_text_assets(creative_out: dict, strategy_out: dict, brand_out: dict, user_input: dict) -> dict:
    """Generate platform-specific ad copy using GPT-Pro."""
    goal = user_input.get("goal", "SALES")
    platforms = user_input.get("platforms", ["google", "meta"])

    prompt = f"""You are a direct-response ad copywriter. Generate ad copy for each platform.

Brand: {brand_out.get('brand_name', '')} — {brand_out.get('value_propositions', [])}
Goal: {goal}
Creative strategy: {creative_out.get('ad_angle', '')}
Primary headline: {creative_out.get('primary_headline', '')}
Platforms needed: {platforms}

For each platform in {platforms}, produce:
{{
  "platform": string,
  "headlines": [5 headlines, max 30 chars each],
  "descriptions": [3 descriptions, max 90 chars each],
  "cta": string,
  "keywords": [10 keywords],
  "negative_keywords": [5 negative keywords]
}}

Return a JSON array of platform objects. No markdown fences."""

    try:
        result = await structured_llm_call(
            system_prompt="You are a performance marketing ad copywriter. Return only valid JSON.",
            user_message=prompt,
            model="gpt-pro",
        )
        import json
        if isinstance(result, str):
            return {"platform_copy": json.loads(result)}
        return {"platform_copy": result}
    except Exception as e:
        logger.warning("Text generation failed: %s", e)
        return {"platform_copy": [], "error": str(e)}


async def _generate_campaign_images(creative_out: dict, brand_out: dict, product_images: list[str]) -> list[dict]:
    """Generate ad creative images using ImageGateway."""
    image_prompts = creative_out.get("image_prompts", [])
    if not image_prompts:
        return []

    generated = []
    for i, img_prompt in enumerate(image_prompts[:2]):  # limit to 2 images per campaign
        try:
            from src.agentic_platform.core.infra.image.provider import ImageGateway
            from src.agentic_platform.core.config import settings

            gateway = ImageGateway()
            brand_context = f"Brand: {brand_out.get('brand_name', '')}. Style: {brand_out.get('tone', 'professional')}."
            full_prompt = f"{img_prompt}. {brand_context}"

            result = await gateway.generate(
                prompt=full_prompt,
                model=settings.image_gen_model,
                size="1024x1024",
            )
            if result:
                generated.append({"prompt": img_prompt, "url": result.get("url", ""), "index": i})
        except Exception as e:
            logger.warning("Image generation %d failed: %s", i, e)

    return generated


async def build(ctx: WorkflowContext) -> NodeResponse:
    """Build text + image assets in parallel."""
    # Check if user cancelled at configure step
    configure_result = ctx.results.get("configure", NodeResponse(summary="", data={}, metadata={}))
    user_input = configure_result.metadata.get("user_input", {})
    if is_rejection(user_input):
        return NodeResponse(summary="Campaign creation cancelled.", data={"cancelled": True})

    analyze_data = ctx.results.get("analyze", NodeResponse(summary="", data={})).data
    scrape_data = ctx.results.get("scrape", NodeResponse(summary="", data={})).data

    creative_out = analyze_data.get("creative", {})
    strategy_out = analyze_data.get("strategy", {})
    brand_out = analyze_data.get("brand", {})
    product_images = scrape_data.get("product_images", [])

    ctx.progress.start("text")
    ctx.progress.start("images")

    # Run text gen + image gen in parallel
    text_result, image_results = await asyncio.gather(
        _generate_text_assets(creative_out, strategy_out, brand_out, user_input),
        _generate_campaign_images(creative_out, brand_out, product_images),
        return_exceptions=True,
    )

    if isinstance(text_result, Exception):
        logger.warning("Text generation failed: %s", text_result)
        text_result = {"platform_copy": []}
    if isinstance(image_results, Exception):
        logger.warning("Image generation failed: %s", image_results)
        image_results = []

    ctx.progress.done("text", summary=f"Generated copy for {len(text_result.get('platform_copy',[]))} platforms.")
    ctx.progress.done("images", summary=f"Generated {len(image_results)} ad images.")

    return NodeResponse(
        summary=f"Assets built: copy for {len(text_result.get('platform_copy',[]))} platforms, {len(image_results)} images.",
        data={
            "text_assets": text_result,
            "images": image_results,
            "user_approved_settings": user_input,
        },
    )
