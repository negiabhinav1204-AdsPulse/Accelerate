"""Brand intelligence module for Accelera AI.

Provides company brief generation and brand guideline injection.
Used by creative generation, media planning, and copy generation tools.
"""

from src.agentic_platform.app.accelera.brand.company_brief import (
    CompanyBrief,
    generate_company_brief,
    get_brief_for_org,
    store_brief_for_org,
    format_brief_for_image_prompt,
    format_brief_for_copy_prompt,
    format_brief_for_variant_prompt,
)
from src.agentic_platform.app.accelera.brand.guidelines import get_brand_context

__all__ = [
    "CompanyBrief",
    "generate_company_brief",
    "get_brief_for_org",
    "store_brief_for_org",
    "format_brief_for_image_prompt",
    "format_brief_for_copy_prompt",
    "format_brief_for_variant_prompt",
    "get_brand_context",
]
