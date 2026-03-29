"""Step 2: Analyze — 4 parallel agents on fast model."""

import asyncio
import logging
import time
from datetime import date
from typing import Type

from pydantic import BaseModel

from src.agentic_platform.core.config import settings
from src.agentic_platform.core.llm import structured_llm_call
from src.agentic_platform.core.engine.models import NodeResponse
from src.agentic_platform.core.engine.workflow import WorkflowContext, StepArtifact
from src.agentic_platform.app.campaigns.models import (
    WebsiteContent,
    BusinessContext, BrandInsight, BrandAnalysisResult,
    ProductInsight, ProductAnalysisResult,
    AudiencePersona, AudienceAnalysisResult, Demographics, Gender,
    MarketingAnalysisReport,
    CreateCampaignArgs,
)
from src.agentic_platform.app.campaigns.prompts import AnalysisPrompts

logger = logging.getLogger(__name__)


async def analyze(ctx: WorkflowContext) -> NodeResponse:
    """4 parallel agents: business+trends, brand+competitors, products, audience."""
    logger.info("[analyze] START")
    scrape_result = ctx.results.get("scrape")
    if not scrape_result or not scrape_result.data:
        return NodeResponse(summary="No scrape data", data={})

    website = WebsiteContent(**scrape_result.data)
    c = AnalysisPrompts.ctx(website)
    pt = AnalysisPrompts.page_type_instruction(website)

    # 4 agents (merged from 6): business+trends, brand+competitors, products, audience
    tasks = [
        ("business", BusinessContext, AnalysisPrompts.BUSINESS.format(c=c)),
        ("brand", BrandAnalysisResult, AnalysisPrompts.BRAND.format(c=c, page_type_hint=pt)),
        ("products", ProductAnalysisResult, AnalysisPrompts.PRODUCTS.format(c=c, page_type_hint=pt)),
        ("audience", AudienceAnalysisResult, AnalysisPrompts.AUDIENCE.format(c=c, page_type_hint=pt)),
    ]

    async def run_agent(name: str, schema: Type[BaseModel], prompt: str) -> BaseModel:
        ctx.progress.start(name)
        t0 = time.perf_counter()
        try:
            result = await structured_llm_call(prompt, schema, model=settings.workflow_analyze_model)
            elapsed = time.perf_counter() - t0
            logger.info("[analyze] %s OK (%.1fs)", name, elapsed)
            # Emit artifact + rich summary per agent as it completes (streams progressively)
            _emit_agent_artifact(ctx, name, result)
            return result
        except Exception as exc:
            logger.error("[analyze] %s FAILED (%.1fs): %s", name, time.perf_counter() - t0, exc)
            ctx.progress.error(name, message=str(exc))
            raise

    t0 = time.perf_counter()
    results = await asyncio.gather(
        *[run_agent(n, s, p) for n, s, p in tasks],
        return_exceptions=True,
    )
    logger.info("[analyze] all 4 agents done (%.1fs)", time.perf_counter() - t0)

    biz, brand_r, prods, aud = results

    # Graceful fallbacks — use connected platform currency if LLM analysis failed
    fallback_currency = next(
        (c.currency if hasattr(c, 'currency') else c.get("currency")
         for c in ctx.connected_platforms
         if (c.currency if hasattr(c, 'currency') else c.get("currency"))),
        "USD",
    ) if ctx.connected_platforms else "USD"
    if isinstance(biz, Exception):
        biz = BusinessContext(currency=fallback_currency, market="Unknown")
    if isinstance(brand_r, Exception):
        brand_r = BrandAnalysisResult(brand=BrandInsight(name=website.metadata.title or "Unknown", positioning="Unknown"))
    if isinstance(prods, Exception):
        prods = ProductAnalysisResult()
    if isinstance(aud, Exception):
        aud = AudienceAnalysisResult()

    meta = website.metadata
    report = MarketingAnalysisReport(
        website_url=website.url, scan_date=date.today().isoformat(),
        business_context=biz, brand=brand_r.brand,
        products=prods.products, audience=aud.audience,
        brand_colors=meta.brand_colors, theme_color=meta.theme_color,
        og_image=meta.og_image, favicon_url=meta.favicon_url,
        page_type=meta.page_type, shopify_product=website.shopify_product,
    )

    # Merge user-provided preferences over AI analysis (user wins on conflicts)
    args = CreateCampaignArgs.from_ctx_args(ctx.args)
    _merge_user_preferences(report, args)

    logger.info("[analyze] report: brand=%s market=%s/%s prods=%d aud=%d",
                report.brand.name, biz.market, biz.currency, len(report.products), len(report.audience))

    return NodeResponse(
        summary=f"Analyzed {report.brand.name}: {len(report.products)} products, {len(report.audience)} personas",
        data=report.model_dump(),
    )


