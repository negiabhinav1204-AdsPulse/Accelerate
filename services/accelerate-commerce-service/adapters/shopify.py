"""Shopify adapter — Shopify Admin REST API 2024-01.

Reference: Adaptiv api/app/routers/shopify.py and api/app/services/shopify_sync.py
Rewritten for Accelerate's CommerceAdapter interface and asyncpg schema.
"""
from __future__ import annotations

import asyncio
import logging
import random
from datetime import datetime, timezone
from urllib.parse import urlparse

import httpx

from adapters.base import CommerceAdapter

logger = logging.getLogger(__name__)

SHOPIFY_API_VERSION = "2024-01"
MAX_RETRIES = 3
BASE_DELAY = 2.0

CHANNEL_MAP = {
    "web": "Online Store",
    "pos": "POS",
    "shopify_draft_order": "Draft / Wholesale",
    "android": "Mobile App",
    "iphone": "Mobile App",
    "": "Online Store",
}


def _normalise_store_url(raw: str) -> str:
    raw = raw.strip().rstrip("/")
    if raw.startswith("http"):
        return urlparse(raw).hostname or raw
    return raw


def _derive_channel(order: dict) -> str:
    source = order.get("source_name", "web") or "web"
    tags_str = (order.get("tags") or "").lower()
    if "wholesale" in tags_str:
        return "Wholesale"
    if "b2b" in tags_str:
        return "B2B"
    if source == "pos" or "pos" in tags_str:
        return "POS"
    label = CHANNEL_MAP.get(source)
    if label:
        return label
    if source.isdigit():
        return "App / Other"
    return source.replace("_", " ").title()


def _parse_tags(tags_str: str | None) -> list[str]:
    if not tags_str:
        return []
    return [t.strip() for t in tags_str.split(",") if t.strip()]


