"""Audience domain models — segments, targeting, lookalikes."""

from typing import Optional, Any
from pydantic import BaseModel


class AudienceSegment(BaseModel):
    id: str
    name: str
    type: str                          # "custom", "lookalike", "saved"
    subtype: Optional[str] = None      # "customer_list", "website", "catalog"
    estimated_size: int = 0
    status: str = "ready"              # "ready", "syncing", "error"
    platform: str = "meta"
    created_at: Optional[str] = None
    source_id: Optional[str] = None    # for lookalikes: ID of source audience


class TargetingRecommendation(BaseModel):
    geo: list[str] = []
    age_range: Optional[str] = None
    gender: str = "all"
    interests: list[str] = []
    aov_segment: str = ""              # "high_value", "mid_tier", "low_value"
    ltv_estimate: float = 0.0
    rationale: str = ""


class LocationKey(BaseModel):
    name: str
    key: str                           # Meta geo-targeting key
    type: str = "region"               # "country", "region", "city"


# Hardcoded region keys (ported from Next.js REGION_KEYS)
REGION_KEYS: dict[str, LocationKey] = {
    "california": LocationKey(name="California", key="US-CA", type="region"),
    "new york": LocationKey(name="New York", key="US-NY", type="region"),
    "texas": LocationKey(name="Texas", key="US-TX", type="region"),
    "florida": LocationKey(name="Florida", key="US-FL", type="region"),
    "illinois": LocationKey(name="Illinois", key="US-IL", type="region"),
    "united states": LocationKey(name="United States", key="US", type="country"),
    "canada": LocationKey(name="Canada", key="CA", type="country"),
    "united kingdom": LocationKey(name="United Kingdom", key="GB", type="country"),
    "australia": LocationKey(name="Australia", key="AU", type="country"),
    "india": LocationKey(name="India", key="IN", type="country"),
    "london": LocationKey(name="London", key="GB-ENG-GB6", type="city"),
    "toronto": LocationKey(name="Toronto", key="CA-ON-483", type="city"),
    "new york city": LocationKey(name="New York City", key="US-NY-501", type="city"),
    "los angeles": LocationKey(name="Los Angeles", key="US-CA-803", type="city"),
    "sydney": LocationKey(name="Sydney", key="AU-NSW-510", type="city"),
}
