"""Text asset schemas and sanitisation for Google & Bing ad templates."""

import re
from enum import Enum
from typing import Annotated, Dict, List, Type

from pydantic import BaseModel, Field, StringConstraints, model_validator

from .enums import (
    BingCallToAction,
    GoogleCallToAction,
    TemplateType,
)


# ── Ad text sanitisation ──────────────────────────────────────────

_ALLOWED_CAPS: frozenset = frozenset({
    "USA", "UK", "US", "EU", "UAE", "AI", "SEO", "SEM", "PPC", "CPC",
    "CPM", "ROI", "CTA", "API", "CEO", "CFO", "CTO", "VP", "HR", "IT",
    "PR", "TV", "DIY", "FAQ", "LED", "GPS", "BMW", "IBM", "NBA", "NFL",
    "NASA", "HVAC", "B2B", "B2C", "USD", "GBP", "EUR", "INR", "CAD",
    "AUD", "AM", "PM", "OK",
})


def fix_excessive_capitalization(text: str) -> str:
    """Normalize ALL-CAPS words (3+ letters) to title case, preserving known acronyms."""
    if not text:
        return text
    words = text.split()
    fixed = []
    for word in words:
        alpha = "".join(c for c in word if c.isalpha())
        if len(alpha) >= 3 and alpha.isupper() and alpha not in _ALLOWED_CAPS:
            fixed.append(word.capitalize())
        else:
            fixed.append(word)
    return " ".join(fixed)


_AD_TEXT_DISALLOWED_RE = re.compile(r"[^a-zA-Z0-9.,\-'\"\s]")
_MULTI_SPACE_RE = re.compile(r"\s+")
_SKIP_FIELDS = frozenset({"finalUrl", "finalUrlSuffix"})


def sanitize_ad_text(text: str) -> str:
    """Strip disallowed characters and fix excessive capitalization."""
    text = fix_excessive_capitalization(text)
    text = _AD_TEXT_DISALLOWED_RE.sub("", text)
    text = _MULTI_SPACE_RE.sub(" ", text).strip()
    return text


# ── Text asset base ──────────────────────────────────────────────

Str25 = Annotated[str, StringConstraints(max_length=25)]
Str30 = Annotated[str, StringConstraints(max_length=30)]
Str90 = Annotated[str, StringConstraints(max_length=90)]
Str100 = Annotated[str, StringConstraints(max_length=100)]


class TextAssetBase(BaseModel):
    """Base for all text asset models. Auto-sanitises text fields."""
    finalUrl: str = Field(..., max_length=2048)

    @model_validator(mode="after")
    def _sanitize_text_fields(self) -> "TextAssetBase":
        for field_name in self.model_fields:
            if field_name in _SKIP_FIELDS:
                continue
            value = getattr(self, field_name)
            if isinstance(value, Enum):
                continue
            if isinstance(value, str):
                setattr(self, field_name, sanitize_ad_text(value))
            elif isinstance(value, list) and value and isinstance(value[0], str):
                setattr(self, field_name, [sanitize_ad_text(v) for v in value])
        return self


# ── Google text assets ────────────────────────────────────────────

class GoogleResponsiveDisplayAdTextAssets(TextAssetBase):
    businessName: str = Field(..., max_length=25)
    longHeadline: str = Field(..., max_length=90)
    headlines: List[Str30] = Field(..., min_length=1, max_length=5)
    descriptions: List[Str90] = Field(..., min_length=1, max_length=5)
    callToAction: GoogleCallToAction


class GoogleResponsiveSearchAdTextAssets(TextAssetBase):
    headlines: List[Str30] = Field(..., min_length=3, max_length=15)
    descriptions: List[Str90] = Field(..., min_length=2, max_length=4)
    path1: str | None = Field(default=None, max_length=15)
    path2: str | None = Field(default=None, max_length=15)


class GooglePerformanceMaxTextAssets(TextAssetBase):
    headlines: List[Str30] = Field(..., min_length=3, max_length=15)
    longHeadline: List[Str90] = Field(..., min_length=1, max_length=5)
    descriptions: List[Str90] = Field(..., min_length=2, max_length=5)
    businessName: str = Field(..., max_length=25)


# ── Bing text assets ─────────────────────────────────────────────

class BingResponsiveSearchAdTextAssets(TextAssetBase):
    headlines: List[Str30] = Field(..., min_length=3, max_length=15)
    descriptions: List[Str90] = Field(..., min_length=2, max_length=4)
    path1: str | None = Field(default=None, max_length=15)
    path2: str | None = Field(default=None, max_length=15)


class BingResponsiveDisplayAdTextAssets(TextAssetBase):
    """Bing Display — only finalUrl required; text is managed by Bing."""
    pass


class BingPerformanceMaxTextAssets(TextAssetBase):
    headlines: List[Str30] = Field(..., min_length=3, max_length=3)
    longHeadline: List[Str90] = Field(..., min_length=1, max_length=5)
    descriptions: List[Str90] = Field(..., min_length=2, max_length=2)
    businessName: str = Field(..., max_length=25)
    assetGroupSearchThemes: List[Str100] = Field(default_factory=list, max_length=25)
    callToAction: BingCallToAction | None = None
    finalUrlSuffix: str | None = Field(default=None, max_length=500)


# ── Template → schema registry ───────────────────────────────────

TEMPLATE_TEXT_ASSET_MAP: Dict[str, Type[TextAssetBase]] = {
    TemplateType.GOOGLE_RESPONSIVE_DISPLAY_AD: GoogleResponsiveDisplayAdTextAssets,
    TemplateType.GOOGLE_RESPONSIVE_SEARCH_AD: GoogleResponsiveSearchAdTextAssets,
    TemplateType.GOOGLE_PERFORMANCE_MAX: GooglePerformanceMaxTextAssets,
    TemplateType.BING_RESPONSIVE_SEARCH_AD: BingResponsiveSearchAdTextAssets,
    TemplateType.BING_RESPONSIVE_DISPLAY_AD: BingResponsiveDisplayAdTextAssets,
    TemplateType.BING_PERFORMANCE_MAX: BingPerformanceMaxTextAssets,
}

# Image slot specs per template — maps template → list of (slot_name, aspect_ratio, max_count)
TEMPLATE_IMAGE_SLOTS: Dict[str, list[tuple[str, str, int]]] = {
    # Google Display: landscape + square (logos via favicon in save step)
    TemplateType.GOOGLE_RESPONSIVE_DISPLAY_AD: [
        ("marketingImages", "1.91:1", 3),
        ("squareMarketingImages", "1:1", 3),
    ],
    # Google PMax: landscape + square + portrait (4:5 per Google spec)
    TemplateType.GOOGLE_PERFORMANCE_MAX: [
        ("marketingImages", "1.91:1", 3),
        ("squareMarketingImages", "1:1", 3),
        ("portraitMarketingImages", "4:5", 2),
    ],
    # Bing Display: landscape only
    TemplateType.BING_RESPONSIVE_DISPLAY_AD: [
        ("images", "1.91:1", 1),
    ],
    # Bing PMax: landscape + square + vertical (1:2 per Microsoft spec, NOT 4:5)
    TemplateType.BING_PERFORMANCE_MAX: [
        ("marketingImages", "1.91:1", 3),
        ("squareMarketingImages", "1:1", 3),
        ("portraitMarketingImages", "1:2", 2),
    ],
    # Search templates have no image slots
    TemplateType.GOOGLE_RESPONSIVE_SEARCH_AD: [],
    TemplateType.BING_RESPONSIVE_SEARCH_AD: [],
}
