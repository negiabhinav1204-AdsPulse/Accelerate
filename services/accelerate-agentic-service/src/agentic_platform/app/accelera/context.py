"""Per-request context hydration for the Accelera AI agent.

hydrate_context: called once before graph runs — loads connected platforms + org memory.
accelera_dynamic_context: called per-request — injects loaded context into system prompt.
extract_and_save_memory: fire-and-forget after each turn — saves signals to memory-service.
"""

import asyncio
import logging
import re

from src.agentic_platform.core.auth import UserContext

logger = logging.getLogger(__name__)


async def hydrate_accelera_context(user: UserContext) -> None:
    """Load connected ad platforms and org memory before the graph executes."""
    if user.domain_context.get("accelera_hydrated"):
        return

    # Load connected platforms from connector-service in parallel with memory load
    connected_task = asyncio.create_task(_load_connected_platforms(user.org_id))
    memory_task = asyncio.create_task(_load_org_memory(user.org_id, user.user_id))

    connected, memory_facts = await asyncio.gather(
        connected_task, memory_task, return_exceptions=True
    )

    user.domain_context["connected_platforms"] = connected if not isinstance(connected, Exception) else []
    user.domain_context["memory_facts"] = memory_facts if not isinstance(memory_facts, Exception) else []
    user.domain_context["accelera_hydrated"] = True

    logger.info(
        "Accelera context hydrated for org=%s: %d platforms, %d memory facts",
        user.org_id,
        len(user.domain_context["connected_platforms"]),
        len(user.domain_context["memory_facts"]),
    )


async def _load_connected_platforms(org_id: str) -> list[dict]:
    """Fetch connected ad accounts from connector-service."""
    try:
        from src.agentic_platform.app.accelera.services.clients import connector_client
        resp = await connector_client.get(f"/connectors/all/accounts?org_id={org_id}")
        accounts = resp.get("body", {})
        if isinstance(accounts, list):
            return accounts
        return accounts.get("accounts", [])
    except Exception as e:
        logger.warning("Failed to load connected platforms for org=%s: %s", org_id, e)
        return []


async def _load_org_memory(org_id: str, user_id: str) -> list[dict]:
    """Load relevant org memory facts from memory-service."""
    try:
        from src.agentic_platform.app.accelera.services.clients import memory_client
        resp = await memory_client.post("/memory/load", json={
            "orgId": org_id,
            "userId": user_id,
            "types": [
                "brand_profile",
                "campaign_preference",
                "seasonal_intent",
                "creative_preference",
                "competitor_intelligence",
            ],
        })
        nodes = resp.get("body", {})
        if isinstance(nodes, list):
            return nodes
        return nodes.get("nodes", [])
    except Exception as e:
        logger.warning("Failed to load org memory for org=%s: %s", org_id, e)
        return []


def accelera_dynamic_context(metadata: dict) -> str:
    """Build the dynamic context section appended to the system prompt per-request."""
    lines: list[str] = []

    connected = metadata.get("connected_platforms", [])
    if connected:
        lines.append("\n## Connected Ad Platforms")
        for p in connected:
            if isinstance(p, dict):
                platform = p.get("platform", "Unknown")
                name = p.get("accountName") or p.get("account_name", "")
                aid = p.get("accountId") or p.get("account_id", "")
                lines.append(f"- {platform}: {name} (ID: {aid})")
    else:
        lines.append("\n## Connected Ad Platforms\nNo ad platforms connected yet.")

    memory_facts = metadata.get("memory_facts", [])
    if memory_facts:
        lines.append("\n## What You Already Know About This Organization")
        for fact in memory_facts:
            if isinstance(fact, dict):
                lines.append(f"- [{fact.get('type', '')}] {fact.get('summary', '')}")

    return "\n".join(lines)


async def extract_and_save_memory(
    user_msg: str,
    assistant_msg: str,
    org_id: str,
    user_id: str,
) -> None:
    """Extract signals from conversation and save to memory-service (fire-and-forget)."""
    signals: list[dict] = []

    # Budget mentions → campaign_preference
    budget_match = re.search(r"\$[\d,]+(?:k|K)?|\b(\d+(?:,\d+)?)\s*(?:dollars?|USD)\b", user_msg)
    if budget_match:
        signals.append({
            "type": "campaign_preference",
            "key": "budget",
            "summary": f"User mentioned budget: {budget_match.group(0)}",
            "content": {"raw": budget_match.group(0)},
        })

    # Platform mentions → campaign_preference
    platforms_mentioned = []
    for p in ["meta", "facebook", "instagram", "google", "bing", "microsoft"]:
        if p in user_msg.lower():
            platforms_mentioned.append(p)
    if platforms_mentioned:
        signals.append({
            "type": "campaign_preference",
            "key": "preferred_platforms",
            "summary": f"User mentioned platforms: {', '.join(platforms_mentioned)}",
            "content": {"platforms": platforms_mentioned},
        })

    # URL mentions → brand_profile
    url_match = re.search(r"https?://[^\s]+", user_msg)
    if url_match:
        signals.append({
            "type": "brand_profile",
            "key": "brand_url",
            "summary": f"User's brand URL: {url_match.group(0)}",
            "content": {"url": url_match.group(0)},
        })

    # Seasonal keywords → seasonal_intent
    seasonal_keywords = ["holiday", "christmas", "black friday", "cyber monday",
                         "summer", "back to school", "valentine", "mother's day"]
    for kw in seasonal_keywords:
        if kw in user_msg.lower():
            signals.append({
                "type": "seasonal_intent",
                "key": kw.replace(" ", "_"),
                "summary": f"User mentioned seasonal event: {kw}",
                "content": {"keyword": kw},
            })

    if not signals:
        return

    from src.agentic_platform.app.accelera.services.clients import memory_client
    for signal in signals:
        try:
            await memory_client.post("/memory/upsert", json={
                "orgId": org_id,
                "userId": user_id,
                "type": signal["type"],
                "key": signal["key"],
                "summary": signal["summary"],
                "content": signal["content"],
                "confidenceDelta": 0.1,
            })
        except Exception as e:
            logger.warning("Failed to save memory signal %s: %s", signal["key"], e)
