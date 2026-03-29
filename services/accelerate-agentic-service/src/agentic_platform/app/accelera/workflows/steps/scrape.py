"""Step 1: Scrape website content using Firecrawl."""

import logging
import re

from src.agentic_platform.core.engine import NodeResponse, WorkflowContext
from src.agentic_platform.core.config import settings
from src.agentic_platform.core.infra.http_client import ServiceClient

logger = logging.getLogger(__name__)

_firecrawl = ServiceClient("firecrawl", base_url="https://api.firecrawl.dev")
MAX_CONTENT_CHARS = 8000


async def scrape(ctx: WorkflowContext) -> NodeResponse:
    """Scrape the target URL and extract page content + product images."""
    url: str = ctx.args.get("url", "")

    page_content = ""
    product_images: list[str] = []

    # Firecrawl scrape
    try:
        resp = await _firecrawl.post("/v1/scrape", json={
            "url": url,
            "formats": ["markdown"],
        }, headers={"Authorization": f"Bearer {settings.firecrawl_api_key}"})
        data = resp.get("body", {})
        md = data.get("data", {}).get("markdown") or data.get("markdown", "")
        page_content = md[:MAX_CONTENT_CHARS]
        logger.info("Scraped %d chars from %s", len(page_content), url)
    except Exception as e:
        logger.warning("Firecrawl failed for %s: %s", url, e)
        page_content = f"Could not scrape {url}. Proceeding with URL-based analysis."

    # Try Shopify JSON API for product images
    try:
        shopify_url = re.sub(r"/$", "", url) + "/products.json?limit=5"
        shopify_client = ServiceClient("shopify-products", base_url=shopify_url.rsplit("/products.json", 1)[0])
        shopify_resp = await shopify_client.get("/products.json?limit=5")
        shopify_body = shopify_resp.get("body", {})
        products = shopify_body.get("products", [])
        for product in products[:5]:
            images = product.get("images", [])
            if images:
                product_images.append(images[0].get("src", ""))
    except Exception:
        pass  # Not Shopify — fine

    return NodeResponse(
        summary=f"Scraped {len(page_content)} chars from {url}. Found {len(product_images)} product images.",
        data={
            "page_content": page_content,
            "product_images": product_images,
            "url": url,
        },
    )
