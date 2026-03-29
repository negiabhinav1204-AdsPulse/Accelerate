"""LLM model selection and structured output.

    get_llm("sonnet")                      -> LangChain ChatAnthropic
    await structured_llm_call(p, S, "haiku") -> validated Pydantic model

Model names are defined in config.py MODELS dict. That's the only place to update.
"""

import logging
import re
from typing import Any, Type, TypeVar

import instructor
from pydantic import BaseModel
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_anthropic import ChatAnthropic
from langchain_openai import ChatOpenAI
from langchain_google_genai import ChatGoogleGenerativeAI

from src.agentic_platform.core.config import settings, MODELS

T = TypeVar("T", bound=BaseModel)
logger = logging.getLogger(__name__)

_OPENAI_RE = re.compile(r"^(o\d|gpt)", re.IGNORECASE)
_INSTRUCTOR_CACHE: dict[str, Any] = {}


def _resolve(name: str) -> tuple[str, str]:
    """Name -> (provider, model_id). Raises if unknown."""
    model_id = MODELS.get(name, name)  # allow direct model IDs too

    if "claude" in model_id or "anthropic" in model_id:
        return "anthropic", model_id
    if "gpt" in model_id or model_id.startswith("o"):
        return "openai", model_id
    if "gemini" in model_id:
        return "google", model_id

    raise ValueError(f"Unknown model '{name}'. Available: {', '.join(MODELS.keys())}")


def get_llm(name: str, **kwargs) -> BaseChatModel:
    """Create a LangChain chat model.  get_llm("sonnet")"""
    provider, model_id = _resolve(name)
    logger.info("get_llm: %s -> %s (%s)", name, provider, model_id)

    if provider == "anthropic":
        return ChatAnthropic(model=model_id, **kwargs)
    if provider == "openai":
        return ChatOpenAI(model=model_id, **kwargs)
    return ChatGoogleGenerativeAI(model=model_id, **kwargs)


def get_instructor(name: str) -> tuple[Any, str, str]:
    """Cached async instructor client. Returns (client, provider, model_id)."""
    provider, model_id = _resolve(name)
    key = f"{provider}/{model_id}"
    if key not in _INSTRUCTOR_CACHE:
        _INSTRUCTOR_CACHE[key] = instructor.from_provider(key, async_client=True)
    return _INSTRUCTOR_CACHE[key], provider, model_id


async def structured_llm_call(
    prompt: str,
    schema: Type[T],
    model: str = "",
    max_tokens: int = 16000,
    max_retries: int = 2,
    temperature: float = 0.0,
    system_prompt: str | None = None,
) -> T:
    """Validated structured LLM output.  structured_llm_call(prompt, Schema, "haiku")"""
    if not model:
        model = "sonnet"

    client, provider, model_id = get_instructor(model)

    messages: list[dict[str, str]] = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})

    kwargs: dict[str, Any] = {
        "messages": messages,
        "response_model": schema,
        "max_retries": max_retries,
    }

    if provider == "google":
        kwargs["generation_config"] = {"temperature": temperature, "max_tokens": max_tokens}
        kwargs["strict"] = False
    elif provider == "openai" and re.match(r"^(o\d|gpt-5)", model_id, re.I):
        kwargs["max_completion_tokens"] = max_tokens
    else:
        kwargs["temperature"] = temperature
        kwargs["max_tokens"] = max_tokens

    logger.debug("llm_call: %s/%s -> %s", provider, model_id, schema.__name__)
    return await client.create(**kwargs)
