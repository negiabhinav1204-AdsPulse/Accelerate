"""Centralized configuration via Pydantic Settings.

ALL environment variables are declared here. Application code imports `settings`
and reads attributes — never calls os.getenv() directly.
"""

from urllib.parse import urlencode, quote_plus

from pydantic import computed_field
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()


# ══════════════════════════════════════════════════════════════════
# LLM Models — one flat map. Pick a name, get a model.
#
# Usage in code:  get_llm("sonnet")
# Usage in .env:  CAMPAIGN_AGENT_MODEL=sonnet
#
# To update a model version, change it here. All code picks it up.
# Updated: 2026-03-19
# ══════════════════════════════════════════════════════════════════

MODELS: dict[str, str] = {
    # ── Anthropic ─────────────────────────────────────────────
    "haiku":              "claude-haiku-4-5-20251001",
    "sonnet":             "claude-sonnet-4-6",
    "opus":               "claude-opus-4-6",

    # ── OpenAI ────────────────────────────────────────────────
    "gpt-mini":           "gpt-4.1-mini-2025-04-14",
    "gpt":                "gpt-4.1-2025-04-14",
    "gpt-pro":            "gpt-5.4-2026-03-05",

    # ── Google (stable) ──────────────────────────────────────
    "flash":              "gemini-2.5-flash",
    "gemini-pro":         "gemini-2.5-pro",

    # ── Google (preview) ─────────────────────────────────────
    "flash-preview":      "gemini-3-flash-preview",
    "gemini-pro-preview": "gemini-3.1-pro-preview",
}

# ══════════════════════════════════════════════════════════════════
# Image Gen Models — separate from LLM, these are image APIs.
# ══════════════════════════════════════════════════════════════════

IMAGE_MODELS: dict[str, str] = {
    "openai":              "gpt-image-1.5",
    "imagen":              "imagen",                          # Imagen 4 (stable)
    "gemini":              "gemini-2.5-flash-image",          # Nano Banana (stable)
    "gemini-preview":      "gemini-3.1-flash-image-preview",  # Nano Banana 2 (preview)
    "gemini-pro-preview":  "gemini-3-pro-image-preview",      # Nano Banana Pro — 4K design engine (preview)
}


