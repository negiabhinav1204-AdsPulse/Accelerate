"""Per-template text asset prompt."""

from __future__ import annotations

from src.agentic_platform.app.campaigns.models import (
    CampaignIntent,
    TEMPLATE_TEXT_ASSET_MAP,
    WebsiteContent,
)


def build_text_asset_prompt(
    campaign: CampaignIntent,
    brand_context: str,
    website: WebsiteContent,
) -> str:
    """Build a focused prompt for generating text assets for ONE campaign template.

    Each template has specific field counts and character limits — the prompt
    includes ONLY the rules for this template, keeping the LLM focused.
    """
    template = campaign.template_type
    schema_class = TEMPLATE_TEXT_ASSET_MAP.get(template)
    if schema_class is None:
        raise ValueError(f"No text asset schema for template: {template}")

    # Build field rules from the Pydantic schema
    field_rules = []
    for field_name, field_info in schema_class.model_fields.items():
        if field_name == "finalUrl":
            continue
        meta = field_info.metadata or []
        max_len = field_info.json_schema_extra or {}
        desc = field_info.description or ""

        # Extract constraints from annotations
        constraints = []
        if hasattr(field_info, "metadata"):
            for m in field_info.metadata:
                if hasattr(m, "max_length") and m.max_length:
                    constraints.append(f"max {m.max_length} chars each")

        min_items = getattr(field_info, "min_length", None)
        max_items = getattr(field_info, "max_length", None)

        if field_info.annotation and hasattr(field_info.annotation, "__origin__"):
            # It's a List type
            parts = [f"- {field_name}: list"]
            if min_items is not None and max_items is not None:
                parts.append(f"({min_items}-{max_items} items)")
            if constraints:
                parts.append(f"[{', '.join(constraints)}]")
        else:
            parts = [f"- {field_name}"]
            fld_max = getattr(field_info, "max_length", None)
            if fld_max:
                parts.append(f"(max {fld_max} chars)")

        if desc:
            parts.append(f"— {desc}")
        field_rules.append(" ".join(parts))

    rules_text = "\n".join(field_rules)

    product_context = ""
    if website.product_data:
        pd = website.product_data
        product_context = f"Product: {pd.title}"
        if hasattr(pd, "features") and pd.features:
            product_context += f"\nFeatures: {', '.join(pd.features[:5])}"

    return f"""Generate ad copy for a {campaign.campaign_type} campaign on {campaign.platform}.
Template: {template}

## Brand Context
{brand_context}

## Product/Business
{product_context if product_context else website.metadata.title + ' — ' + website.metadata.description}
Landing URL: {campaign.final_url}

## STRICT Field Rules (follow exactly)
{rules_text}

## Guidelines
- Write compelling, action-oriented ad copy that drives clicks.
- Each headline/description must be UNIQUE — no duplicates or near-duplicates.
- Stay within character limits — Google/Bing will reject ads that exceed them.
- Match the brand voice from the brand context.
- Include the key value proposition and call-to-action.
- For search ads, incorporate relevant keywords naturally.
- Do NOT use ALL CAPS words (Google policy violation) except known acronyms.
- Do NOT use special characters: ! @ % ^ * = {{ }} ; ~ < > ? \\ |
- Set finalUrl to: {campaign.final_url}

Return a valid JSON object matching the schema above."""
