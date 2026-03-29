"""Prompts for the campaign creation pipeline.

Three prompt types:
1. Strategy prompt — one LLM call to plan all campaigns
2. Text asset prompt — per-template focused call for ad copy
3. Image prompt builder — creative director-grade image generation prompts

Re-exports everything from submodules so existing imports work unchanged.
"""

from src.agentic_platform.app.campaigns.prompts.strategy import (
    build_strategy_prompt,
)

from src.agentic_platform.app.campaigns.prompts.text_assets import (
    build_text_asset_prompt,
)

from src.agentic_platform.app.campaigns.prompts.image import (
    _AD_SAFETY_PREAMBLE,
    QUALITY_SIGNATURE,
    SLOT_SCENE_DIRECTIONS,
    VARIATION_ANGLES,
    _HEX_COLOR_NAMES,
    _hex_to_visual_name,
    build_image_prompt,
    build_negative_prompt,
    ASPECT_RATIO_TO_SIZE,
    ratio_to_size,
)

from src.agentic_platform.app.campaigns.prompts.analysis import (
    AnalysisPrompts,
)

from src.agentic_platform.app.campaigns.prompts.plan import (
    MediaPlanPrompts,
)

from src.agentic_platform.app.campaigns.prompts.enrichment import (
    enrich_slim_plan,
    enrich_campaign_plan,
)

__all__ = [
    # strategy
    "build_strategy_prompt",
    # text_assets
    "build_text_asset_prompt",
    # image
    "_AD_SAFETY_PREAMBLE",
    "QUALITY_SIGNATURE",
    "SLOT_SCENE_DIRECTIONS",
    "VARIATION_ANGLES",
    "_HEX_COLOR_NAMES",
    "_hex_to_visual_name",
    "build_image_prompt",
    "build_negative_prompt",
    "ASPECT_RATIO_TO_SIZE",
    "ratio_to_size",
    # analysis
    "AnalysisPrompts",
    # plan
    "MediaPlanPrompts",
    # enrichment
    "enrich_slim_plan",
    "enrich_campaign_plan",
]