class Settings(BaseSettings):
    # ── Core ─────────────────────────────────────────────────────────
    db_service_url: str = "http://localhost:8000"

    # ── LLM model selection ──────────────────────────────────────────
    # Use any name from MODELS above. That's it.
    campaign_agent_model: str = "sonnet"       # main chat agent
    workflow_analyze_model: str = "haiku"       # 4 analysis agents (fast)
    workflow_plan_model: str = "gpt-pro"        # campaign strategy (GPT-5.x: fast structured output, v2 uses gpt-5.2)
    workflow_build_model: str = "gpt-pro"       # text asset gen (GPT-5.x: fewer char-limit violations + faster, v2 uses gpt-5.2)
    image_prompt_enhance_model: str = "haiku"   # image prompt enhancement

    # ── Image generation ─────────────────────────────────────────────
    # Use any name from IMAGE_MODELS above.
    image_gen_model: str = "gemini-preview"             # gemini (~5-8s/img) vs openai (~20-30s/img); v2 uses gemini-2.5-flash-image
    image_partial_count: int = 2                # OpenAI streaming partials (0-3)

    # ── Checkpointer Postgres ────────────────────────────────────────
    db_host: str = "localhost"
    db_port: str = "5432"
    db_user: str = "postgres"
    db_password: str = "postgres"
    db_name: str = "langgraph_checkpoints"
    db_sslmode: str = ""

    @computed_field  # type: ignore[prop-decorator]
    @property
    def checkpointer_db_url(self) -> str:
        userinfo = f"{quote_plus(self.db_user)}:{quote_plus(self.db_password)}"
        url = f"postgresql://{userinfo}@{self.db_host}:{self.db_port}/{self.db_name}"
        if self.db_sslmode:
            url += f"?{urlencode({'sslmode': self.db_sslmode})}"
        return url

    # ── Langfuse ─────────────────────────────────────────────────────
    langfuse_secret_key: str = ""
    langfuse_public_key: str = ""
    langfuse_base_url: str = "https://cloud.langfuse.com"
    langfuse_enabled: bool = True

    # ── Campaign service ─────────────────────────────────────────────
    campaign_checkpointer_db_url: str = ""
    campaign_db_service_url: str = ""
    campaign_service_url: str = "http://localhost:8081"

    # ── Local dev: override org/user context ─────────────────────────
    # Skips JWT auth, uses the configured identity for all requests.
    local_override_org_context: bool = False
    local_dev_org_id: str = ""
    local_dev_user_id: str = ""
    local_dev_user_email: str = "dev@accelerate.local"
    local_dev_auth_token: str = ""

    # ── Local dev: mock connected ad platforms ─────────────────────
    # Injects fake Google/Bing accounts so campaign workflows run
    # without real ad platform connections.
    local_override_mock_supported_campaigns: bool = False
    local_dev_google_account_id: str = "local-google-dev"
    local_dev_google_customer_id: str = "123-456-7890"
    local_dev_google_currency: str = "USD"
    local_dev_google_account_name: str = "Local Dev Google Ads"
    local_dev_bing_account_id: str = "local-bing-dev"
    local_dev_bing_customer_id: str = "987654321"
    local_dev_bing_currency: str = "USD"
    local_dev_bing_account_name: str = "Local Dev Microsoft Ads"
    local_dev_platform_timezone: str = "America/Los_Angeles"


    # ── GCS (image storage) ──────────────────────────────────────────
    gcs_bucket_name: str = ""
    gcs_cdn_base_url: str = ""
    gcs_path_prefix: str = ""

    # ── HTTP client ──────────────────────────────────────────────────
    http_client_timeout: float = 30
    http_client_connect_timeout: float = 10
    http_client_max_connections: int = 100
    http_client_max_keepalive: int = 20
    http_client_keepalive_expiry: float = 30

    # ── HTTP retry ───────────────────────────────────────────────────
    http_retry_max_attempts: int = 3
    http_retry_base_delay: float = 1.0
    http_retry_max_delay: float = 30.0
    http_retry_jitter: float = 0.25

    # ── HTTP circuit breaker ─────────────────────────────────────────
    http_cb_enabled: bool = True
    http_cb_failure_threshold: int = 5
    http_cb_recovery_timeout: float = 30.0

    # ── Analytics MCP Sidecar ─────────────────────────────────────────
    analytics_mcp_url: str = "http://localhost:5001"      # MCP Toolbox sidecar (BigQuery)
    bigquery_project: str = "accelerate-nonprod-4e59"
    bigquery_dataset: str = "accelerate_ingestion_store"

    # ── Accelera AI downstream microservices ─────────────────────────
    # Internal service auth (x-internal-api-key header)
    internal_api_key: str = ""

    # Downstream service URLs (match Accelerate platform service-router.ts)
    commerce_service_url: str = "http://localhost:8082"
    reporting_service_url: str = "http://localhost:8083"
    memory_service_url: str = "http://localhost:8084"
    connector_service_url: str = "http://localhost:8085"
    shopping_feeds_service_url: str = "http://localhost:8086"
    cdp_service_url: str = "http://localhost:8087"
    campaigns_service_url: str = "http://localhost:8088"   # new campaigns microservice
    creative_service_url: str = "http://localhost:8089"    # accelerate-creative-service
    agent_service_url: str = "http://localhost:8090"        # accelerate-agent-service (media planner)
    personalization_service_url: str = "http://localhost:8091"  # accelerate-personalization-service (A/B)
    leads_service_url: str = "http://localhost:8092"           # accelerate-leads-service
    analytics_service_url: str = "http://localhost:8093"       # accelerate-analytics-service

    # Web scraping for campaign creation workflow
    firecrawl_api_key: str = ""

    # Accelera AI agent model (Sonnet 4.6 — upgraded from Haiku 4.5)
    accelera_agent_model: str = "sonnet"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
