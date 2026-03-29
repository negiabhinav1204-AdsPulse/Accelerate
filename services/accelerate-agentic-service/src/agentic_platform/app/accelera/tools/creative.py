"""Ad creative generation tool — AI image + copy for a specific product.

Tool:
  generate_ad_creative — Generates on-brand image + headline/description/CTA for a product.

Porting: Adaptiv api/app/services/ad_creator.py (image styles, prompt construction)
         Adaptiv api/app/routers/copilot.py generate_ad_creative handler

The tool:
  1. Fetches product details from commerce-service
  2. Loads brand brief if available (for on-brand image style + copy tone)
  3. Generates image via creative-service (accelerate-creative-service)
  4. Generates copy via LiteLLM (structured_llm_call)
  5. Returns creative_url + copy dict + a creative preview block
"""

from typing import Optional

from langchain_core.tools import tool
from pydantic import BaseModel

from src.agentic_platform.core.engine import AgenticTool, ToolResponse, ToolTag
from src.agentic_platform.core.engine.context import get_org_id
from src.agentic_platform.core.llm import structured_llm_call
from src.agentic_platform.app.accelera.services.clients import commerce_client, creative_client
from src.agentic_platform.app.accelera.brand.company_brief import (
    get_brief_for_org,
    format_brief_for_image_prompt,
    format_brief_for_copy_prompt,
)
from src.agentic_platform.app.accelera.blocks import metric_cards_block, MetricCardsData, MetricItem


# ── Copy schema ───────────────────────────────────────────────────────

class AdCopy(BaseModel):
    headline: str = ""
    description: str = ""
    cta: str = "Shop Now"
    short_headline: str = ""  # for display/PMax (max 30 chars)


# ── Image style prompts (reference: Adaptiv ad_creator.py) ───────────

_STYLE_PROMPTS: dict[str, str] = {
    "dramatic_dark": (
        "dramatic dark studio photography, deep shadows, moody cinematic lighting, "
        "product centered on black background, luxury feel, high contrast"
    ),
    "golden_hour": (
        "golden hour outdoor photography, warm sunlight, lifestyle context, "
        "natural environment, aspirational and warm atmosphere"
    ),
    "lifestyle": (
        "bright lifestyle photography, natural light, white background, "
        "clean and modern, product in use, relatable everyday setting"
    ),
    "minimalist": (
        "minimalist product photography, clean white background, "
        "soft shadows, studio quality, e-commerce standard"
    ),
    "vibrant": (
        "vibrant colorful background, bold graphic style, "
        "high energy, Gen Z aesthetic, social media optimized"
    ),
}

_PLATFORM_SPECS: dict[str, dict[str, str]] = {
    "meta":   {"ratio": "1:1", "size": "1080x1080"},
    "google": {"ratio": "1.91:1", "size": "1200x628"},
    "bing":   {"ratio": "1.91:1", "size": "1200x628"},
}


# ── generate_ad_creative ──────────────────────────────────────────────

