"""Abstract base class for all commerce platform adapters.

All adapters return normalized Python dicts that map 1:1 to the
CommerceConnector Prisma schema. No platform-specific fields leak outside.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime


class CommerceAdapter(ABC):
    """Platform-agnostic commerce adapter interface."""

    @abstractmethod
    async def test_connection(self) -> bool:
        """Return True if credentials are valid and the API is reachable."""
        ...

    @abstractmethod
    async def fetch_products(self, since: datetime | None = None) -> list[dict]:
        """Return a list of normalized product dicts.

        Each dict must contain at minimum:
          external_id, title, price, currency, status
        and optionally:
          description, sale_price, image_url, additional_images,
          handle, brand, google_category, sku, barcode,
          inventory_qty, tags, variants
        """
        ...

    @abstractmethod
    async def fetch_orders(self, since: datetime, until: datetime) -> list[dict]:
        """Return a list of normalized order dicts.

        Each dict must contain at minimum:
          external_id, total_amount, currency, status, placed_at
        and optionally:
          customer_email, customer_name, channel, items
        """
        ...

    @abstractmethod
    async def fetch_inventory(self, product_ids: list[str]) -> list[dict]:
        """Return current inventory for the given external product IDs."""
        ...

    @abstractmethod
    def normalize_product(self, raw: dict) -> dict:
        """Convert platform-native product dict → normalized Accelerate schema."""
        ...

    @abstractmethod
    def normalize_order(self, raw: dict) -> dict:
        """Convert platform-native order dict → normalized Accelerate schema."""
        ...