class ShopifyAdapter(CommerceAdapter):
    def __init__(self, store_url: str, access_token: str) -> None:
        self.store_url = _normalise_store_url(store_url)
        self.access_token = access_token
        self._base = f"https://{self.store_url}/admin/api/{SHOPIFY_API_VERSION}"
        self._headers = {
            "X-Shopify-Access-Token": self.access_token,
            "Content-Type": "application/json",
        }

    # ─── Retry helper ────────────────────────────────────────────────────────

    async def _get(self, client: httpx.AsyncClient, endpoint: str, params: dict | None = None) -> httpx.Response:
        url = f"{self._base}/{endpoint}"
        last_err: Exception | None = None
        for attempt in range(MAX_RETRIES + 1):
            try:
                resp = await client.get(url, headers=self._headers, params=params or {})
                if resp.status_code == 429:
                    wait = float(resp.headers.get("Retry-After", BASE_DELAY * (2 ** attempt)))
                    wait += random.uniform(0, 1)
                    logger.warning("Shopify rate-limited (429), retrying in %.1fs", wait)
                    await asyncio.sleep(min(wait, 30))
                    continue
                if resp.status_code >= 500 and attempt < MAX_RETRIES:
                    wait = BASE_DELAY * (2 ** attempt) + random.uniform(0, 1)
                    logger.warning("Shopify server error %d, retrying in %.1fs", resp.status_code, wait)
                    await asyncio.sleep(wait)
                    continue
                return resp
            except (httpx.ConnectError, httpx.ReadTimeout, httpx.WriteTimeout) as exc:
                last_err = exc
                if attempt < MAX_RETRIES:
                    wait = BASE_DELAY * (2 ** attempt) + random.uniform(0, 1)
                    logger.warning("Shopify connection error: %s, retrying in %.1fs", exc, wait)
                    await asyncio.sleep(wait)
                else:
                    raise
        raise last_err or Exception("Max retries exceeded")

    # ─── Interface implementation ─────────────────────────────────────────────

    async def test_connection(self) -> bool:
        async with httpx.AsyncClient(timeout=15) as client:
            try:
                resp = await self._get(client, "shop.json")
                return resp.status_code == 200
            except Exception:
                return False

    async def fetch_products(self, since: datetime | None = None) -> list[dict]:
        results: list[dict] = []
        async with httpx.AsyncClient(timeout=30) as client:
            page_info: str | None = None
            while True:
                params: dict = {"limit": 250}
                if page_info:
                    params = {"limit": 250, "page_info": page_info}
                elif since:
                    params["updated_at_min"] = since.isoformat()

                resp = await self._get(client, "products.json", params)
                resp.raise_for_status()
                products = resp.json().get("products", [])
                if not products:
                    break

                for p in products:
                    results.append(self.normalize_product(p))

                link = resp.headers.get("link", "")
                if 'rel="next"' not in link:
                    break
                for part in link.split(","):
                    if 'rel="next"' in part:
                        url_part = part.split(";")[0].strip().strip("<>")
                        if "page_info=" in url_part:
                            page_info = url_part.split("page_info=")[1].split("&")[0]
                        break
        return results

    async def fetch_orders(self, since: datetime, until: datetime) -> list[dict]:
        results: list[dict] = []
        async with httpx.AsyncClient(timeout=30) as client:
            page_info: str | None = None
            while True:
                params: dict = {
                    "status": "any",
                    "limit": 250,
                    "created_at_min": since.isoformat(),
                    "created_at_max": until.isoformat(),
                }
                if page_info:
                    params = {"limit": 250, "page_info": page_info}

                resp = await self._get(client, "orders.json", params)
                resp.raise_for_status()
                orders = resp.json().get("orders", [])
                if not orders:
                    break

                for o in orders:
                    results.append(self.normalize_order(o))

                link = resp.headers.get("link", "")
                if 'rel="next"' not in link:
                    break
                for part in link.split(","):
                    if 'rel="next"' in part:
                        url_part = part.split(";")[0].strip().strip("<>")
                        if "page_info=" in url_part:
                            page_info = url_part.split("page_info=")[1].split("&")[0]
                        break
        return results

    async def fetch_inventory(self, product_ids: list[str]) -> list[dict]:
        results: list[dict] = []
        async with httpx.AsyncClient(timeout=30) as client:
            for product_id in product_ids:
                resp = await self._get(client, f"products/{product_id}/variants.json")
                if resp.status_code != 200:
                    continue
                for v in resp.json().get("variants", []):
                    results.append({
                        "external_id": str(v["id"]),
                        "product_external_id": str(product_id),
                        "sku": v.get("sku"),
                        "inventory_qty": int(v.get("inventory_quantity") or 0),
                    })
        return results

    def normalize_product(self, raw: dict) -> dict:
        variants = raw.get("variants", [])
        images = raw.get("images", [])
        prices = [float(v.get("price", 0) or 0) for v in variants]
        total_inv = sum(int(v.get("inventory_quantity", 0) or 0) for v in variants)

        return {
            "external_id": str(raw["id"]),
            "title": raw.get("title", ""),
            "description": raw.get("body_html") or None,
            "price": min(prices) if prices else 0.0,
            "sale_price": None,  # Shopify uses compare_at_price on variants
            "currency": "USD",  # Shopify store currency from shop.json, defaulting USD
            "image_url": images[0]["src"] if images else None,
            "additional_images": [img["src"] for img in images[1:6]],
            "handle": raw.get("handle"),
            "brand": raw.get("vendor"),
            "google_category": None,
            "sku": variants[0].get("sku") if variants else None,
            "barcode": variants[0].get("barcode") if variants else None,
            "status": "active" if raw.get("status") == "active" else "inactive",
            "inventory_qty": total_inv,
            "tags": _parse_tags(raw.get("tags")),
            "metadata": {
                "product_type": raw.get("product_type"),
                "shopify_updated_at": raw.get("updated_at"),
            },
            "variants": [
                {
                    "external_id": str(v["id"]),
                    "title": v.get("title", "Default"),
                    "price": float(v.get("price", 0) or 0),
                    "sku": v.get("sku"),
                    "inventory": int(v.get("inventory_quantity", 0) or 0),
                }
                for v in variants
            ],
        }

    def normalize_order(self, raw: dict) -> dict:
        customer = raw.get("customer") or {}
        line_items = raw.get("line_items", [])
        return {
            "external_id": str(raw["id"]),
            "customer_email": raw.get("email"),
            "customer_name": (
                f"{customer.get('first_name', '')} {customer.get('last_name', '')}".strip()
                or None
            ),
            "total_amount": float(raw.get("total_price", 0) or 0),
            "currency": raw.get("currency", "USD"),
            "channel": _derive_channel(raw),
            "status": raw.get("financial_status", "pending"),
            "placed_at": raw.get("created_at"),
            "items": [
                {
                    "external_product_id": str(li.get("product_id") or ""),
                    "title": li.get("title", ""),
                    "quantity": int(li.get("quantity", 1)),
                    "price": float(li.get("price", 0) or 0),
                }
                for li in line_items
            ],
        }
