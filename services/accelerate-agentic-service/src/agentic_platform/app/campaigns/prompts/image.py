"""Image prompt builder — creative director-grade image generation prompts.

Ported from framework v2.
"""

from __future__ import annotations

from typing import Dict

from src.agentic_platform.app.campaigns.models import (
    WebsiteContent,
)
from src.agentic_platform.app.common.creative_context import (
    detect_vertical,
    build_audience_persona,
    build_scene_directive,
    parse_age_range,
    _VERTICAL_PLAYBOOK,
)


_AD_SAFETY_PREAMBLE = (
    "[CONTEXT: This is a professional product photograph for a commercial "
    "digital advertising campaign on Google/Bing ad platforms. The image "
    "must be brand-safe and suitable for all audiences.] "
)

QUALITY_SIGNATURE = (
    " Photorealistic, shot on a Hasselblad medium-format camera with a "
    "90mm lens, tack-sharp focus on the product, expertly sculpted "
    "directional lighting, rich colour depth, magazine-cover production "
    "quality. This must look like a real photograph from a premium ad "
    "campaign — not AI-generated."
    " STRICT RULE: The image must contain ZERO text, ZERO words, ZERO "
    "letters, ZERO numbers, ZERO logos, ZERO brand marks, ZERO symbols, "
    "ZERO watermarks, ZERO UI elements anywhere in the image. Do NOT "
    "hallucinate or invent any brand logo, label, tag, or emblem — the "
    "product should appear clean and unbranded in the image."
)

SLOT_SCENE_DIRECTIONS: Dict[str, str] = {
    "marketingImages": (
        "Create a stunning wide-format hero banner AD image — the kind of visual "
        "that stops a fast-scrolling user and compels them to click. "
        "Cinematic wide-angle composition with the product as the undeniable focal "
        "point, placed in a premium aspirational environment that communicates "
        "quality and appeal. Rich depth, dramatic lighting with a golden-hour or "
        "sculpted studio feel, shallow depth-of-field guiding the eye straight to "
        "the hero subject. This is a million-dollar campaign key visual."
    ),
    "squareMarketingImages": (
        "Create an attention-grabbing square AD image for social feeds that makes "
        "the viewer pause and think 'I want that'. "
        "The product owns the center of the frame — clean, elevated, compelling. "
        "Think luxury unboxing meets product editorial: exquisite lighting, creamy "
        "bokeh background, and a composition so balanced it feels iconic. Every "
        "pixel should convey premium quality. This image must convert browsers "
        "into buyers."
    ),
    "portraitMarketingImages": (
        "Create a tall, immersive vertical AD image built to dominate a mobile "
        "screen and capture attention instantly. Dramatic perspective with the "
        "product towering in the frame — bold, aspirational, impossible to swipe "
        "past. Cinematic depth-of-field, rich textures, dynamic angles that "
        "create a sense of premium scale. This is the image that turns "
        "impressions into sales."
    ),
    "images": (
        "Create a premium wide-format display banner AD image. A single, powerful "
        "visual story — the product elevated in a curated, atmospheric environment "
        "that communicates both quality and relevance. Balanced composition with "
        "intentional breathing room, soft directional light that highlights the "
        "subject. This image needs to earn attention in a sea of mediocre ads."
    ),
}

VARIATION_ANGLES = [
    (
        "Hero showcase",
        "Editorial product showcase shot designed to spark instant purchase intent. "
        "The product commands the frame like a jewel on velvet — precision studio "
        "lighting sculpts every contour, revealing quality and craftsmanship.",
    ),
    (
        "Lifestyle aspiration",
        "Aspirational lifestyle scene — the product in the setting your customer "
        "dreams of. Golden-hour warmth, shallow depth-of-field, a composition that "
        "feels candid yet impossibly stylish. Emotionally engaging, persuasive.",
    ),
    (
        "Mood editorial",
        "High-impact editorial mood piece — all emotion and brand essence distilled "
        "into a single frame. Bold colour washes, dramatic interplay of light and "
        "shadow, rich textures. The FEELING is the hero.",
    ),
    (
        "Craft close-up",
        "Extreme macro product shot that reveals the soul of the product — every "
        "material, texture, and detail celebrates quality. Dramatic raking light, "
        "creamy bokeh. Makes premium feel tangible.",
    ),
]

