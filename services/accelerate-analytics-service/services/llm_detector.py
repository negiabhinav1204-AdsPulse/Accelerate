"""LLM traffic detection — identify visitors from AI platforms via referrer, UA, URL params."""
from dataclasses import dataclass
from typing import Optional
import re
from urllib.parse import urlparse, parse_qs


@dataclass
class LLMDetectionResult:
    is_llm: bool
    platform: str  # chatgpt | claude | gemini | perplexity | copilot | meta_ai | grok | none
    confidence: float  # 0.0-1.0


REFERRER_RULES = [
    (["chatgpt.com", "chat.openai.com"], "chatgpt"),
    (["claude.ai", "anthropic.com"], "claude"),
    (["gemini.google.com", "bard.google.com"], "gemini"),
    (["perplexity.ai"], "perplexity"),
    (["copilot.microsoft.com", "bing.com/chat"], "copilot"),
    (["meta.ai", "ai.meta.com"], "meta_ai"),
    (["grok.x.ai", "x.com/i/grok"], "grok"),
]

UA_PATTERNS = [
    (re.compile(r"ChatGPT-User", re.I), "chatgpt", 0.95),
    (re.compile(r"GPTBot", re.I), "chatgpt", 0.90),
    (re.compile(r"OAI-SearchBot", re.I), "chatgpt", 0.85),
    (re.compile(r"ClaudeBot", re.I), "claude", 0.90),
    (re.compile(r"Claude-Web", re.I), "claude", 0.90),
    (re.compile(r"Anthropic", re.I), "claude", 0.80),
    (re.compile(r"Google-Extended", re.I), "gemini", 0.80),
    (re.compile(r"PerplexityBot", re.I), "perplexity", 0.95),
    (re.compile(r"CopilotBot", re.I), "copilot", 0.90),
    (re.compile(r"meta-externalagent", re.I), "meta_ai", 0.90),
    (re.compile(r"GrokBot", re.I), "grok", 0.90),
]

# URL param keys that indicate LLM origin (e.g. ?utm_source=chatgpt.com)
_LLM_UTM_SOURCES = {
    "chatgpt.com": "chatgpt",
    "chat.openai.com": "chatgpt",
    "claude.ai": "claude",
    "anthropic.com": "claude",
    "gemini.google.com": "gemini",
    "bard.google.com": "gemini",
    "perplexity.ai": "perplexity",
    "copilot.microsoft.com": "copilot",
    "meta.ai": "meta_ai",
    "ai.meta.com": "meta_ai",
    "grok.x.ai": "grok",
}


def _match_referrer(referrer: str) -> Optional[str]:
    """Return platform name if the referrer hostname matches a known LLM domain."""
    try:
        hostname = urlparse(referrer).hostname or ""
    except Exception:
        return None
    for domains, platform in REFERRER_RULES:
        for domain in domains:
            if hostname == domain or hostname.endswith("." + domain):
                return platform
    return None


def _match_user_agent(user_agent: str) -> Optional[tuple[str, float]]:
    """Return (platform, confidence) if the UA matches a known LLM bot pattern."""
    for pattern, platform, confidence in UA_PATTERNS:
        if pattern.search(user_agent):
            return platform, confidence
    return None


def _match_url_params(page_url: str) -> Optional[str]:
    """Return platform name if utm_source or ref param in URL matches LLM domain."""
    try:
        parsed = urlparse(page_url)
        qs = parse_qs(parsed.query)
    except Exception:
        return None
    # Check utm_source and ref params
    for param in ("utm_source", "ref", "source"):
        values = qs.get(param, [])
        for val in values:
            val_lower = val.lower()
            for domain, platform in _LLM_UTM_SOURCES.items():
                if domain in val_lower:
                    return platform
    return None


def detect_llm_referrer(
    referrer: Optional[str] = None,
    user_agent: Optional[str] = None,
    page_url: Optional[str] = None,
) -> LLMDetectionResult:
    """Detect LLM traffic origin.

    Priority order: Referrer (confidence=1.0) > User-Agent > URL params (confidence=0.75).
    Returns LLMDetectionResult with is_llm, platform, and confidence score.
    """
    # 1. Referrer check — highest confidence
    if referrer:
        platform = _match_referrer(referrer)
        if platform:
            return LLMDetectionResult(is_llm=True, platform=platform, confidence=1.0)

    # 2. User-Agent check
    if user_agent:
        match = _match_user_agent(user_agent)
        if match:
            platform, confidence = match
            return LLMDetectionResult(is_llm=True, platform=platform, confidence=confidence)

    # 3. URL parameter check — lowest confidence
    if page_url:
        platform = _match_url_params(page_url)
        if platform:
            return LLMDetectionResult(is_llm=True, platform=platform, confidence=0.75)

    return LLMDetectionResult(is_llm=False, platform="none", confidence=0.0)


def classify_llm_platform(event: dict) -> str:
    """Classify a pixel event dict and return the LLM platform name or 'none'.

    Expects event to have optional keys: referrer, user_agent, page_url.
    """
    result = detect_llm_referrer(
        referrer=event.get("referrer"),
        user_agent=event.get("user_agent"),
        page_url=event.get("page_url"),
    )
    return result.platform