@tool("generate_ad_creative")
async def _generate_ad_creative(
    product_id: Optional[str] = None,
    style: str = "lifestyle",
    headline: Optional[str] = None,
    platform: str = "meta",
    product_title: Optional[str] = None,
    product_description: Optional[str] = None,
) -> dict:
    """Generate AI-powered ad creative: an image plus headline, description, and CTA for a product.

    Returns creative_url (hosted image URL) and copy dict.
    Use when the user asks to generate ad creative, images, or copy for a campaign.

    product_id: ID from your product catalog. Provide product_title/description if no product_id.
    style: "lifestyle" (default) | "dramatic_dark" | "golden_hour" | "minimalist" | "vibrant"
    platform: "meta" (default) | "google" | "bing" — affects image ratio and copy length.
    headline: Optional override for headline. If omitted, AI generates it."""
    org_id = get_org_id()

    # 1. Fetch product if product_id provided
    product: dict = {}
    if product_id:
        try:
            resp = await commerce_client.get(f"/products/{product_id}?org_id={org_id}")
            product = resp.get("body", {}) or {}
        except Exception:
            pass

    p_title = product.get("title") or product_title or "Product"
    p_description = product.get("description") or product_description or ""
    p_price = product.get("price", 0.0)
    p_image_url = product.get("imageUrl") or product.get("image_url")

    # 2. Load brand brief for on-brand generation
    brief = await get_brief_for_org(org_id)
    brand_image_ctx = format_brief_for_image_prompt(brief) if brief else ""
    brand_copy_ctx = format_brief_for_copy_prompt(brief) if brief else ""

    # 3. Build image prompt
    style_prompt = _STYLE_PROMPTS.get(style, _STYLE_PROMPTS["lifestyle"])
    platform_spec = _PLATFORM_SPECS.get(platform, _PLATFORM_SPECS["meta"])

    image_prompt = (
        f"Professional advertisement for '{p_title}'. "
        f"{style_prompt}. "
        f"{'Price tag: $' + str(p_price) + '. ' if p_price else ''}"
        f"{('Brand context: ' + brand_image_ctx + '. ') if brand_image_ctx else ''}"
        f"Optimized for {platform} ads at {platform_spec['ratio']} ratio. "
        f"High quality, photorealistic, no text overlays."
    )

    # 4. Generate image via creative-service
    creative_url: Optional[str] = p_image_url  # fall back to product image
    try:
        img_resp = await creative_client.post("/generate-image", json={
            "prompt": image_prompt,
            "org_id": org_id,
            "product_id": product_id,
            "style": style,
            "platform": platform,
        })
        img_body = img_resp.get("body", {}) or {}
        creative_url = img_body.get("url") or img_body.get("creative_url") or creative_url
    except Exception:
        # creative-service not available — use product image or generate inline
        pass

    # 5. Generate copy via LiteLLM
    platform_limits = {
        "meta":   {"headline_max": 40, "desc_max": 125},
        "google": {"headline_max": 30, "desc_max": 90},
        "bing":   {"headline_max": 30, "desc_max": 90},
    }
    limits = platform_limits.get(platform, platform_limits["meta"])

    copy_prompt = f"""Write ad copy for this product:
Product: {p_title}
{('Description: ' + p_description[:200]) if p_description else ''}
{'Price: $' + str(p_price) if p_price else ''}
Platform: {platform}
{('Brand context:\n' + brand_copy_ctx) if brand_copy_ctx else ''}
{'Override headline: ' + headline if headline else ''}

Generate:
- headline: max {limits['headline_max']} chars, compelling and action-oriented
- short_headline: max 30 chars, punchy for display
- description: max {limits['desc_max']} chars, highlight key benefit
- cta: 2-3 words e.g. "Shop Now", "Get Yours", "Learn More"

Be specific to this product. No generic filler."""

    try:
        copy = await structured_llm_call(copy_prompt, AdCopy, model="haiku")
        if headline:
            copy.headline = headline
    except Exception:
        copy = AdCopy(
            headline=headline or f"Get {p_title}",
            description=f"Shop {p_title} today.",
            cta="Shop Now",
            short_headline=p_title[:30],
        )

    # 6. Build response
    metrics = [
        MetricItem(label="Headline", value=copy.headline),
        MetricItem(label="Description", value=copy.description),
        MetricItem(label="CTA", value=copy.cta),
        MetricItem(label="Platform", value=platform.capitalize()),
        MetricItem(label="Style", value=style.replace("_", " ").title()),
    ]
    if creative_url:
        metrics.insert(0, MetricItem(label="Creative", value="Generated"))

    return ToolResponse(
        summary=(
            f"Ad creative generated for '{p_title}' ({platform}, {style} style). "
            f"Headline: \"{copy.headline}\". "
            f"{'Image: ' + creative_url if creative_url else 'Image: using product image.'}"
        ),
        data={
            "creative_url": creative_url,
            "copy": copy.model_dump(),
            "product_id": product_id,
            "style": style,
            "platform": platform,
            "image_prompt": image_prompt,
        },
        ui_blocks=[metric_cards_block.create(data=MetricCardsData(
            metrics=metrics,
            title=f"Ad Creative — {p_title}",
        ))],
    ).model_dump()

generate_ad_creative = AgenticTool(
    func=_generate_ad_creative,
    thinking_messages=[
        "Generating ad creative...",
        "Creating image and copy...",
        "Building your ad...",
    ],
    tags=[ToolTag.CAMPAIGN],
    timeout=60,
)
