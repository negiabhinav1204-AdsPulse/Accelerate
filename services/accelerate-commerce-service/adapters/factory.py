"""Adapter factory — returns the correct adapter given a connector record."""
from adapters.base import CommerceAdapter
from adapters.shopify import ShopifyAdapter


def get_adapter(platform: str, credentials: dict) -> CommerceAdapter:
    """Instantiate the correct adapter for the given platform + credentials."""
    match platform:
        case "shopify":
            return ShopifyAdapter(
                store_url=credentials["store_url"],
                access_token=credentials["access_token"],
            )
        case _:
            raise NotImplementedError(f"Adapter not yet implemented for platform: {platform}")
