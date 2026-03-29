"""Step 1: Scrape — fetch and parse website content."""

import logging
import time

from src.agentic_platform.core.engine.models import NodeResponse
from src.agentic_platform.core.engine.workflow import WorkflowContext, StepArtifact
from src.agentic_platform.app.campaigns.models import CreateCampaignArgs
from src.agentic_platform.app.campaigns.services.web_scraper import scrape_website

logger = logging.getLogger(__name__)


async def scrape(ctx: WorkflowContext) -> NodeResponse:
    args = CreateCampaignArgs.from_ctx_args(ctx.args)
    url = args.url
    logger.info("[scrape] START url=%s", url)
    if not url:
        return NodeResponse(summary="No URL provided", data={})

    t0 = time.perf_counter()
    website = await scrape_website(url)
    elapsed = time.perf_counter() - t0

    if not website.is_successful:
        logger.error("[scrape] FAILED (%.1fs): %s", elapsed, website.error_message)
        return NodeResponse(summary=f"Failed to scrape {url}: {website.error_message}", data=website.model_dump())

    logger.info("[scrape] OK title=%r page=%s (%.1fs)", website.metadata.title, website.metadata.page_type, elapsed)
    summary = f"Scraped {website.metadata.title or url}"
    if website.product_data:
        summary += f" — {website.product_data.title}"

    ctx.emit_artifact(StepArtifact(
        type="website_summary",
        title="Website",
        data={
            "url": website.url,
            "title": website.metadata.title or "",
            "description": website.metadata.description or "",
            "page_type": website.metadata.page_type,
            "is_shopify": website.metadata.is_shopify,
            "has_product": website.product_data is not None,
            "product_title": website.product_data.title if website.product_data else None,
        },
    ))

    return NodeResponse(summary=summary, data=website.model_dump())
