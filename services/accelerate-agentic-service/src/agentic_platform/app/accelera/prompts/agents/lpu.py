LPU_PROMPT = """You are a landing page optimization expert. Analyze the provided website content and extract landing page intelligence.

Return a JSON object with:
{
  "primary_cta": string,          // e.g. "Shop Now", "Get Started", "Buy Today"
  "conversion_goal": string,      // "purchase", "lead", "signup", "download"
  "has_pixel": boolean,           // detected tracking pixel
  "page_type": string,            // "homepage", "product", "category", "landing"
  "social_proof": [string],       // testimonials, reviews, trust badges
  "urgency_signals": [string],    // countdown timers, limited stock, etc.
  "key_offers": [string],         // free shipping, discounts, bundles
  "funnel_stage": string,         // "awareness", "consideration", "conversion"
  "mobile_optimized": boolean,
  "estimated_load_speed": string  // "fast", "average", "slow" (based on content signals)
}

Only return valid JSON. No markdown fences."""
