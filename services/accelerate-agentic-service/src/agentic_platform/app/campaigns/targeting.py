"""Static targeting criterion ID mappings and resolve function.

Converts human-readable targeting names (from the strategy LLM call)
into platform-specific criterion IDs for the campaign-service payload.
Pure data + pure functions — no network I/O, no LLM calls.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Dict, List, Literal

from src.agentic_platform.app.campaigns.models import TemplateType


# ── Targeting models ──────────────────────────────────────────────

@dataclass
class TargetingCriterion:
    criterion_id: str
    name: str
    type: str  # "GEO" | "AGE" | "GENDER" | "LANGUAGE" | "KEYWORD"
    is_negative: bool = False
    match_type: str | None = None  # for keywords: EXACT | PHRASE | BROAD


# ── Geo criterion IDs ────────────────────────────────────────────

_LOCATION_ALIASES: Dict[str, str] = {
    "usa": "united states", "us": "united states", "america": "united states",
    "u.s.": "united states", "u.s.a.": "united states",
    "uk": "united kingdom", "britain": "united kingdom",
    "great britain": "united kingdom", "england": "united kingdom", "gb": "united kingdom",
    "bangalore": "bengaluru", "bombay": "mumbai",
    "calcutta": "kolkata", "madras": "chennai",
    "uae": "united arab emirates", "holland": "netherlands",
    # ISO country codes — LLMs often return these
    "in": "india", "de": "germany", "fr": "france", "au": "australia",
    "ca": "canada", "es": "spain", "it": "italy", "nl": "netherlands",
    "br": "brazil", "jp": "japan", "sg": "singapore",
}

GOOGLE_GEO_IDS: Dict[str, int] = {
    "united states": 2840, "india": 2356, "united kingdom": 2826,
    "germany": 2276, "france": 2250, "australia": 2036, "canada": 2124,
    "spain": 2724, "italy": 2380, "netherlands": 2528, "brazil": 2076,
    "japan": 2392, "singapore": 2702, "united arab emirates": 2784,
    # Indian cities
    "mumbai": 1007785, "delhi": 1007751, "bengaluru": 1007768,
    "chennai": 1007809, "kolkata": 1007828, "hyderabad": 1007740,
    "pune": 1007788, "ahmedabad": 1007753,
    # US cities
    "new york": 1023191, "los angeles": 1013962, "chicago": 1016367,
    "houston": 1024481, "phoenix": 1013462,
    # UK cities
    "london": 1006886, "manchester": 1006912, "birmingham": 1006524,
    # German cities
    "berlin": 1003854, "munich": 1004234, "hamburg": 1004437,
    # Australian cities
    "sydney": 1000286, "melbourne": 1000567, "brisbane": 1000339,
    # Canadian cities
    "toronto": 1002451, "vancouver": 1001970, "montreal": 1002604,
}

BING_GEO_IDS: Dict[str, int] = {
    "united states": 190, "india": 90, "united kingdom": 188,
    "germany": 74, "france": 68, "australia": 13, "canada": 35,
    "spain": 159, "italy": 94, "netherlands": 129, "brazil": 30,
    "japan": 97, "singapore": 154, "united arab emirates": 187,
    # Indian cities
    "mumbai": 116073, "bengaluru": 116072, "delhi": 116071,
    "chennai": 100703, "hyderabad": 116074, "kolkata": 116075,
    "pune": 99938, "ahmedabad": 99658,
    # US cities
    "new york": 59981, "los angeles": 44152, "chicago": 48792,
    "houston": 65739, "phoenix": 43466,
    # UK cities
    "london": 41471, "manchester": 41473, "birmingham": 40860,
    # German cities
    "berlin": 116076, "munich": 116078, "hamburg": 116080,
    # Australian cities
    "sydney": 112363, "melbourne": 112413, "brisbane": 112372,
    # Canadian cities
    "toronto": 5254, "vancouver": 5064, "montreal": 5433,
}


# ── Age criterion IDs ────────────────────────────────────────────

GOOGLE_AGE_IDS: Dict[str, int] = {
    "18-24": 503001, "25-34": 503002, "35-44": 503003,
    "45-54": 503004, "55-64": 503005, "65+": 503006,
}

BING_AGE_IDS: Dict[str, str] = {
    "18-24": "EighteenToTwentyFour",
    "25-34": "TwentyFiveToThirtyFour",
    "35-44": "ThirtyFiveToFourtyNine",
    "45-54": "FiftyToSixtyFour",
    "55-64": "FiftyToSixtyFour",
    "65+": "SixtyFiveAndAbove",
}

_AGE_BUCKETS = [
    ("18-24", 18, 24), ("25-34", 25, 34), ("35-44", 35, 44),
    ("45-54", 45, 54), ("55-64", 55, 64), ("65+", 65, 120),
]


# ── Gender criterion IDs ─────────────────────────────────────────

GOOGLE_GENDER_IDS: Dict[str, int] = {
    "male": 10, "female": 11, "undetermined": 20, "other": 20,
}

BING_GENDER_IDS: Dict[str, int] = {
    "male": 1, "female": 2, "unknown": 3,
}


# ── Language criterion IDs ────────────────────────────────────────

GOOGLE_LANGUAGE_IDS: Dict[str, str] = {
    "english": "en", "hindi": "hi", "spanish": "es", "french": "fr",
    "german": "de", "portuguese": "pt", "japanese": "ja", "korean": "ko",
    "chinese": "zh", "arabic": "ar", "russian": "ru", "italian": "it",
    "dutch": "nl", "turkish": "tr", "thai": "th", "vietnamese": "vi",
}

# Bing uses "All" for language targeting
BING_LANGUAGE_ID = "All"


# ── Targeting distribution matrix ────────────────────────────────
# Which targeting types sit at campaign vs ad-group level per template.

@dataclass(frozen=True)
class TargetingDistribution:
    campaign_level: frozenset[str]
    ad_group_level: frozenset[str]


TARGETING_MATRIX: Dict[str, TargetingDistribution] = {
    TemplateType.GOOGLE_RESPONSIVE_SEARCH_AD: TargetingDistribution(
        campaign_level=frozenset({"GEO", "LANGUAGE"}),
        ad_group_level=frozenset({"GENDER", "AGE", "KEYWORD"}),
    ),
    TemplateType.GOOGLE_RESPONSIVE_DISPLAY_AD: TargetingDistribution(
        campaign_level=frozenset({"GEO", "LANGUAGE"}),
        ad_group_level=frozenset({"GENDER", "AGE"}),
    ),
    TemplateType.GOOGLE_PERFORMANCE_MAX: TargetingDistribution(
        campaign_level=frozenset({"GEO", "LANGUAGE"}),
        ad_group_level=frozenset(),
    ),
    TemplateType.BING_RESPONSIVE_SEARCH_AD: TargetingDistribution(
        campaign_level=frozenset({"LANGUAGE"}),
        ad_group_level=frozenset({"GEO", "GENDER", "AGE", "KEYWORD"}),
    ),
    TemplateType.BING_RESPONSIVE_DISPLAY_AD: TargetingDistribution(
        campaign_level=frozenset({"LANGUAGE"}),
        ad_group_level=frozenset({"GEO", "GENDER", "AGE"}),
    ),
    TemplateType.BING_PERFORMANCE_MAX: TargetingDistribution(
        campaign_level=frozenset({"GEO", "LANGUAGE"}),
        ad_group_level=frozenset(),
    ),
}


# ── Keyword sanitisation ─────────────────────────────────────────

_CURRENCY_REPLACEMENTS: Dict[str, str] = {
    "$": " dollar ", "₹": " rupee ", "€": " euro ",
    "£": " pound ", "¥": " yen ", "%": " percent ",
}
_INVALID_KW_RE = re.compile(r"[!@%^*={};\[\]()`<>?\\|~,]")
_MULTI_SPACE_KW_RE = re.compile(r"\s+")
MAX_KEYWORD_LENGTH = 80
MAX_KEYWORD_WORDS = 10


def sanitize_keyword(text: str) -> str:
    """Clean keyword text for Google/Bing compliance."""
    for symbol, replacement in _CURRENCY_REPLACEMENTS.items():
        text = text.replace(symbol, replacement)
    text = text.lower()
    text = _INVALID_KW_RE.sub("", text)
    text = _MULTI_SPACE_KW_RE.sub(" ", text).strip()
    if len(text) > MAX_KEYWORD_LENGTH:
        text = text[:MAX_KEYWORD_LENGTH].strip()
    words = text.split()
    if len(words) > MAX_KEYWORD_WORDS:
        text = " ".join(words[:MAX_KEYWORD_WORDS])
    return text


# ── Resolve functions ─────────────────────────────────────────────

def _normalize_location(name: str) -> str:
    normalized = name.strip().lower()
    return _LOCATION_ALIASES.get(normalized, normalized)


def resolve_geo(
    countries: list[str], platform: str,
) -> list[TargetingCriterion]:
    """Resolve country/city names to platform-specific geo criterion IDs."""
    lookup = GOOGLE_GEO_IDS if platform.upper() == "GOOGLE" else BING_GEO_IDS
    result = []
    for name in countries:
        normalized = _normalize_location(name)
        cid = lookup.get(normalized)
        if cid is not None:
            result.append(TargetingCriterion(
                criterion_id=str(cid), name=name, type="GEO",
            ))
    return result


def _expand_age_range(age_str: str) -> list[str]:
    """Expand an age range like '25-44' into standard buckets ['25-34', '35-44'].

    Also handles LLM formats like 'AGE_RANGE_25_34', '25_34', '25 to 34'.
    """
    age_str = age_str.strip()
    # Already a standard bucket
    if age_str in {b[0] for b in _AGE_BUCKETS}:
        return [age_str]
    # Handle LLM format: AGE_RANGE_25_34 → 25-34
    normalized = re.sub(r"^AGE_RANGE_", "", age_str, flags=re.I)
    normalized = normalized.replace("_", "-")
    if normalized in {b[0] for b in _AGE_BUCKETS}:
        return [normalized]
    # Try to parse as range
    m = re.match(r"(\d+)\s*[-–]\s*(\d+)", normalized)
    if not m:
        if normalized.endswith("+"):
            try:
                min_age = int(normalized.rstrip("+"))
                return [b[0] for b in _AGE_BUCKETS if b[2] >= min_age]
            except ValueError:
                return []
        return []
    low, high = int(m.group(1)), int(m.group(2))
    return [b[0] for b in _AGE_BUCKETS if b[1] <= high and b[2] >= low]


def resolve_age(
    age_ranges: list[str], platform: str,
) -> list[TargetingCriterion]:
    """Resolve age range strings to criterion IDs."""
    lookup = GOOGLE_AGE_IDS if platform.upper() == "GOOGLE" else BING_AGE_IDS
    result = []
    seen = set()
    for age_str in age_ranges:
        for bucket in _expand_age_range(age_str):
            if bucket in seen:
                continue
            seen.add(bucket)
            cid = lookup.get(bucket)
            if cid is not None:
                result.append(TargetingCriterion(
                    criterion_id=str(cid), name=bucket, type="AGE",
                ))
    return result


def resolve_gender(
    genders: list[str], platform: str,
) -> list[TargetingCriterion]:
    """Resolve gender strings to criterion IDs."""
    lookup = GOOGLE_GENDER_IDS if platform.upper() == "GOOGLE" else BING_GENDER_IDS
    result = []
    for g in genders:
        cid = lookup.get(g.strip().lower())
        if cid is not None:
            result.append(TargetingCriterion(
                criterion_id=str(cid), name=g, type="GENDER",
            ))
    return result


def resolve_language(
    languages: list[str], platform: str,
) -> list[TargetingCriterion]:
    """Resolve language names to criterion IDs."""
    if platform.upper() == "BING":
        return [TargetingCriterion(criterion_id=BING_LANGUAGE_ID, name="All", type="LANGUAGE")]
    result = []
    for lang in languages:
        cid = GOOGLE_LANGUAGE_IDS.get(lang.strip().lower())
        if cid is not None:
            result.append(TargetingCriterion(criterion_id=cid, name=lang, type="LANGUAGE"))
    if not result:
        result.append(TargetingCriterion(criterion_id="en", name="English", type="LANGUAGE"))
    return result


def resolve_keywords(
    keywords: list[str], match_type: str = "BROAD",
) -> list[TargetingCriterion]:
    """Sanitise and wrap keywords as targeting criteria."""
    result = []
    for kw in keywords:
        sanitized = sanitize_keyword(kw)
        if sanitized:
            result.append(TargetingCriterion(
                criterion_id="", name=sanitized, type="KEYWORD",
                match_type=match_type.upper(),
            ))
    return result


def resolve_all_targeting(
    campaign_intent: dict, platform: str,
) -> tuple[list[TargetingCriterion], list[TargetingCriterion]]:
    """Resolve all targeting for a campaign and split into campaign/ad-group level.

    Returns (campaign_targeting, ad_group_targeting).
    """
    template_type = campaign_intent.get("template_type", "")
    distribution = TARGETING_MATRIX.get(template_type)
    if not distribution:
        return [], []

    all_targeting: Dict[str, list[TargetingCriterion]] = {}
    all_targeting["GEO"] = resolve_geo(campaign_intent.get("target_countries", []), platform)
    all_targeting["AGE"] = resolve_age(campaign_intent.get("target_age_ranges", []), platform)
    all_targeting["GENDER"] = resolve_gender(campaign_intent.get("target_genders", []), platform)
    all_targeting["LANGUAGE"] = resolve_language(campaign_intent.get("target_languages", []), platform)
    all_targeting["KEYWORD"] = resolve_keywords(campaign_intent.get("keywords", []))

    campaign_level = []
    ad_group_level = []
    for targeting_type, criteria in all_targeting.items():
        if targeting_type in distribution.campaign_level:
            campaign_level.extend(criteria)
        elif targeting_type in distribution.ad_group_level:
            ad_group_level.extend(criteria)

    return campaign_level, ad_group_level
