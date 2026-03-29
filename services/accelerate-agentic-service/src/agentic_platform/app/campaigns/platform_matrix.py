"""Platform capability matrix — single source of truth for supported combos.

Platform → CampaignType → TemplateType. Used by the strategy prompt to tell
the LLM which campaigns are valid, and by the pipeline to filter connections.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Set

from src.agentic_platform.app.campaigns.models import (
    CampaignType,
    ConnectedPlatform,
    ConnectionsResponse,
    PlatformType,
    TemplateType,
)


@dataclass
class CampaignTypeConfig:
    available_templates: Set[TemplateType]
    supported_templates: Set[TemplateType]
    supported: bool = False

    @property
    def is_supported(self) -> bool:
        return self.supported and len(self.supported_templates) > 0


class PlatformCapabilityMatrix:
    """Complete capability matrix: Platform → CampaignType → Templates."""

    _MATRIX: Dict[PlatformType, Dict[CampaignType, CampaignTypeConfig]] = {
        PlatformType.GOOGLE: {
            CampaignType.SEARCH: CampaignTypeConfig(
                available_templates={TemplateType.GOOGLE_RESPONSIVE_SEARCH_AD},
                supported_templates={TemplateType.GOOGLE_RESPONSIVE_SEARCH_AD},
                supported=True,
            ),
            CampaignType.DISPLAY: CampaignTypeConfig(
                available_templates={TemplateType.GOOGLE_RESPONSIVE_DISPLAY_AD},
                supported_templates={TemplateType.GOOGLE_RESPONSIVE_DISPLAY_AD},
                supported=True,
            ),
            CampaignType.PERFORMANCE_MAX: CampaignTypeConfig(
                available_templates={TemplateType.GOOGLE_PERFORMANCE_MAX},
                supported_templates={TemplateType.GOOGLE_PERFORMANCE_MAX},
                supported=True,
            ),
            CampaignType.SHOPPING: CampaignTypeConfig(
                available_templates={TemplateType.GOOGLE_SHOPPING_PRODUCT_AD},
                supported_templates=set(),
                supported=False,
            ),
            CampaignType.APP: CampaignTypeConfig(
                available_templates={TemplateType.GOOGLE_APP_INSTALLS},
                supported_templates=set(),
                supported=False,
            ),
            CampaignType.DEMAND_GEN: CampaignTypeConfig(
                available_templates={TemplateType.GOOGLE_DEMAND_GEN_VIDEO, TemplateType.GOOGLE_DEMAND_GEN_IMAGE},
                supported_templates=set(),
                supported=False,
            ),
        },
        PlatformType.BING: {
            CampaignType.SEARCH: CampaignTypeConfig(
                available_templates={TemplateType.BING_RESPONSIVE_SEARCH_AD},
                supported_templates={TemplateType.BING_RESPONSIVE_SEARCH_AD},
                supported=True,
            ),
            CampaignType.DISPLAY: CampaignTypeConfig(
                available_templates={TemplateType.BING_RESPONSIVE_DISPLAY_AD, TemplateType.BING_VIDEO_AD},
                supported_templates={TemplateType.BING_RESPONSIVE_DISPLAY_AD},
                supported=True,
            ),
            CampaignType.PERFORMANCE_MAX: CampaignTypeConfig(
                available_templates={TemplateType.BING_PERFORMANCE_MAX},
                supported_templates={TemplateType.BING_PERFORMANCE_MAX},
                supported=True,
            ),
            CampaignType.SHOPPING: CampaignTypeConfig(
                available_templates={TemplateType.BING_SHOPPING_PRODUCT_AD},
                supported_templates=set(),
                supported=False,
            ),
            CampaignType.APP: CampaignTypeConfig(
                available_templates={TemplateType.BING_APP_INSTALL_AD},
                supported_templates=set(),
                supported=False,
            ),
        },
    }

    @classmethod
    def get_supported_campaign_types(cls, platform: PlatformType) -> Set[CampaignType]:
        return {
            ct for ct, config in cls._MATRIX.get(platform, {}).items()
            if config.is_supported
        }

    @classmethod
    def get_supported_templates(
        cls, platform: PlatformType, campaign_type: CampaignType,
    ) -> Set[TemplateType]:
        config = cls._MATRIX.get(platform, {}).get(campaign_type)
        return config.supported_templates if config else set()

    @classmethod
    def get_default_template(
        cls, platform: PlatformType, campaign_type: CampaignType,
    ) -> Optional[TemplateType]:
        templates = cls.get_supported_templates(platform, campaign_type)
        return next(iter(templates), None) if templates else None

    @classmethod
    def get_supported_platforms(cls) -> List[PlatformType]:
        return [p for p in PlatformType if cls.get_supported_campaign_types(p)]

    @classmethod
    def to_full_capability_dict(cls, supported_only: bool = True) -> Dict:
        """For injection into the strategy prompt."""
        result = {}
        for platform in PlatformType:
            platform_key = platform.value.lower()
            result[platform_key] = {}
            campaign_types = (
                cls.get_supported_campaign_types(platform)
                if supported_only
                else set(cls._MATRIX.get(platform, {}).keys())
            )
            for ct in campaign_types:
                config = cls._MATRIX.get(platform, {}).get(ct)
                if config:
                    templates = config.supported_templates if supported_only else config.available_templates
                    result[platform_key][ct.value.lower()] = {
                        "supported": config.is_supported,
                        "templates": [t.value for t in templates],
                    }
        return result


def extract_all_connections(
    connections: ConnectionsResponse,
) -> List[ConnectedPlatform]:
    """Extract ALL connected platforms with valid tokens (no matrix filtering).

    Used for the system prompt — tells the LLM everything the user has connected.
    """
    result: List[ConnectedPlatform] = []
    for platform_name, info in connections.platforms.items():
        if not info.connected:
            continue
        for conn in info.connections:
            if not conn.token_valid:
                continue
            account = conn.account
            result.append(ConnectedPlatform(
                platform=platform_name.upper(),
                account_id=conn.account_id or (account.account_id if account else None),
                customer_id=conn.customer_id,
                currency=account.currency if account else None,
                account_name=account.account_name if account else None,
                timezone=account.timezone if account else None,
            ))
    return result


def filter_connected_platforms(
    connections: ConnectionsResponse,
) -> List[ConnectedPlatform]:
    """Filter connected platforms against the capability matrix.

    Returns only platforms with valid tokens and at least one supported campaign type.
    """
    result: List[ConnectedPlatform] = []
    supported_platforms = {p.value.upper() for p in PlatformCapabilityMatrix.get_supported_platforms()}

    for platform_name, info in connections.platforms.items():
        if platform_name.upper() not in supported_platforms:
            continue
        if not info.connected:
            continue

        for conn in info.connections:
            if not conn.token_valid:
                continue
            account = conn.account
            result.append(ConnectedPlatform(
                platform=platform_name.upper(),
                account_id=conn.account_id or (account.account_id if account else None),
                customer_id=conn.customer_id,
                currency=account.currency if account else None,
                account_name=account.account_name if account else None,
                timezone=account.timezone if account else None,
            ))

    return result