_HEX_COLOR_NAMES: Dict[str, str] = {
    "#000000": "deep black", "#ffffff": "pure white", "#ff0000": "vivid red",
    "#00ff00": "electric green", "#0000ff": "cobalt blue", "#ffff00": "bright yellow",
    "#ff6600": "burnt orange", "#800080": "regal purple", "#b8860b": "dark golden",
    "#c0c0c0": "polished silver", "#ffd700": "rich gold", "#8b4513": "warm saddle brown",
    "#2e8b57": "sea green", "#4169e1": "royal blue", "#dc143c": "deep crimson",
    "#ff69b4": "hot pink", "#00ced1": "teal turquoise", "#2f4f4f": "dark slate",
}


def _hex_to_visual_name(hex_color: str) -> str:
    normalized = hex_color.strip().lower()
    if normalized in _HEX_COLOR_NAMES:
        return _HEX_COLOR_NAMES[normalized]
    try:
        hex_clean = normalized.lstrip("#")
        r, g, b = int(hex_clean[:2], 16), int(hex_clean[2:4], 16), int(hex_clean[4:6], 16)
        if r > 180 and g < 100 and b < 100:
            return "warm red"
        elif r > 180 and g > 150 and b < 100:
            return "warm golden"
        elif r < 100 and g < 100 and b > 180:
            return "cool blue"
        elif r < 100 and g > 180 and b < 100:
            return "fresh green"
        elif r > 200 and g > 200 and b > 200:
            return "light neutral"
        elif r < 60 and g < 60 and b < 60:
            return "deep dark"
        else:
            return "rich toned"
    except (ValueError, IndexError):
        return "brand-toned"


