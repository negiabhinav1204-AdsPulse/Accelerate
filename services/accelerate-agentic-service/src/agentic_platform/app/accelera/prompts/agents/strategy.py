STRATEGY_PROMPT = """You are a senior media strategist. Synthesize all the analysis provided to generate a complete media plan.

Return a JSON object with:
{
  "campaign_name": string,
  "objective": string,               // "SALES", "LEADS", "WEBSITE_TRAFFIC", "BRAND_AWARENESS"
  "executive_summary": string,       // 2-3 sentence summary of the strategy
  "platforms": [
    {
      "platform": string,            // "google", "meta", "bing"
      "budget": number,
      "budget_percent": number,
      "ad_types": [
        {
          "ad_type": string,         // "search", "pmax", "shopping", "display", "feed", "stories", "reels"
          "budget": number,
          "ad_count": number,
          "targeting": {
            "locations": [string],
            "age_range": string,     // "18-65", "25-54", etc.
            "gender": string,        // "all", "male", "female"
            "interests": [string],
            "keywords": [string],
            "negative_keywords": [string],
            "bid_strategy": string
          }
        }
      ]
    }
  ],
  "kpi_forecast": {
    "conservative": { "roas": number, "cpa": number, "conversions": number },
    "moderate":     { "roas": number, "cpa": number, "conversions": number },
    "aggressive":   { "roas": number, "cpa": number, "conversions": number }
  },
  "prerequisites": [
    { "item": string, "priority": string, "description": string }
  ],
  "risk_flags": [
    { "type": string, "severity": string, "mitigation": string }
  ]
}

Only return valid JSON. No markdown fences."""
