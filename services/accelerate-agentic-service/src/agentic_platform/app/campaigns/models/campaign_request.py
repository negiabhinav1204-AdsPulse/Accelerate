"""Campaign-service request models (ported from v2).

Exact Pydantic models from v2/models/campaign/ — these serialize to the
JSON shape campaign-service expects via model_dump(mode="json", exclude_none=True).
Field names are camelCase (matching campaign-service Java DTOs).
"""

from typing import Dict, List, Optional

from pydantic import BaseModel, Field

from .enums import (
    AdGroupTargetingType,
    AssetGroupStatus,
    BudgetType,
    CampaignTargetingType,
    CampaignType,
    PlatformType,
    SlotDataOperation,
    TemplateType,
)


class CampaignTargetingRequest(BaseModel):
    criterionId: Optional[str] = None
    name: Optional[str] = None
    isNegative: bool = False
    bidAmount: Optional[float] = None
    matchType: Optional[str] = None
    text: Optional[str] = None


class AdGroupTargetingRequest(BaseModel):
    criterionId: Optional[str] = None
    name: Optional[str] = None
    isNegative: bool = False
    bidAmount: Optional[float] = None
    matchType: Optional[str] = None
    text: Optional[str] = None


class BudgetRequest(BaseModel):
    name: Optional[str] = None
    amount: Optional[float] = None
    currency: Optional[str] = None
    budgetType: Optional[BudgetType] = None
    isShared: Optional[bool] = None


class SlotDataUpdateEntry(BaseModel):
    operation: Optional[SlotDataOperation] = None
    id: Optional[str] = None
    slotName: Optional[str] = None
    value: Optional[str] = None


class AdRequest(BaseModel):
    name: Optional[str] = None
    templateType: Optional[TemplateType] = None
    templateId: Optional[str] = None
    slotData: Optional[Dict[str, List[str]]] = None


class AdGroupRequest(BaseModel):
    name: Optional[str] = None
    type: Optional[str] = None
    budget: Optional[BudgetRequest] = None
    ads: Optional[List[AdRequest]] = None
    targeting: Optional[Dict[AdGroupTargetingType, List[AdGroupTargetingRequest]]] = None


class AssetGroupRequest(BaseModel):
    name: Optional[str] = None
    status: Optional[AssetGroupStatus] = None
    templateId: Optional[str] = None
    templateType: Optional[TemplateType] = None
    slotData: Optional[Dict[str, List[str]]] = None
    slotDataUpdates: Optional[List[SlotDataUpdateEntry]] = None


class CampaignRequest(BaseModel):
    """Root payload for campaign-service POST /api/v3/media-plan/{id}/campaign.

    Exact port of v2/models/campaign/campaign_request.py.
    Serialize with: model_dump(mode="json", exclude_none=True)
    """
    name: Optional[str] = None
    platformType: Optional[PlatformType] = None
    campaignType: Optional[CampaignType] = None
    startDate: Optional[str] = Field(default=None, description="YYYY-MM-DD")
    endDate: Optional[str] = Field(default=None, description="YYYY-MM-DD")
    budget: Optional[BudgetRequest] = None
    adGroups: Optional[List[AdGroupRequest]] = None
    assetGroups: Optional[List[AssetGroupRequest]] = None
    targeting: Optional[Dict[CampaignTargetingType, List[CampaignTargetingRequest]]] = None
    clientReferenceKey: Optional[str] = None
    tags: Optional[Dict[str, str]] = None
