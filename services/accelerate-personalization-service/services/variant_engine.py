import asyncio
import json
import logging
import re
from typing import Optional

import httpx

from core.config import get_settings

logger = logging.getLogger(__name__)

MODEL = "claude-haiku-4-5-20251001"
MAX_RETRIES = 3
BASE_BACKOFF = 1.0  # seconds


def _build_system_prompt() -> str:
    return (
        "You are an expert CRO (Conversion Rate Optimization) specialist. "
        "Your task is to generate meaningful A/B test variants for HTML zones on a web page. "
        "Focus on changes that are likely to improve click-through rates, conversions, or engagement. "
        "Vary headlines, CTAs, layouts, social proof, urgency signals, and value propositions. "
        "Each variant must be complete, self-contained HTML that can directly replace the original. "
        "Respond ONLY with a valid JSON array — no markdown fences, no extra text. "
        "Each element must have exactly three keys: 'name' (short descriptive label), 'html' (the full variant HTML), and 'rationale' (1-2 sentences explaining the CRO hypothesis)."
    )


def _build_user_prompt(zone_data: dict, count: int, context: str) -> str:
    selector = zone_data.get("selector", "")
    default_html = zone_data.get("defaultHtml") or zone_data.get("default_html") or ""
    zone_name = zone_data.get("name", "")

    lines = [
        f"Zone name: {zone_name}",
        f"CSS selector: {selector}",
        f"Original HTML:\n{default_html}",
    ]
    if context:
        lines.append(f"Additional context: {context}")

    lines.append(
        f"\nGenerate {count} distinct A/B test variant(s) for this zone. "
        "Return a JSON array of objects with keys: name, html, rationale."
    )
    return "\n".join(lines)


def _extract_json_array(text: str) -> list[dict]:
    """Extract the first JSON array from a string, handling markdown fences."""
    # Strip markdown code fences
    text = re.sub(r"```(?:json)?\s*", "", text).strip()
    # Find the first '[' and last ']'
    start = text.find("[")
    end = text.rfind("]")
    if start == -1 or end == -1:
        raise ValueError(f"No JSON array found in response: {text[:200]}")
    return json.loads(text[start : end + 1])


async def _call_litellm_http(
    base_url: str,
    api_key: str,
    system_prompt: str,
    user_prompt: str,
) -> str:
    """Call LiteLLM proxy via httpx."""
    url = f"{base_url.rstrip('/')}/chat/completions"
    payload = {
        "model": MODEL,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.7,
        "max_tokens": 4096,
    }
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]


async def _call_litellm_sdk(system_prompt: str, user_prompt: str) -> str:
    """Fall back to litellm package (uses ANTHROPIC_API_KEY env var or litellm key)."""
    try:
        import litellm  # type: ignore

        settings = get_settings()
        if settings.litellm_api_key:
            litellm.api_key = settings.litellm_api_key

        response = await litellm.acompletion(
            model=f"anthropic/{MODEL}",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.7,
            max_tokens=4096,
        )
        return response.choices[0].message.content  # type: ignore
    except ImportError:
        raise RuntimeError(
            "litellm package not installed and LITELLM_BASE_URL not configured. "
            "Install litellm or set LITELLM_BASE_URL."
        )


async def _call_with_retry(
    system_prompt: str,
    user_prompt: str,
) -> str:
    """Call LLM with exponential backoff retries."""
    settings = get_settings()
    last_exc: Optional[Exception] = None

    for attempt in range(MAX_RETRIES):
        try:
            if settings.litellm_base_url:
                content = await _call_litellm_http(
                    base_url=settings.litellm_base_url,
                    api_key=settings.litellm_api_key,
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                )
            else:
                content = await _call_litellm_sdk(
                    system_prompt=system_prompt,
                    user_prompt=user_prompt,
                )
            return content
        except Exception as exc:
            last_exc = exc
            wait = BASE_BACKOFF * (2 ** attempt)
            logger.warning(
                "LLM call attempt %d/%d failed: %s — retrying in %.1fs",
                attempt + 1,
                MAX_RETRIES,
                exc,
                wait,
            )
            if attempt < MAX_RETRIES - 1:
                await asyncio.sleep(wait)

    raise RuntimeError(f"LLM call failed after {MAX_RETRIES} attempts: {last_exc}") from last_exc


async def generate_variants(
    zone_data: dict,
    count: int = 2,
    context: str = "",
) -> list[dict]:
    """
    Generate N CRO variant suggestions for a personalization zone.

    Args:
        zone_data: Zone dict with keys: selector, defaultHtml/default_html, name
        count: Number of variants to generate (1-5)
        context: Additional context about the page, product, or goal

    Returns:
        List of dicts with keys: name, html, rationale
    """
    count = max(1, min(5, count))
    system_prompt = _build_system_prompt()
    user_prompt = _build_user_prompt(zone_data, count, context)

    logger.info(
        "Generating %d variant(s) for zone '%s' (selector: %s)",
        count,
        zone_data.get("name", ""),
        zone_data.get("selector", ""),
    )

    raw_content = await _call_with_retry(system_prompt, user_prompt)

    try:
        variants = _extract_json_array(raw_content)
    except (ValueError, json.JSONDecodeError) as e:
        logger.error("Failed to parse LLM response as JSON array: %s\nRaw: %s", e, raw_content[:500])
        raise ValueError(f"LLM returned invalid JSON: {e}") from e

    # Validate and normalise each variant
    validated: list[dict] = []
    for i, item in enumerate(variants[:count]):
        if not isinstance(item, dict):
            logger.warning("Skipping non-dict variant at index %d: %r", i, item)
            continue
        name = str(item.get("name", f"Variant {i + 1}")).strip() or f"Variant {i + 1}"
        html = str(item.get("html", "")).strip()
        rationale = str(item.get("rationale", "")).strip()

        if not html:
            logger.warning("Skipping variant '%s' — empty html", name)
            continue

        validated.append({"name": name, "html": html, "rationale": rationale})

    if not validated:
        raise ValueError("LLM returned no usable variants")

    logger.info("Generated %d valid variant(s)", len(validated))
    return validated