def build_image_prompt(
    description: str,
    slot_name: str,
    brand_context: str,
    website: WebsiteContent,
    variation_index: int = 0,
    image_style: str = "",
    image_mood: str = "",
    brand_colors: list[str] | None = None,
    aspect_ratio: str = "",
    # Audience context — enables contextual lifestyle scene generation
    audience_age_min: int = 0,
    audience_age_max: int = 0,
    audience_gender: str = "",
    audience_locations: list[str] | None = None,
    product_category: str = "",    # pre-classified category hint from catalog
) -> str:
    """Build a creative director-grade image generation prompt."""
    # ── Contextual scene generation ───────────────────────────────
    # When audience data is available, build a specific lifestyle scene directive
    # (person + setting + mood) rather than a generic product-on-background prompt.
    has_audience = bool(audience_age_min or audience_age_max or audience_gender or audience_locations)
    vertical = detect_vertical(description, product_category)
    playbook = _VERTICAL_PLAYBOOK.get(vertical, _VERTICAL_PLAYBOOK["general"])

    if has_audience and playbook["needs_person"]:
        age_min = audience_age_min or 18
        age_max = audience_age_max or 35
        persona, location_code = build_audience_persona(
            age_min, age_max, audience_gender, list(audience_locations or [])
        )
        scene_dir = build_scene_directive(description, vertical, persona, location_code)
    elif has_audience and not playbook["needs_person"]:
        # Home/interior vertical — use location-aware setting but no person
        _, location_code = build_audience_persona(0, 0, "", list(audience_locations or []))
        scene_dir = build_scene_directive(description, vertical, "", location_code)
    else:
        # No audience data — fall back to existing slot-based directions
        scene_dir = SLOT_SCENE_DIRECTIONS.get(
            slot_name,
            "Create a premium advertising image that demands attention and drives action.",
        )
    _, angle_desc = VARIATION_ANGLES[variation_index % len(VARIATION_ANGLES)]

    prompt = _AD_SAFETY_PREAMBLE + scene_dir

    # Product subject
    prompt += f" Subject: {description}."

    # Brand context
    if website.metadata.title:
        prompt += f" Brand: {website.metadata.title}."

    # Visual palette — user colors override scraped colors
    if brand_colors:
        color_names = [_hex_to_visual_name(c) for c in brand_colors[:5]]
        prompt += f" Visual DNA: colour story built around {', '.join(color_names)}."
    else:
        color_parts = []
        if website.metadata.theme_color:
            color_parts.append(f"{_hex_to_visual_name(website.metadata.theme_color)} as hero accent")
        for color in website.metadata.brand_colors[:3]:
            name = _hex_to_visual_name(color)
            if name not in [c.split(" as")[0] for c in color_parts]:
                color_parts.append(name)
        if color_parts:
            prompt += f" Visual DNA: colour story built around {', '.join(color_parts)}."

    # Creative style — user style overrides default if provided
    if image_style:
        prompt += f" MANDATORY STYLE: {image_style}. All imagery must follow this style."

    # Mood — emotional direction for the image
    if image_mood:
        prompt += f" Mood: {image_mood}."

    # Crop-safe framing (for ratios that need post-generation cropping)
    if slot_name == "marketingImages":
        prompt += (
            " COMPOSITION FRAMING (CRITICAL): The bottom ~7% of this image will "
            "be cropped off. Place the main product/subject in the UPPER THIRD of "
            "the frame — keep ALL important elements well above the bottom 15%. "
            "Fill the bottom with extra environment or background."
        )
    elif slot_name == "portraitMarketingImages" and aspect_ratio == "1:2":
        prompt += (
            " COMPOSITION FRAMING (CRITICAL): This is an extra-tall 1:2 vertical "
            "image — significant height will be cropped from sides. Center the "
            "product horizontally with at least 15% padding on left and right. "
            "Use the tall format to create dramatic vertical scale."
        )
    elif slot_name == "portraitMarketingImages":
        prompt += (
            " COMPOSITION FRAMING (CRITICAL): This image will be slightly cropped "
            "on the sides. Keep the subject vertically centered with at least 5% "
            "padding on all edges."
        )

    # Creative variation angle
    prompt += f" Creative direction: {angle_desc}"

    # Quality signature + anti-hallucination
    prompt += QUALITY_SIGNATURE

    return prompt


def build_negative_prompt() -> str:
    """Standard negative prompt for ad image generation."""
    return (
        "text, words, letters, numbers, logos, brand logos, brand marks, emblems, "
        "labels, tags, stickers, badges, icons, symbols, watermarks, overlays, "
        "borders, frames, UI elements, buttons, hallucinated logos, invented brand "
        "names, fake labels, made-up text, nudity, suggestive content, "
        "low quality, blurry, pixelated, noise, cartoon, illustration, 3D render, "
        "CGI, digital art, stock photo watermark, cluttered composition, "
        "color change, recolored product, altered colors, modified product appearance"
    )


# ── Size mapping ──────────────────────────────────────────────────

ASPECT_RATIO_TO_SIZE: Dict[str, str] = {
    "1.91:1": "1536x1024",   # provider generates 3:2, cropped to 1.91:1 post-gen
    "1:1": "1024x1024",
    "4:5": "1024x1536",      # provider generates 2:3, cropped to 4:5 post-gen
    "1:2": "1024x1536",      # provider generates 2:3, cropped to 1:2 post-gen (Microsoft vertical)
    "16:9": "1536x1024",
}


def ratio_to_size(ratio: str) -> str:
    """Convert aspect ratio string to image generation size."""
    return ASPECT_RATIO_TO_SIZE.get(ratio, "1024x1024")