def _emit_agent_artifact(ctx: WorkflowContext, name: str, result: BaseModel) -> None:
    """Emit a typed artifact + rich substep summary for a completed analysis agent."""
    if name == "business" and isinstance(result, BusinessContext):
        biz = result
        ctx.progress.done("business", summary=f"{biz.market} · {biz.currency}")
        ctx.emit_artifact(StepArtifact(
            type="market_context",
            title="Market",
            data={
                "market": biz.market, "currency": biz.currency,
                "industry": biz.industry, "business_scale": biz.business_scale,
                "key_trends": biz.key_trends,
                "trends": [
                    {"name": t.name, "relevance": t.relevance, "action": t.action}
                    for t in biz.trends
                ] if biz.trends else [],
            },
        ))

    elif name == "brand" and isinstance(result, BrandAnalysisResult):
        brand = result.brand
        ctx.progress.done("brand", summary=f"{brand.name}")
        # Brand artifact — identity only, no competitors
        ctx.emit_artifact(StepArtifact(
            type="brand_identity",
            title="Brand",
            data={
                "name": brand.name, "positioning": brand.positioning,
                "value_proposition": brand.value_proposition,
                "tone_of_voice": brand.tone_of_voice, "tagline": brand.tagline,
                "social_proof": brand.social_proof,
                "offers": brand.offers_and_promotions,
            },
        ))
        # Competitors artifact — separate section with named rivals
        if brand.competitors:
            ctx.emit_artifact(StepArtifact(
                type="competitors",
                title="Competitors",
                data={
                    "competitors": [
                        {"name": c.name, "threat_level": c.threat_level, "differentiation": c.differentiation}
                        for c in brand.competitors
                    ],
                },
            ))

    elif name == "products" and isinstance(result, ProductAnalysisResult):
        products = result.products
        names = ", ".join(p.name for p in products[:3])
        ctx.progress.done("products", summary=f"{len(products)} found")
        ctx.emit_artifact(StepArtifact(
            type="product_catalog",
            title="Products",
            data={
                "products": [
                    {
                        "name": p.name, "category": p.category,
                        "price_range": p.price_range,
                        "key_features": p.key_features, "benefits": p.benefits,
                        "differentiation": p.differentiation,
                    }
                    for p in products
                ],
            },
        ))

    elif name == "audience" and isinstance(result, AudienceAnalysisResult):
        personas = result.audience
        names = ", ".join(p.persona_name for p in personas[:3])
        ctx.progress.done("audience", summary=f"{len(personas)} personas")
        ctx.emit_artifact(StepArtifact(
            type="audience_personas",
            title="Audience",
            data={
                "personas": [
                    {
                        "persona_name": p.persona_name, "gender": p.gender.value,
                        "age": p.demographics.age, "location": p.demographics.location,
                        "language": p.demographics.language,
                        "pain_points": p.pain_points,
                        "motivations": p.motivations,
                        "search_queries": p.search_queries,
                        "ad_hooks": p.ad_hooks,
                    }
                    for p in personas
                ],
            },
        ))
    else:
        # Unknown agent — just mark done
        ctx.progress.done(name, summary=f"{name} done")


def _merge_user_preferences(report: MarketingAnalysisReport, args: CreateCampaignArgs) -> None:
    """Override AI analysis with user-provided preferences (mutates report in-place)."""

    if args.brand:
        b = args.brand
        if b.name:
            report.brand.name = b.name
        if b.tone_of_voice:
            report.brand.tone_of_voice = b.tone_of_voice
        if b.positioning:
            report.brand.positioning = b.positioning
        if b.tagline:
            report.brand.tagline = b.tagline
        if b.competitor_edges:
            report.brand.competitor_edges = b.competitor_edges

    if args.audience:
        a = args.audience
        if a.custom_personas:
            # Replace AI personas with user-defined ones
            report.audience = [
                AudiencePersona(
                    persona_name=p,
                    gender=Gender(a.target_gender) if a.target_gender else Gender.ALL,
                    demographics=Demographics(
                        age=a.target_age or "18-65",
                        location=", ".join(a.target_locations) if a.target_locations else "",
                        language=a.target_language or "English",
                    ),
                    search_queries=list(a.search_queries),
                )
                for p in a.custom_personas
            ]
        else:
            # Patch existing personas with overrides
            for persona in report.audience:
                if a.target_age:
                    persona.demographics.age = a.target_age
                if a.target_gender:
                    persona.gender = Gender(a.target_gender)
                if a.target_locations:
                    persona.demographics.location = ", ".join(a.target_locations)
                if a.target_language:
                    persona.demographics.language = a.target_language
                if a.search_queries:
                    persona.search_queries = list(a.search_queries)

    if args.products and report.products:
        p = args.products
        if p.hero_products:
            heroes = [prod for prod in report.products if prod.name in p.hero_products]
            rest = [prod for prod in report.products if prod.name not in p.hero_products]
            report.products = heroes + rest
        if p.key_features and report.products:
            report.products[0].key_features = p.key_features
        if p.key_benefits and report.products:
            report.products[0].benefits = p.key_benefits
        if p.price_override and report.products:
            report.products[0].price_range = p.price_override
        if p.landing_url and report.products:
            report.products[0].landing_url = p.landing_url
