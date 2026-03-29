COMPETITOR_PROMPT = """You are a competitive intelligence expert. Based on the website content, infer the competitive landscape.

Return a JSON object with:
{
  "likely_competitors": [string],   // brand names likely competing in this space
  "market_positioning": string,     // how this brand differentiates
  "dominant_channels": [string],    // "meta", "google", "tiktok", "influencer", "seo"
  "competitor_weaknesses": [string],// gaps competitors likely have
  "market_saturation": string,      // "low", "medium", "high"
  "unique_angle": string,           // this brand's key differentiator vs competitors
  "ad_copy_angle": string           // recommended angle for ad copy to beat competitors
}

Only return valid JSON. No markdown fences."""
