/**
 * Campaign creation agent pipeline.
 * Agents run in a phased DAG:
 *   Phase 1 (parallel): Brand, LPU, Competitor  — all use pageContent
 *   Phase 2 (after Phase 1): Intent             — uses brandOut + lpuOut + pageContent
 *   Phase 3 (after Phase 2): Creative           — uses brandOut + lpuOut + intentOut + competitorOut + pageContent
 *   Phase 4: Strategy                           — synthesises all outputs into a MediaPlan
 * Progress is streamed via SSE events through the `enqueue` callback.
 */

import Anthropic from '@anthropic-ai/sdk';
import FirecrawlApp from '@mendable/firecrawl-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

import { transformMediaPlan } from './transformers';
import type { MediaPlan, ConnectedAccount } from './transformers';
import { fetchAllCompetitorAds, formatAdLibraryForPrompt } from '../platforms/meta-ad-library';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentName =
  | 'brand'
  | 'lpu'
  | 'intent'
  | 'trend'
  | 'competitor'
  | 'creative'
  | 'budget'
  | 'strategy';

export type AgentEvent =
  | { type: 'agent_start'; agent: AgentName; message: string }
  | { type: 'agent_progress'; agent: AgentName; message: string; step: number }
  | { type: 'agent_complete'; agent: AgentName; message: string; output: AgentOutput; timeTaken: number; confidence: 'High' | 'Medium' | 'Low' }
  | { type: 'preference_question'; question: string; options?: string[]; questionId: string }
  | { type: 'media_plan'; plan: MediaPlan }
  | { type: 'image_update'; platformAdTypeKey: string; imageUrls: string[] }
  | { type: 'conflict_check'; conflictId: string; message: string; question: string; options: string[] }
  | { type: 'error'; message: string };

export type UserPreferences = {
  primaryPlatform?: string;
  platforms?: string[];       // explicit platform list from user ("only in META" → ['meta'])
  monthlyBudget?: number;
  currency?: string;
  targetCountries?: string[];
  campaignObjective?: string;
  notes?: string; // free-text from the user's initial message
};

export type ConnectedAccountInfo = {
  id: string;
  platform: string;
  accountId: string;
  accountName: string;
  isDefault: boolean;
  status: string;
  currency?: string | null;
  timezone?: string | null;
  accessToken?: string | null;
};

// ---------------------------------------------------------------------------
// Internal agent output types (freely upgraded between agents)
// ---------------------------------------------------------------------------

export type BrandOutput = {
  brandName: string;
  domain: string;
  industry: string;
  iabCategory: string;
  colors: string[];
  fonts: string[];
  tone: 'premium' | 'playful' | 'corporate' | 'dtc_casual' | 'technical' | 'luxury' | 'value_focused';
  brandScale: 'smb' | 'mid_market' | 'enterprise';
  valuePropositions: string[];
  targetAudience: string;
  brandGuidelinesSummary: string;
  socialPresence: { platform: string; url: string }[];
  country: string;
  confidenceScore: number;
};

export type LpuOutput = {
  pageType: 'product' | 'collection' | 'content' | 'lead_gen' | 'homepage' | 'app_install';
  products: string[];
  offers: string[];
  keywords: { keyword: string; relevanceScore: number }[];
  callToAction: string;
  conversionGoal: string;
  trustSignals: string[];
  existingPixels: string[];
  hasStructuredData: boolean;
  mobileOptimized: boolean;
  sslEnabled: boolean;
  heroHeadline: string;
  valuePropositions: string[];
  confidenceScore: number;
};

export type IntentOutput = {
  primaryIntent: 'conversion' | 'consideration' | 'awareness' | 'app_install';
  actionType: 'purchase' | 'add_to_cart' | 'lead_form_submit' | 'app_install' | 'page_visit';
  funnelStage: 'top' | 'mid' | 'bottom';
  keywords: string[];
  audienceSignals: string[];
  platformObjectives: {
    google: { campaignType: string; objective: string; bidStrategy: string };
    meta: { campaignObjective: string; optimizationEvent: string };
    bing: { campaignType: string; objective: string; bidStrategy: string };
  };
  kpiTargets: {
    primaryKpi: string;
    primaryTarget: string;
    secondaryKpi: string;
    secondaryTarget: string;
  };
  multiPhaseRecommended: boolean;
  conflictsDetected: { type: string; description: string; resolution: string }[];
  confidenceScore: number;
};

export type TrendOutput = {
  trends: string[];
  seasonalFactors: string[];
  opportunities: string[];
};

export type CompetitorOutput = {
  competitors: string[];
  competitorStrategies: string[];
  gaps: string[];
  differentiators: string[];
  marketSaturation: 'low' | 'medium' | 'high';
  dominantPlatform: string;
  dominantFormat: string;
  messagingThemes: string[];
  pricingTier: 'budget' | 'mid' | 'premium';
  competitiveGaps: { gapType: string; description: string; opportunityScore: number }[];
};

export type CreativeOutput = {
  headlines: string[];
  descriptions: string[];
  imagePrompts: string[];
  adVariations: {
    headline: string;
    description: string;
    cta: string;
    messagingAngle: string;
  }[];
  rsaHeadlines: {
    text: string;
    slotType: 'high_intent' | 'value_prop' | 'social_proof' | 'urgency' | 'brand';
    pinPosition: number | null;
  }[];
  adExtensions: {
    sitelinks: { title: string; description: string }[];
    callouts: string[];
    structuredSnippet: { header: string; values: string[] };
  };
  concepts: {
    conceptId: string;
    messagingAngle: 'product_benefit' | 'social_proof' | 'offer_urgency' | 'problem_solution' | 'lifestyle';
    headline: string;
    bodyText: string;
    cta: string;
    imageDirection: string;
    brandAlignmentScore: number;
    competitiveDifferentiationScore: number;
  }[];
};

export type BudgetOutput = {
  recommendedTotal: number;
  platformAllocation: Record<string, number>;
  dailyBudget: number;
  duration: number;
};

// Raw outputs used internally between agents
export type AgentRawOutput =
  | BrandOutput
  | LpuOutput
  | IntentOutput
  | TrendOutput
  | CompetitorOutput
  | CreativeOutput
  | BudgetOutput
  | MediaPlan;

// All agent outputs bundled together for DB storage + workflow history re-hydration
export type StoredAgentOutputs = {
  brand: BrandOutput;
  lpu: LpuOutput;
  intent: IntentOutput;
  competitor: CompetitorOutput;
  trend: TrendOutput;
  creative: CreativeOutput;
  budget: BudgetOutput;
};

// UI-compatible output sent to the client via SSE
export type AgentOutput = {
  capabilities?: { title: string; description?: string }[];
  summary?: string;
};

// ---------------------------------------------------------------------------
// Client initialization helpers (lazy — only when env vars are present)
// ---------------------------------------------------------------------------

function getAnthropicClient(): Anthropic {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? '' });
}

function getFirecrawlClient(): FirecrawlApp {
  return new FirecrawlApp({ apiKey: process.env.FIRECRAWL_API_KEY ?? '' });
}

function getGeminiClient(): GoogleGenerativeAI {
  return new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');
}

// ---------------------------------------------------------------------------
// Utility — sleep between progress steps (800–1200 ms)
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jitter(base = 800, spread = 400): number {
  return base + Math.floor(Math.random() * spread);
}

async function streamProgress(
  agent: AgentName,
  messages: string[],
  enqueue: (event: AgentEvent) => void
): Promise<void> {
  for (let i = 0; i < messages.length; i++) {
    await sleep(jitter());
    enqueue({ type: 'agent_progress', agent, message: messages[i]!, step: i });
  }
}

// ---------------------------------------------------------------------------
// Country → Currency mapping (used when connected account currency is missing)
// ---------------------------------------------------------------------------

const COUNTRY_TO_CURRENCY: Record<string, string> = {
  IN: 'INR', US: 'USD', GB: 'GBP', AU: 'AUD', CA: 'CAD',
  EU: 'EUR', DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR',
  NL: 'EUR', BE: 'EUR', AT: 'EUR', PT: 'EUR', FI: 'EUR',
  JP: 'JPY', CN: 'CNY', KR: 'KRW', SG: 'SGD', HK: 'HKD',
  AE: 'AED', SA: 'SAR', BR: 'BRL', MX: 'MXN', ID: 'IDR',
  TH: 'THB', MY: 'MYR', PH: 'PHP', VN: 'VND', PK: 'PKR',
  BD: 'BDT', LK: 'LKR', NZ: 'NZD', ZA: 'ZAR', NG: 'NGN',
};

function currencyForCountry(country: string): string {
  return COUNTRY_TO_CURRENCY[country?.toUpperCase()] ?? 'USD';
}

// Extract homepage URL from any URL (strips path)
function homepageUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return url;
  }
}

// ---------------------------------------------------------------------------
// Helper: scrape URL with Firecrawl (graceful fallback)
// ---------------------------------------------------------------------------

async function scrapeUrl(url: string): Promise<string> {
  try {
    const firecrawl = getFirecrawlClient();
    const result = (await firecrawl.scrape(url, { formats: ['markdown'] })) as Record<string, unknown>;
    if (result.markdown && typeof result.markdown === 'string') {
      return result.markdown.slice(0, 8000); // cap to avoid token overload
    }
  } catch (e) {
    console.warn('[agents] Firecrawl scrape failed:', e);
  }
  return '';
}

/**
 * Extract the actual product images from the page.
 * Priority order:
 *  1. Shopify product JSON API ({url}.json) — exact product images, no HTML parsing needed
 *  2. JSON-LD Product schema from Firecrawl HTML
 *  3. og:image from Firecrawl metadata (last resort — often shows a different product)
 */
async function scrapeProductImages(url: string): Promise<string[]> {
  // 0. Direct fetch — cheapest, fastest. Works for any store that sets og:image server-side
  //    (most modern e-commerce platforms do, including JD Sports, Nike, ASOS, etc.)
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/html,application/xhtml+xml'
      },
      signal: AbortSignal.timeout(8000)
    });
    if (res.ok) {
      const html = await res.text();
      // og:image (highest quality, set by the store specifically for sharing/ads)
      const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
        ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
      if (ogMatch?.[1]?.startsWith('http')) return [ogMatch[1]];

      // twitter:image fallback
      const twMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
        ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
      if (twMatch?.[1]?.startsWith('http')) return [twMatch[1]];
    }
  } catch { /* non-fatal — continue to other methods */ }

  // 1. Shopify product JSON API — standard on all Shopify stores, returns exact images
  try {
    const productJsonUrl = url.replace(/\?.*$/, '') + '.json';
    const res = await fetch(productJsonUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const data = (await res.json()) as { product?: { images?: { src: string }[] } };
      const imgs = data.product?.images ?? [];
      if (imgs.length > 0) {
        return imgs.slice(0, 5).map((i) => i.src);
      }
    }
  } catch { /* not a Shopify store or request failed */ }

  // 2. Firecrawl HTML — JSON-LD Product schema + og:image fallback
  try {
    const firecrawl = getFirecrawlClient();
    const result = (await firecrawl.scrape(url, { formats: ['html', 'markdown'] })) as Record<string, unknown>;
    const html = typeof result.html === 'string' ? result.html : '';
    const images: string[] = [];

    // JSON-LD Product schema
    if (html) {
      const jsonLdMatches = html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
      for (const m of jsonLdMatches) {
        try {
          const data = JSON.parse(m[1]!) as Record<string, unknown>;
          const nodes = Array.isArray(data['@graph']) ? data['@graph'] as Record<string, unknown>[] : [data];
          for (const node of nodes) {
            if (String(node['@type']).toLowerCase() === 'product') {
              const img = node['image'];
              if (typeof img === 'string' && img.startsWith('http')) images.push(img);
              else if (Array.isArray(img)) {
                for (const i of img) {
                  const src = typeof i === 'string' ? i : (i as Record<string,unknown>)['url'];
                  if (typeof src === 'string' && src.startsWith('http') && !images.includes(src)) images.push(src);
                }
              }
            }
          }
        } catch { /* ignore malformed JSON-LD */ }
        if (images.length >= 3) break;
      }
    }

    if (images.length > 0) return images;

    // og:image fallback
    const meta = result.metadata as Record<string, unknown> | undefined;
    for (const key of ['ogImage', 'og:image', 'twitterImage', 'twitter:image']) {
      const v = meta?.[key];
      if (typeof v === 'string' && v.startsWith('http')) return [v];
    }

    // Last resort: find large product images in raw HTML by looking for
    // common CDN/product image patterns in <img> src attributes
    if (html) {
      const imgMatches = [...html.matchAll(/<img[^>]+src="(https?:\/\/[^"]+)"/gi)]
        .map((m) => m[1]!)
        .filter((src) =>
          // Likely a product image: large file, common product CDN patterns
          /\.(jpg|jpeg|png|webp)(\?|$)/i.test(src) &&
          !/logo|icon|sprite|banner|svg|gif|thumb[^/]*16|placeholder/i.test(src) &&
          (src.includes('/product') || src.includes('/media') || src.includes('/images') || src.includes('cdn'))
        );
      if (imgMatches.length > 0) return imgMatches.slice(0, 3);
    }
  } catch { /* non-fatal */ }

  return [];
}

// ---------------------------------------------------------------------------
// Helper: call Claude claude-sonnet-4-6 (non-streaming)
// ---------------------------------------------------------------------------

async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 2048
): Promise<string> {
  try {
    const client = getAnthropicClient();
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }]
    });
    const block = message.content[0];
    if (block?.type === 'text') return block.text;
    return '';
  } catch (e) {
    console.warn('[agents] Claude call failed:', e);
    return '';
  }
}

async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  maxTokens?: number
): Promise<string> {
  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: systemPrompt,
      ...(maxTokens ? { generationConfig: { maxOutputTokens: maxTokens } } : {})
    });
    const result = await model.generateContent(userPrompt);
    return result.response.text();
  } catch (e) {
    console.warn('[agents] Gemini call failed:', e);
    return '';
  }
}

// ---------------------------------------------------------------------------
// Helper: parse JSON safely from LLM response
// ---------------------------------------------------------------------------

function parseJsonFromLlm<T>(text: string, fallback: T): T {
  // Try to extract JSON from markdown code fences or raw JSON
  const fenceMatch = /```(?:json)?\s*([\s\S]+?)\s*```/.exec(text);
  const jsonText = fenceMatch ? fenceMatch[1] : text.trim();
  try {
    return JSON.parse(jsonText ?? '') as T;
  } catch {
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Conflict detection helper
// ---------------------------------------------------------------------------

const SEASONAL_TERMS = ['diwali', 'holi', 'eid', 'christmas', 'black friday', 'sale season', 'new year', 'independence day', 'navratri', 'puja', 'festive season'];

function detectSeasonalConflict(
  userNotes: string,
  trendOut: TrendOutput
): { message: string; question: string; options: string[] } | null {
  if (!userNotes) return null;

  const userNotesLower = userNotes.toLowerCase();
  const mentionedSeason = SEASONAL_TERMS.find((s) => userNotesLower.includes(s));
  if (!mentionedSeason) return null;

  // Check if trends confirm this season (if any trend mentions it, no conflict)
  const trendText = [...trendOut.trends, ...trendOut.seasonalFactors].join(' ').toLowerCase();
  const seasonConfirmed = trendText.includes(mentionedSeason) ||
    trendText.includes('festive') ||
    trendText.includes('seasonal');

  if (seasonConfirmed) return null; // No conflict

  return {
    message: `I noticed you want to create a **${mentionedSeason}** campaign, but our trend analysis suggests this season is not currently active. Running a seasonal campaign outside its peak window typically results in lower ROI.`,
    question: `Would you like to proceed with a ${mentionedSeason} campaign now, or would you prefer to create a general campaign that we can adapt closer to the season?`,
    options: [
      `Yes, proceed with the ${mentionedSeason} campaign now`,
      'Create a general campaign instead',
      `Schedule it for the actual ${mentionedSeason} season`
    ]
  };
}

// ---------------------------------------------------------------------------
// Agent: Brand
// ---------------------------------------------------------------------------

const BRAND_MESSAGES = {
  start: 'Understanding your brand...',
  progress: [
    'Reviewing your website and brand presence',
    'Classifying brand scale and IAB category',
    'Identifying brand tone and visual identity',
    'Extracting key value propositions'
  ],
  complete: 'Brand profile ready'
};

async function runBrandAgent(params: {
  url: string;
  pageContent: string;
  enqueue: (event: AgentEvent) => void;
}): Promise<BrandOutput> {
  const { url, pageContent, enqueue } = params;
  const start = Date.now();

  enqueue({ type: 'agent_start', agent: 'brand', message: BRAND_MESSAGES.start });

  const progressPromise = streamProgress('brand', BRAND_MESSAGES.progress, enqueue);

  const systemPrompt = `You are a brand analyst specializing in digital advertising. Extract structured brand identity information from website content. Respond with valid JSON only — no markdown fences, no explanation.`;

  const userPrompt = `Analyze this website content and extract comprehensive brand identity information.
URL: ${url}

Content:
${pageContent || '(Could not fetch content — infer from URL)'}

Instructions:
1. Classify the brand into the IAB Content Taxonomy v3 — provide the primary category code + human-readable label (e.g. "IAB-602 Fashion & Apparel > Women's Clothing")
2. Classify brand scale from signals: website complexity, product count, brand mentions, pricing, presence of enterprise features
   - smb: small business, few products, simple site, local/regional
   - mid_market: established brand, reasonable product range, multi-region
   - enterprise: large brand, extensive catalog, global presence, multiple sub-brands
3. Classify tone from exactly one of: premium, playful, corporate, dtc_casual, technical, luxury, value_focused
4. Extract primary_colors as hex codes from any visible brand color references
5. Extract font names if mentioned or inferable from brand style
6. Provide a 2-3 sentence brand_guidelines_summary describing voice, visual style, and positioning
7. Set confidence_score: 0.9 if rich brand content, 0.7 if moderate content, 0.5 if sparse

Return a JSON object with these exact fields:
{
  "brandName": "string",
  "domain": "string (domain from URL, no protocol)",
  "industry": "string",
  "iabCategory": "string (e.g. IAB-602 Fashion & Apparel > Women's Clothing)",
  "colors": ["string (hex codes like #FF5733)"],
  "fonts": ["string (font names)"],
  "tone": "premium|playful|corporate|dtc_casual|technical|luxury|value_focused",
  "brandScale": "smb|mid_market|enterprise",
  "valuePropositions": ["string (3-5 core value props)"],
  "targetAudience": "string (1-2 sentence description)",
  "brandGuidelinesSummary": "string (2-3 sentences on voice, visual style, positioning)",
  "socialPresence": [{"platform": "string", "url": "string"}],
  "country": "string (ISO 2-letter country code — PRIORITY ORDER: 1) domain TLD: .in=IN, .co.uk=GB, .de=DE, .au=AU, .ca=CA 2) ₹ or 'Rs.' in content=IN 3) addresses/phone numbers mentioning a country 4) language signals. NEVER default to US unless there is clear evidence.",
  "confidenceScore": number
}`;

  const [rawOutput] = await Promise.all([callGemini(systemPrompt, userPrompt), progressPromise]);

  const hostname = (() => {
    try { return new URL(url).hostname.replace('www.', ''); } catch { return url; }
  })();

  // Derive country from TLD before LLM output — used as fallback and to validate LLM result
  const tldCountry = (() => {
    if (hostname.endsWith('.in')) return 'IN';
    if (hostname.endsWith('.co.uk') || hostname.endsWith('.uk')) return 'GB';
    if (hostname.endsWith('.de')) return 'DE';
    if (hostname.endsWith('.fr')) return 'FR';
    if (hostname.endsWith('.au') || hostname.endsWith('.com.au')) return 'AU';
    if (hostname.endsWith('.ca')) return 'CA';
    if (hostname.endsWith('.jp')) return 'JP';
    if (hostname.endsWith('.sg')) return 'SG';
    if (hostname.endsWith('.ae')) return 'AE';
    if (hostname.endsWith('.br') || hostname.endsWith('.com.br')) return 'BR';
    if (hostname.endsWith('.mx')) return 'MX';
    return null;
  })();

  // Also detect country from ₹ symbol in page content
  const contentCountry = pageContent.includes('₹') || pageContent.includes('Rs.') ? 'IN' : null;

  const detectedCountry = tldCountry ?? contentCountry;

  // Extract brand name from domain (e.g. chumbak.com → Chumbak)
  const brandNameFromDomain = (() => {
    const parts = hostname.split('.');
    // For SLD+TLD like chumbak.com, use parts[0]. For co.uk etc, still parts[0].
    const name = parts[0] ?? 'Brand';
    return name.charAt(0).toUpperCase() + name.slice(1);
  })();

  const output = parseJsonFromLlm<BrandOutput>(rawOutput, {
    brandName: brandNameFromDomain,
    domain: hostname,
    industry: 'General',
    iabCategory: 'IAB-1 Arts & Entertainment',
    colors: ['#000000', '#ffffff'],
    fonts: [],
    tone: 'corporate',
    brandScale: 'smb',
    valuePropositions: ['Quality products', 'Great service'],
    targetAudience: 'General consumers',
    brandGuidelinesSummary: 'A modern brand focused on delivering quality and value to its customers.',
    socialPresence: [],
    country: detectedCountry ?? 'US',
    confidenceScore: pageContent ? 0.7 : 0.5
  });

  // Override country if TLD or content gives a stronger signal
  if (detectedCountry && output.country === 'US') {
    output.country = detectedCountry;
  }

  const timeTaken = Date.now() - start;
  enqueue({
    type: 'agent_complete',
    agent: 'brand',
    message: BRAND_MESSAGES.complete,
    output: {
      capabilities: [
        { title: 'IAB Category', description: output.iabCategory },
        { title: 'Brand Scale', description: output.brandScale },
        { title: 'Tone', description: output.tone },
        ...output.valuePropositions.slice(0, 3).map((vp) => ({ title: vp }))
      ],
      summary: `${output.brandName} — ${output.industry} | ${output.tone} | ${output.brandScale} | Confidence: ${Math.round(output.confidenceScore * 100)}%`
    },
    timeTaken,
    confidence: output.confidenceScore >= 0.8 ? 'High' : output.confidenceScore >= 0.6 ? 'Medium' : 'Low'
  });

  return output;
}

// ---------------------------------------------------------------------------
// Agent: LPU (Landing Page)
// ---------------------------------------------------------------------------

const LPU_MESSAGES = {
  start: 'Reviewing your landing page...',
  progress: [
    'Scanning page structure and layout',
    'Detecting tracking pixels and conversion setup',
    'Extracting product and offer details',
    'Scoring keywords by relevance'
  ],
  complete: 'Landing page insights generated'
};

async function runLpuAgent(params: {
  url: string;
  pageContent: string;
  enqueue: (event: AgentEvent) => void;
}): Promise<LpuOutput> {
  const { url, pageContent, enqueue } = params;
  const start = Date.now();

  enqueue({ type: 'agent_start', agent: 'lpu', message: LPU_MESSAGES.start });

  const progressPromise = streamProgress('lpu', LPU_MESSAGES.progress, enqueue);

  const systemPrompt = `You are a landing page conversion analyst. Extract structured conversion insights from website content. Respond with valid JSON only — no markdown fences, no explanation.`;

  const sslEnabled = url.startsWith('https://');

  const userPrompt = `Analyze this landing page and extract conversion-relevant information.
URL: ${url}
SSL Enabled: ${sslEnabled}

Content:
${pageContent || '(Could not fetch content — infer from URL)'}

Instructions:
1. Classify page type as one of: product, collection, content, lead_gen, homepage, app_install
2. Extract top 10 keywords with relevance scores (0.0–1.0) based on frequency + prominence in the page
3. Detect existing tracking pixels by looking for patterns in the content:
   - Meta Pixel: look for "fbq", "facebook.net", "connect.facebook"
   - Google: look for "gtag", "googletagmanager", "google-analytics"
   - TikTok: look for "tiktok", "analytics.tiktok"
   - Bing/Microsoft: look for "bat.bing", "clarity"
   List only the platforms with detected pixel code (e.g. ["meta", "google"])
4. Extract trust signals: ratings, review counts, certifications, guarantees, customer counts
5. Detect the hero headline (the most prominent text on the page)
6. Set confidence_score: 0.9 if rich content, 0.7 if moderate, 0.5 if sparse

Return a JSON object with these exact fields:
{
  "pageType": "product|collection|content|lead_gen|homepage|app_install",
  "products": ["string (product/service names)"],
  "offers": ["string (discounts, free trials, promotions)"],
  "keywords": [{"keyword": "string", "relevanceScore": number}],
  "callToAction": "string (primary CTA text)",
  "conversionGoal": "string (purchase|sign_up|contact|download|app_install)",
  "trustSignals": ["string (e.g. 4.8/5 rating, 10000+ customers, SSL secured)"],
  "existingPixels": ["string (platforms: meta|google|tiktok|bing)"],
  "hasStructuredData": boolean,
  "mobileOptimized": boolean,
  "sslEnabled": ${sslEnabled},
  "heroHeadline": "string",
  "valuePropositions": ["string (3-5 key value props from the page)"],
  "confidenceScore": number
}`;

  const [rawOutput] = await Promise.all([callGemini(systemPrompt, userPrompt), progressPromise]);

  const output = parseJsonFromLlm<LpuOutput>(rawOutput, {
    pageType: 'homepage',
    products: [],
    offers: [],
    keywords: [],
    callToAction: 'Learn More',
    conversionGoal: 'purchase',
    trustSignals: [],
    existingPixels: [],
    hasStructuredData: false,
    mobileOptimized: true,
    sslEnabled,
    heroHeadline: '',
    valuePropositions: [],
    confidenceScore: pageContent ? 0.7 : 0.5
  });

  // Ensure sslEnabled reflects actual URL
  output.sslEnabled = sslEnabled;

  const timeTaken = Date.now() - start;
  const topKeywords = output.keywords.slice(0, 5).map((k) =>
    typeof k === 'string' ? { title: k } : { title: k.keyword, description: `Score: ${k.relevanceScore.toFixed(2)}` }
  );

  enqueue({
    type: 'agent_complete',
    agent: 'lpu',
    message: LPU_MESSAGES.complete,
    output: {
      capabilities: [
        { title: 'Page Type', description: output.pageType },
        { title: 'Pixels Detected', description: output.existingPixels.length > 0 ? output.existingPixels.join(', ') : 'None detected' },
        ...topKeywords
      ],
      summary: `${output.pageType} page → ${output.callToAction} | Pixels: ${output.existingPixels.join(', ') || 'none'} | Confidence: ${Math.round(output.confidenceScore * 100)}%`
    },
    timeTaken,
    confidence: output.confidenceScore >= 0.8 ? 'High' : output.confidenceScore >= 0.6 ? 'Medium' : 'Low'
  });

  return output;
}

// ---------------------------------------------------------------------------
// Agent: Intent (Phase 2 — depends on brandOut + lpuOut)
// ---------------------------------------------------------------------------

const INTENT_MESSAGES = {
  start: 'Analyzing customer intent signals...',
  progress: [
    'Reviewing brand scale and page type',
    'Applying intent decision matrix',
    'Mapping platform objectives and bid strategies',
    'Setting KPI targets and funnel stage'
  ],
  complete: 'Intent analysis complete'
};

async function runIntentAgent(params: {
  url: string;
  pageContent: string;
  brandOutput: BrandOutput;
  lpuOutput: LpuOutput;
  userPreferences?: UserPreferences;
  enqueue: (event: AgentEvent) => void;
}): Promise<IntentOutput> {
  const { url, pageContent, brandOutput, lpuOutput, userPreferences, enqueue } = params;
  const start = Date.now();

  enqueue({ type: 'agent_start', agent: 'intent', message: INTENT_MESSAGES.start });

  const progressPromise = streamProgress('intent', INTENT_MESSAGES.progress, enqueue);

  const systemPrompt = `You are a search intent analyst specializing in digital advertising strategy. Respond with valid JSON only — no markdown fences, no explanation.`;

  const userPrompt = `Determine the optimal advertising intent and platform strategy for this campaign.

URL: ${url}
Page Content:
${pageContent.slice(0, 2000) || '(Could not fetch content — infer from URL)'}
${userPreferences?.notes ? `\nUser Campaign Notes: ${userPreferences.notes}` : ''}

=== BRAND CONTEXT ===
Brand Name: ${brandOutput.brandName}
Brand Scale: ${brandOutput.brandScale}
Industry: ${brandOutput.industry}
Tone: ${brandOutput.tone}

=== LANDING PAGE CONTEXT ===
Page Type: ${lpuOutput.pageType}
Existing Pixels: ${lpuOutput.existingPixels.join(', ') || 'none'}
Conversion Goal: ${lpuOutput.conversionGoal}
Offers: ${lpuOutput.offers.join(', ') || 'none'}

Apply this decision matrix to determine intent:
- product page + has pixel (meta or google) → conversion intent, purchase action, bottom funnel
- product page + no pixel → consideration intent, page_visit action, mid funnel
- collection page + has pixel → conversion intent, add_to_cart action, bottom funnel
- lead_gen page + has pixel → conversion intent, lead_form_submit action, bottom funnel
- lead_gen page + no pixel → consideration intent, page_visit action, mid funnel
- homepage + smb brand scale → awareness intent, page_visit action, top funnel
- homepage + mid_market or enterprise → consideration intent, page_visit action, mid funnel
- app_install page → app_install intent, app_install action, mid funnel

Based on the detected intent, generate:
1. Platform objectives mapping appropriate to the intent
2. KPI targets appropriate for the industry and intent:
   - Ecommerce/product: ROAS primary, CPA secondary
   - Lead gen: CPL primary, CPC secondary
   - Awareness: CPM primary, CTR secondary
3. Whether multi-phase campaign is recommended (true for top/mid funnel brands, false for bottom funnel ready)
4. Any conflicts (e.g. "no pixel but targeting conversion", "homepage as landing for purchase campaign")

Return a JSON object with these exact fields:
{
  "primaryIntent": "conversion|consideration|awareness|app_install",
  "actionType": "purchase|add_to_cart|lead_form_submit|app_install|page_visit",
  "funnelStage": "top|mid|bottom",
  "keywords": ["string (20 high-intent keywords for paid search, mix of branded and non-branded)"],
  "audienceSignals": ["string (behavioral and interest signals for audience targeting)"],
  "platformObjectives": {
    "google": {
      "campaignType": "string (Search|Shopping|Performance Max|Display)",
      "objective": "string (SALES|LEADS|WEBSITE_TRAFFIC|BRAND_AWARENESS)",
      "bidStrategy": "string (TARGET_CPA|TARGET_ROAS|MAXIMIZE_CONVERSIONS|MAXIMIZE_CLICKS)"
    },
    "meta": {
      "campaignObjective": "string (SALES|LEADS|TRAFFIC|AWARENESS)",
      "optimizationEvent": "string (PURCHASE|LEAD|LANDING_PAGE_VIEW|REACH)"
    },
    "bing": {
      "campaignType": "string (Search|Shopping|Audience)",
      "objective": "string (Conversions|Visits|BrandAwareness)",
      "bidStrategy": "string (TargetCpa|TargetRoas|MaximizeConversions|MaximizeClicks)"
    }
  },
  "kpiTargets": {
    "primaryKpi": "string (ROAS|CPA|CPL|CPC|CPM)",
    "primaryTarget": "string (e.g. 4.0x or $50 or $0.80)",
    "secondaryKpi": "string",
    "secondaryTarget": "string"
  },
  "multiPhaseRecommended": boolean,
  "conflictsDetected": [
    {
      "type": "string (e.g. pixel_missing|landing_page_mismatch|budget_too_low)",
      "description": "string",
      "resolution": "string"
    }
  ],
  "confidenceScore": number
}`;

  const [rawOutput] = await Promise.all([callGemini(systemPrompt, userPrompt), progressPromise]);

  const output = parseJsonFromLlm<IntentOutput>(rawOutput, {
    primaryIntent: 'consideration',
    actionType: 'page_visit',
    funnelStage: 'mid',
    keywords: [],
    audienceSignals: [],
    platformObjectives: {
      google: { campaignType: 'Search', objective: 'WEBSITE_TRAFFIC', bidStrategy: 'MAXIMIZE_CLICKS' },
      meta: { campaignObjective: 'TRAFFIC', optimizationEvent: 'LANDING_PAGE_VIEW' },
      bing: { campaignType: 'Search', objective: 'Visits', bidStrategy: 'MaximizeClicks' }
    },
    kpiTargets: {
      primaryKpi: 'CPC',
      primaryTarget: '$1.00',
      secondaryKpi: 'CTR',
      secondaryTarget: '2%'
    },
    multiPhaseRecommended: false,
    conflictsDetected: [],
    confidenceScore: 0.7
  });

  const timeTaken = Date.now() - start;
  enqueue({
    type: 'agent_complete',
    agent: 'intent',
    message: INTENT_MESSAGES.complete,
    output: {
      capabilities: [
        { title: 'Intent', description: `${output.primaryIntent} → ${output.actionType}` },
        { title: 'Funnel Stage', description: output.funnelStage },
        { title: 'Primary KPI', description: `${output.kpiTargets.primaryKpi}: ${output.kpiTargets.primaryTarget}` },
        ...output.keywords.slice(0, 3).map((k) => ({ title: k }))
      ],
      summary: `${output.funnelStage} funnel | ${output.primaryIntent} intent | ${output.kpiTargets.primaryKpi} target: ${output.kpiTargets.primaryTarget} | Confidence: ${Math.round(output.confidenceScore * 100)}%`
    },
    timeTaken,
    confidence: output.confidenceScore >= 0.8 ? 'High' : output.confidenceScore >= 0.6 ? 'Medium' : 'Low'
  });

  return output;
}

// ---------------------------------------------------------------------------
// Agent: Competitor (Phase 1 — independent, uses pageContent)
// ---------------------------------------------------------------------------

const COMPETITOR_MESSAGES = {
  start: 'Analyzing competitor activity...',
  progress: [
    'Identifying key competitors from page content...',
    'Fetching live competitor ads from Meta Ad Library...',
    'Analyzing competitor messaging and creative patterns...',
    'Mapping competitive gaps and opportunities...',
  ],
  complete: 'Competitor insights ready',
};

async function runCompetitorAgent(params: {
  url: string;
  pageContent: string;
  metaAccessToken?: string | null;
  targetCountries?: string[];
  enqueue: (event: AgentEvent) => void;
}): Promise<CompetitorOutput> {
  const { url, pageContent, metaAccessToken, targetCountries = ['US'], enqueue } = params;
  const start = Date.now();

  enqueue({ type: 'agent_start', agent: 'competitor', message: COMPETITOR_MESSAGES.start });

  const progressPromise = streamProgress('competitor', COMPETITOR_MESSAGES.progress, enqueue);

  const systemPrompt = `You are a competitive intelligence analyst for digital advertising. Respond with valid JSON only — no markdown fences, no explanation.`;

  // ── Phase 1: identify competitor names from page content ──────────────────
  const namePrompt = `Given this website, identify 5-8 likely direct competitors by their exact brand or company name.
URL: ${url}
Page Content:
${pageContent.slice(0, 1500) || '(Could not fetch content — infer from URL)'}

Return JSON only: { "competitors": ["Brand A", "Brand B", ...] }`;

  const rawNames = await callGemini(systemPrompt, namePrompt);
  const { competitors: competitorNames } = parseJsonFromLlm<{ competitors: string[] }>(
    rawNames,
    { competitors: [] }
  );

  // ── Phase 2: fetch real ads from Meta Ad Library ──────────────────────────
  let adLibraryData = '';
  let metaAdsFound = false;

  if (metaAccessToken && competitorNames.length > 0) {
    const adResults = await fetchAllCompetitorAds(
      metaAccessToken,
      competitorNames,
      targetCountries,
      8
    );
    metaAdsFound = adResults.some((r) => r.ads.length > 0);
    adLibraryData = formatAdLibraryForPrompt(adResults);
  }

  // ── Phase 3: deep synthesis with real ad data ─────────────────────────────
  const adDataSection = metaAdsFound
    ? `\n=== REAL COMPETITOR ADS FROM META AD LIBRARY ===\n${adLibraryData}\n\nBase your analysis on the actual ad copy, platforms, and spend data above.`
    : `\n(No Meta Ad Library data available — infer from page content and industry knowledge)`;

  const userPrompt = `Analyze the competitive landscape for this website.

URL: ${url}
Page Content:
${pageContent.slice(0, 2000) || '(Could not fetch content — infer from URL)'}
${adDataSection}

Instructions:
1. Identify direct and indirect competitors (use the names already identified: ${competitorNames.join(', ') || 'infer from URL'})
2. Assess market saturation: low (niche, few players), medium (growing, several players), high (crowded, many established brands)
3. Identify the dominant advertising platform in this category (Google Search, Meta Ads, TikTok, etc.)
4. Identify the dominant ad format (Search text ads, Image carousel, Video, Shopping)
5. Classify competitor messaging themes from the ad copy: discount_led, benefit_led, social_proof, urgency, storytelling, feature_comparison
6. Assess pricing tier relative to competitors: budget, mid, premium
7. Identify specific competitive gaps — what are competitors NOT doing that this brand could exploit?

Return a JSON object with these exact fields:
{
  "competitors": ["string (5-8 competitor names)"],
  "competitorStrategies": ["string (common advertising strategies observed in competitor ads)"],
  "gaps": ["string (market gaps or underserved segments)"],
  "differentiators": ["string (potential differentiators for this brand)"],
  "marketSaturation": "low|medium|high",
  "dominantPlatform": "string (e.g. Google Search, Meta Ads)",
  "dominantFormat": "string (e.g. Search text ads, Image carousel, Video)",
  "messagingThemes": ["string (from: discount_led|benefit_led|social_proof|urgency|storytelling|feature_comparison)"],
  "pricingTier": "budget|mid|premium",
  "competitiveGaps": [
    {
      "gapType": "string (e.g. audience_gap|messaging_gap|platform_gap|offer_gap)",
      "description": "string",
      "opportunityScore": number
    }
  ]
}`;

  const [rawOutput] = await Promise.all([callGemini(systemPrompt, userPrompt), progressPromise]);

  const output = parseJsonFromLlm<CompetitorOutput>(rawOutput, {
    competitors: competitorNames,
    competitorStrategies: ['Search advertising', 'Social media presence'],
    gaps: [],
    differentiators: [],
    marketSaturation: 'medium',
    dominantPlatform: 'Google Search',
    dominantFormat: 'Search text ads',
    messagingThemes: ['benefit_led'],
    pricingTier: 'mid',
    competitiveGaps: [],
  });

  // Ensure competitor names from phase 1 are always present
  if (output.competitors.length === 0 && competitorNames.length > 0) {
    output.competitors = competitorNames;
  }

  const timeTaken = Date.now() - start;
  enqueue({
    type: 'agent_complete',
    agent: 'competitor',
    message: COMPETITOR_MESSAGES.complete,
    output: {
      capabilities: [
        { title: 'Market Saturation', description: output.marketSaturation },
        { title: 'Dominant Platform', description: output.dominantPlatform },
        { title: 'Pricing Tier', description: output.pricingTier },
        ...output.competitors.slice(0, 3).map((c) => ({ title: c, description: 'Competitor' })),
      ],
      summary: `${output.marketSaturation} saturation | ${output.dominantPlatform} | ${output.differentiators[0] ?? 'Competitive analysis complete'}`,
    },
    timeTaken,
    confidence: metaAdsFound ? 'High' : pageContent ? 'Medium' : 'Low',
  });

  return output;
}

// ---------------------------------------------------------------------------
// Agent: Trend (Phase 1 — independent, uses pageContent)
// ---------------------------------------------------------------------------

const TREND_MESSAGES = {
  start: 'Scanning industry trends and seasonal signals...',
  progress: [
    'Identifying macro trends in the category...',
    'Analysing seasonal demand patterns...',
    'Spotting emerging opportunities...',
  ],
  complete: 'Trend signals captured',
};

async function runTrendAgent(params: {
  url: string;
  pageContent: string;
  enqueue: (event: AgentEvent) => void;
}): Promise<TrendOutput> {
  const { url, pageContent, enqueue } = params;
  const start = Date.now();

  enqueue({ type: 'agent_start', agent: 'trend', message: TREND_MESSAGES.start });

  const progressPromise = streamProgress('trend', TREND_MESSAGES.progress, enqueue);

  const systemPrompt = `You are a digital marketing trend analyst. Respond with valid JSON only — no markdown fences, no explanation.`;

  const userPrompt = `Analyse industry trends and seasonal factors relevant to this brand's advertising strategy.

URL: ${url}
Page Content:
${pageContent.slice(0, 2000) || '(Could not fetch content — infer from URL)'}

Instructions:
1. Identify 5-8 macro and micro trends relevant to this industry/category right now
2. Identify seasonal demand factors (high season, low season, key calendar events, holidays)
3. Identify 3-5 emerging advertising opportunities (new ad formats, platforms gaining traction, underutilised tactics)

Return a JSON object with these exact fields:
{
  "trends": ["string — trend name: brief description (e.g. 'Video-first ads: Short-form video outperforms static in this category')"],
  "seasonalFactors": ["string — seasonal signal relevant to campaign timing"],
  "opportunities": ["string — specific actionable opportunity for this brand"]
}`;

  const [rawOutput] = await Promise.all([callGemini(systemPrompt, userPrompt), progressPromise]);

  const output = parseJsonFromLlm<TrendOutput>(rawOutput, {
    trends: ['Performance marketing growth: Brands shifting budgets toward measurable channels'],
    seasonalFactors: ['Evaluate seasonal demand patterns for this category'],
    opportunities: ['Explore emerging ad formats to gain early-mover advantage'],
  });

  const timeTaken = Date.now() - start;
  enqueue({
    type: 'agent_complete',
    agent: 'trend',
    message: TREND_MESSAGES.complete,
    output: {
      capabilities: [
        ...output.trends.slice(0, 3).map((t) => ({ title: 'Trend', description: t })),
        ...output.opportunities.slice(0, 2).map((o) => ({ title: 'Opportunity', description: o })),
      ],
      summary: `${output.trends.length} trends · ${output.seasonalFactors.length} seasonal signals · ${output.opportunities.length} opportunities`
    },
    timeTaken,
    confidence: pageContent ? 'Medium' : 'Low'
  });

  return output;
}

// ---------------------------------------------------------------------------
// Agent: Creative (Phase 3 — depends on brandOut + lpuOut + intentOut + competitorOut)
// ---------------------------------------------------------------------------

const CREATIVE_MESSAGES = {
  start: 'Preparing ad creative concepts...',
  progress: [
    'Loading brand identity and competitive context',
    'Drafting RSA headlines by slot type',
    'Generating 5 messaging concept variations',
    'Scoring brand alignment and competitive differentiation',
    'Preparing image prompts and ad extensions'
  ],
  complete: 'Creative concepts ready'
};

async function runCreativeAgent(params: {
  url: string;
  pageContent: string;
  brandOutput: BrandOutput;
  lpuOutput: LpuOutput;
  intentOutput: IntentOutput;
  competitorOutput: CompetitorOutput;
  userPreferences?: UserPreferences;
  enqueue: (event: AgentEvent) => void;
}): Promise<CreativeOutput> {
  const { url, pageContent, brandOutput, lpuOutput, intentOutput, competitorOutput, userPreferences, enqueue } = params;
  const start = Date.now();

  enqueue({ type: 'agent_start', agent: 'creative', message: CREATIVE_MESSAGES.start });

  const progressPromise = streamProgress('creative', CREATIVE_MESSAGES.progress, enqueue);

  const systemPrompt = `You are a world-class advertising copywriter specializing in high-converting digital ads. You create copy that is brand-aligned, competitively differentiated, and optimized for the detected intent. Respond with valid JSON only — no markdown fences, no explanation.`;

  const userPrompt = `Create compelling, high-converting ad creative for this campaign.

URL: ${url}
${userPreferences?.notes ? `\nUser Campaign Notes (MUST follow): ${userPreferences.notes}` : ''}

=== BRAND CONTEXT ===
Brand: ${brandOutput.brandName} | Tone: ${brandOutput.tone} | Scale: ${brandOutput.brandScale}
Value Props: ${brandOutput.valuePropositions.join(' | ')}
Brand Guidelines: ${brandOutput.brandGuidelinesSummary}

=== LANDING PAGE CONTEXT ===
Page Type: ${lpuOutput.pageType} | Hero: ${lpuOutput.heroHeadline}
Products: ${lpuOutput.products.slice(0, 5).join(', ')}
Offers: ${lpuOutput.offers.join(', ') || 'none'}
Trust Signals: ${lpuOutput.trustSignals.join(' | ') || 'none'}
CTA: ${lpuOutput.callToAction}

=== INTENT CONTEXT ===
Intent: ${intentOutput.primaryIntent} | Funnel: ${intentOutput.funnelStage} | Action: ${intentOutput.actionType}
KPI: ${intentOutput.kpiTargets.primaryKpi} target ${intentOutput.kpiTargets.primaryTarget}

=== COMPETITIVE CONTEXT ===
Competitor Themes: ${competitorOutput.messagingThemes.join(', ')}
Differentiators: ${competitorOutput.differentiators.slice(0, 3).join(' | ')}
Gaps to exploit: ${competitorOutput.competitiveGaps.map(g => g.description).slice(0, 2).join(' | ') || 'none'}

Page Content:
${pageContent.slice(0, 2000) || '(Could not fetch content — infer from URL)'}

Instructions:
1. Generate 15 RSA headlines structured by slot type (max 30 chars each):
   - Slots 1-3: High-intent, keyword-rich (e.g. "Buy {Product} Online")
   - Slots 4-6: Value proposition (e.g. "Free Shipping on All Orders")
   - Slots 7-9: Social proof (pull from trust signals, e.g. "Rated 4.8/5 Stars")
   - Slots 10-12: Urgency/offer (e.g. "Limited Time: 20% Off")
   - Slots 13-15: Brand-focused (e.g. "${brandOutput.brandName} Official Store")
   - Pin the best high-intent headline to position 1, best brand headline to position 2
2. Generate 4 descriptions (max 90 chars each) matching brand tone
3. Generate 5 ad concepts with distinct messaging angles: product_benefit, social_proof, offer_urgency, problem_solution, lifestyle
   - Each concept: headline (40 chars for Meta/30 for Google), bodyText (125 chars for Meta), cta, imageDirection
   - Score each concept for brand alignment (0-1) and competitive differentiation (0-1)
4. Generate ad extensions: 4 sitelinks, 6 callouts, 1 structured snippet
5. Generate 5 image generation prompts that will be fed directly into an AI image generation model (Gemini Imagen).
   Each prompt MUST describe the ACTUAL product from this specific URL — its physical form, colour, material, and style — so the generated image clearly shows that product.
   Start each prompt by naming the exact product type and its key visual attributes (e.g. "Grey marl jogger pants with embroidered country club crest on the left leg, worn by a male model").
   Then add a lifestyle or setting context appropriate to the brand.
   CRITICAL: Do NOT describe generic people, random settings, or stock-photo clichés. The product must be the visual hero of every image.
   CRITICAL: If the user's Campaign Notes mention a seasonal event (e.g. Holi, Diwali, Christmas), set the scene in that festive context while still keeping the product as the focus. Example for Holi: "Grey jogger pants with country club crest, worn by a young man in a colourful Holi celebration, vibrant powder colors in the air, joyful outdoor setting, professional product photography"
   If no seasonal notes are given, use aspirational lifestyle contexts matching the product category (sport, athleisure, streetwear, etc.).

Return a JSON object with these exact fields:
{
  "headlines": ["string (15 headlines, max 30 chars each)"],
  "descriptions": ["string (4 descriptions, max 90 chars each)"],
  "imagePrompts": ["string (5 detailed image generation prompts)"],
  "adVariations": [
    {
      "headline": "string",
      "description": "string",
      "cta": "string",
      "messagingAngle": "string"
    }
  ],
  "rsaHeadlines": [
    {
      "text": "string (max 30 chars)",
      "slotType": "high_intent|value_prop|social_proof|urgency|brand",
      "pinPosition": number or null
    }
  ],
  "adExtensions": {
    "sitelinks": [
      {"title": "string", "description": "string"}
    ],
    "callouts": ["string"],
    "structuredSnippet": {"header": "string", "values": ["string"]}
  },
  "concepts": [
    {
      "conceptId": "string (c1-c5)",
      "messagingAngle": "product_benefit|social_proof|offer_urgency|problem_solution|lifestyle",
      "headline": "string (max 40 chars)",
      "bodyText": "string (max 125 chars)",
      "cta": "string",
      "imageDirection": "string",
      "brandAlignmentScore": number,
      "competitiveDifferentiationScore": number
    }
  ]
}
Provide 5 adVariations and exactly 5 concepts.`;

  const [rawOutput] = await Promise.all([callGemini(systemPrompt, userPrompt), progressPromise]);

  const output = parseJsonFromLlm<CreativeOutput>(rawOutput, {
    headlines: [],
    descriptions: [],
    imagePrompts: [],
    adVariations: [],
    rsaHeadlines: [],
    adExtensions: {
      sitelinks: [],
      callouts: [],
      structuredSnippet: { header: 'Products', values: [] }
    },
    concepts: []
  });

  const timeTaken = Date.now() - start;
  enqueue({
    type: 'agent_complete',
    agent: 'creative',
    message: CREATIVE_MESSAGES.complete,
    output: {
      capabilities: [
        { title: 'RSA Headlines', description: `${output.rsaHeadlines.length || output.headlines.length} headlines across ${output.rsaHeadlines.length > 0 ? '5 slot types' : 'variations'}` },
        { title: 'Ad Concepts', description: `${output.concepts.length} concepts (${output.concepts.map(c => c.messagingAngle).join(', ') || 'varied angles'})` },
        ...output.adVariations.slice(0, 2).map((v) => ({ title: v.headline, description: v.description }))
      ],
      summary: `${output.concepts.length} concepts | ${output.headlines.length} headlines | ${output.adVariations.length} ad variations`
    },
    timeTaken,
    confidence: 'High'
  });

  return output;
}

// ---------------------------------------------------------------------------
// Agent: Budget (remains independent — uses connectedAccounts + userPreferences)
// ---------------------------------------------------------------------------

const BUDGET_MESSAGES = {
  start: 'Analyzing budget distribution...',
  progress: [
    'Reviewing category benchmarks',
    'Evaluating competitive spend signals',
    'Estimating channel-level allocation',
    'Structuring budget inputs'
  ],
  complete: 'Budget inputs prepared'
};

async function runBudgetAgent(params: {
  url: string;
  connectedAccounts: ConnectedAccountInfo[];
  userPreferences?: UserPreferences;
  authorizedPlatforms?: string[];
  brandCountry?: string;
  enqueue: (event: AgentEvent) => void;
}): Promise<BudgetOutput> {
  const { url, connectedAccounts, userPreferences, authorizedPlatforms, brandCountry, enqueue } = params;
  const start = Date.now();

  enqueue({ type: 'agent_start', agent: 'budget', message: BUDGET_MESSAGES.start });

  const progressPromise = streamProgress('budget', BUDGET_MESSAGES.progress, enqueue);

  const connectedPlatforms = authorizedPlatforms && authorizedPlatforms.length > 0
    ? authorizedPlatforms
    : [...new Set(connectedAccounts.map((a) => a.platform))];
  const monthlyBudgetHint = userPreferences?.monthlyBudget;
  const currency =
    userPreferences?.currency ??
    connectedAccounts.find((a) => a.currency)?.currency ??
    (brandCountry ? currencyForCountry(brandCountry) : 'USD');

  const systemPrompt = `You are a digital advertising budget strategist. Respond with valid JSON only — no markdown fences, no explanation.`;

  const userPrompt = `Recommend a campaign budget allocation for this website.

URL: ${url}
Connected Ad Platforms: ${connectedPlatforms.join(', ') || 'google, meta'}
${monthlyBudgetHint ? `User Budget: ${currency} ${monthlyBudgetHint} (MUST use this exact amount)` : ''}
Currency: ${currency}

Provide budget recommendations. Return a JSON object with these exact fields:
{
  "recommendedTotal": number (total campaign budget in ${currency}),
  "platformAllocation": {
    ${(connectedPlatforms.length > 0 ? connectedPlatforms : ['google', 'meta']).map((p) => `"${p}": number (percentage 0-100)`).join(',\n    ')}
  },
  "dailyBudget": number (recommended daily budget),
  "duration": number (recommended campaign duration in days)
}
CRITICAL: Platform percentages must sum to 100. ONLY include the platforms listed above: ${(connectedPlatforms.length > 0 ? connectedPlatforms : ['google', 'meta']).join(', ')}. Do NOT add any other platforms.`;

  const [rawOutput] = await Promise.all([callGemini(systemPrompt, userPrompt), progressPromise]);

  const defaultTotal = monthlyBudgetHint ?? 3000;
  const output = parseJsonFromLlm<BudgetOutput>(rawOutput, {
    recommendedTotal: defaultTotal,
    platformAllocation: connectedPlatforms.reduce(
      (acc, p, i, arr) => {
        acc[p] = Math.round(100 / arr.length);
        return acc;
      },
      {} as Record<string, number>
    ),
    dailyBudget: Math.round(defaultTotal / 30),
    duration: 30
  });

  const timeTaken = Date.now() - start;
  enqueue({
    type: 'agent_complete',
    agent: 'budget',
    message: BUDGET_MESSAGES.complete,
    output: {
      capabilities: Object.entries(output.platformAllocation).map(([platform, pct]) => ({
        title: platform.charAt(0).toUpperCase() + platform.slice(1),
        description: `${pct}% — ${currency} ${Math.round((output.recommendedTotal * pct) / 100).toLocaleString()}`
      })),
      summary: `${currency} ${output.recommendedTotal.toLocaleString()} over ${output.duration} days`
    },
    timeTaken,
    confidence: monthlyBudgetHint ? 'High' : 'Medium'
  });

  return output;
}

// ---------------------------------------------------------------------------
// Agent: Strategy (Phase 4 — synthesises all outputs)
// ---------------------------------------------------------------------------

const STRATEGY_MESSAGES = {
  start: 'Building your campaign strategy...',
  progress: [
    'Combining insights from all analyses',
    'Scoring platforms and structuring allocation rationale',
    'Generating KPI forecast scenarios',
    'Finalizing prerequisites and risk assessment'
  ],
  complete: 'Campaign strategy ready'
};

async function runStrategyAgent(params: {
  url: string;
  organizationId: string;
  connectedAccounts: ConnectedAccountInfo[];
  userPreferences?: UserPreferences;
  authorizedPlatforms?: string[];
  brandOut: BrandOutput;
  lpuOut: LpuOutput;
  intentOut: IntentOutput;
  trendOut: TrendOutput;
  competitorOut: CompetitorOutput;
  creativeOut: CreativeOutput;
  budgetOut: BudgetOutput;
  enqueue: (event: AgentEvent) => void;
}): Promise<MediaPlan> {
  const {
    url,
    connectedAccounts,
    userPreferences,
    authorizedPlatforms,
    brandOut,
    lpuOut,
    intentOut,
    trendOut,
    competitorOut,
    creativeOut,
    budgetOut,
    enqueue
  } = params;
  const start = Date.now();

  enqueue({ type: 'agent_start', agent: 'strategy', message: STRATEGY_MESSAGES.start });

  const progressPromise = streamProgress('strategy', STRATEGY_MESSAGES.progress, enqueue);

  const connectedPlatforms = authorizedPlatforms && authorizedPlatforms.length > 0
    ? authorizedPlatforms
    : [...new Set(connectedAccounts.map((a) => a.platform))];
  const currency =
    userPreferences?.currency ??
    connectedAccounts.find((a) => a.currency)?.currency ??
    currencyForCountry(brandOut.country);

  const hasPixel = lpuOut.existingPixels.length > 0;

  const systemPrompt = `You are a senior digital advertising strategist at InMobi Accelerate. Your job is to synthesize insights from multiple AI agents into a comprehensive, actionable media plan with realistic forecasts and clear prerequisites. Respond with valid JSON only — no markdown fences, no explanation.`;

  const userPrompt = `Create a comprehensive media plan for this campaign.

=== BRAND INSIGHTS ===
${JSON.stringify(brandOut, null, 2)}

=== LANDING PAGE INSIGHTS ===
${JSON.stringify(lpuOut, null, 2)}

=== INTENT ANALYSIS ===
${JSON.stringify(intentOut, null, 2)}

=== COMPETITOR INSIGHTS ===
${JSON.stringify(competitorOut, null, 2)}

=== TREND SIGNALS ===
${JSON.stringify(trendOut, null, 2)}

=== CREATIVE ASSETS ===
Headlines: ${creativeOut.headlines.slice(0, 10).join(' | ')}
Descriptions: ${creativeOut.descriptions.join(' | ')}
Concepts: ${creativeOut.concepts.map(c => `[${c.messagingAngle}] ${c.headline}`).join(' | ')}

=== BUDGET RECOMMENDATION ===
${JSON.stringify(budgetOut, null, 2)}

=== CONSTRAINTS ===
Brand Country: ${brandOut.country} (USE THIS as the primary targeting location. Do NOT default to United States.)
Connected Ad Platforms: ${connectedPlatforms.join(', ') || 'google, meta'}
Currency: ${currency}
Landing Page: ${url}
Tracking Pixels: ${lpuOut.existingPixels.join(', ') || 'none'}
${userPreferences?.campaignObjective ? `User Objective: ${userPreferences.campaignObjective}` : ''}
${userPreferences?.targetCountries ? `Target Countries: ${userPreferences.targetCountries.join(', ')}` : ''}
${userPreferences?.notes ? `User Instructions (MUST follow): ${userPreferences.notes}` : ''}

PLATFORM RULE — STRICTLY ENFORCED: Only generate platforms that are in this exact list: [${connectedPlatforms.join(', ')}]. Do NOT include any other platform. This is non-negotiable.

AD TYPE RULE — STRICTLY ENFORCED: For each platform, include ONLY the 1-2 best-performing ad types for this specific brand and objective. Do NOT list every possible format. Choose what will actually perform best based on the brand profile, audience, and product type. Quality over quantity — a focused plan with 1-2 ad types per platform outperforms a scattered plan with 5.

Do NOT include an "ads" array inside adTypes — ad creatives will be populated separately from the creative agent. Leave adTypes[].ads as an empty array [].

Generate a complete media plan. Include:
1. Executive summary: 3-5 sentence natural language overview of the plan, the rationale, and expected outcomes
2. Platform mix: for each platform include allocation_percentage AND a 1-2 sentence rationale explaining WHY this platform
3. Platform scoring based on: intent match, pixel readiness, competitive gap, creative readiness (scores 0-10 each)
4. Budget breakdown: monthly_total, daily_total, per-platform amounts, minimum_effective_budget
5. KPI forecast with conservative/moderate/aggressive scenarios (impressions, clicks, CTR, conversions, CPA or ROAS)
6. Phasing: if intent agent recommends multi-phase, provide phase breakdown with objectives and budgets
7. Prerequisites: blockers and high-priority items (${!hasPixel ? '"Install tracking pixel" should be a BLOCKER priority' : 'list any setup items'})
8. Audience strategy: prospecting vs retargeting split, specific audience recommendations
9. Risk flags: 2-4 identified risks with severity and mitigation

Return a JSON object matching this exact structure:
{
  "campaignName": "string",
  "objective": "string (SALES|LEADS|WEBSITE_TRAFFIC|BRAND_AWARENESS|APP_PROMOTION)",
  "totalBudget": number,
  "currency": "${currency}",
  "dailyBudget": number,
  "duration": number,
  "startDate": "YYYY-MM-DD",
  "endDate": "YYYY-MM-DD",
  "targetAudience": {
    "locations": ["string"],
    "ageRange": "string",
    "gender": "string",
    "languages": ["string"],
    "interests": ["string"]
  },
  "platforms": [
    {
      "platform": "google|meta|bing",
      "budget": number,
      "budgetPercent": number,
      "rationale": "string (1-2 sentences on why this platform)",
      "platformScore": number,
      "adTypes": [
        {
          "adType": "string (e.g. search|display|pmax|shopping|demand_gen for google; feed|stories|reels|carousel for meta; search|display for bing)",
          "adCount": number,
          "budget": number,
          "budgetPercent": number,
          "targeting": {
            "locations": ["string (country name or city, country)"],
            "ageRange": "string (e.g. 25-44)",
            "gender": "string (All|Male|Female)",
            "languages": ["string"],
            "interests": ["string"],
            "keywords": ["string (for search ad types, 10-20 high-intent keywords)"],
            "negativeKeywords": ["string (3-5 negative keywords to exclude irrelevant traffic)"],
            "matchTypes": ["EXACT|PHRASE|BROAD (one per keyword, matching order)"],
            "deviceTargeting": ["DESKTOP|MOBILE|TABLET"],
            "placements": "AUTOMATIC|MANUAL (for meta: always AUTOMATIC for broad reach)",
            "publisherPlatforms": ["FACEBOOK|INSTAGRAM|AUDIENCE_NETWORK (for meta only)"],
            "optimizationGoal": "string (CONVERSIONS|LINK_CLICKS|REACH|IMPRESSIONS|LEAD_GENERATION)",
            "conversionEvent": "string (PURCHASE|ADD_TO_CART|LEAD|COMPLETE_REGISTRATION for meta)",
            "bidStrategy": "string"
          },
          "bidStrategy": "string",
          "adExtensions": {
            "sitelinks": [{"title": "string", "description": "string", "url": "string"}],
            "callouts": ["string (5-10 chars each, 4-6 callouts)"],
            "structuredSnippets": {"header": "string", "values": ["string"]}
          },
          "ads": []
        }
      ]
    }
  ],
  "summary": {
    "brandName": "${brandOut.brandName}",
    "tagline": "string",
    "primaryObjective": "string"
  },
  "executiveSummary": "string (3-5 sentence overview)",
  "kpiForecast": {
    "conservative": {
      "impressions": number,
      "clicks": number,
      "ctr": number,
      "conversions": number,
      "costPerResult": number,
      "roas": number
    },
    "moderate": {
      "impressions": number,
      "clicks": number,
      "ctr": number,
      "conversions": number,
      "costPerResult": number,
      "roas": number
    },
    "aggressive": {
      "impressions": number,
      "clicks": number,
      "ctr": number,
      "conversions": number,
      "costPerResult": number,
      "roas": number
    }
  },
  "prerequisites": [
    {
      "item": "string",
      "priority": "blocker|high|medium|low",
      "description": "string"
    }
  ],
  "audienceStrategy": {
    "prospectingPercentage": number,
    "retargetingPercentage": number,
    "prospectingAudiences": ["string"],
    "retargetingAudiences": ["string"]
  },
  "riskFlags": [
    {
      "risk": "string",
      "severity": "high|medium|low",
      "mitigation": "string"
    }
  ]
}

FINAL REMINDER: The "platforms" array in your JSON MUST contain ONLY these platforms: [${connectedPlatforms.join(', ')}]. Any platform not in this list will be rejected. Use the creative assets and insights above to populate headlines, descriptions, targeting, and ad variations.`;

  const [rawOutput] = await Promise.all([callGemini(systemPrompt, userPrompt, 8192), progressPromise]);

  type RawPlan = { platforms?: { platform: string }[] } & Record<string, unknown>;
  let rawMediaPlan = parseJsonFromLlm<RawPlan>(rawOutput, {} as RawPlan);

  // Hard-enforce platform filter: remove any platform the LLM hallucinated
  if (rawMediaPlan?.platforms && connectedPlatforms.length > 0) {
    rawMediaPlan = {
      ...rawMediaPlan,
      platforms: rawMediaPlan.platforms.filter((p) => connectedPlatforms.includes(p.platform))
    };
  }

  // Use rich fallback when JSON parse returned empty object (cut-off response)
  const hasValidPlan = rawMediaPlan && Object.keys(rawMediaPlan).length > 0;

  // Transform and validate
  const mediaPlan = transformMediaPlan(
    hasValidPlan ? rawMediaPlan : {
      campaignName: `${brandOut.brandName} Campaign`,
      objective: intentOut.platformObjectives.google.objective || 'SALES',
      totalBudget: budgetOut.recommendedTotal,
      currency,
      dailyBudget: budgetOut.dailyBudget,
      duration: budgetOut.duration,
      startDate: new Date().toISOString().split('T')[0],
      endDate: (() => {
        const d = new Date();
        d.setDate(d.getDate() + budgetOut.duration);
        return d.toISOString().split('T')[0];
      })(),
      targetAudience: {
        locations: userPreferences?.targetCountries ?? [brandOut.country],
        ageRange: '25-44',
        gender: 'All',
        languages: ['English'],
        interests: intentOut.audienceSignals.slice(0, 5)
      },
      platforms: connectedPlatforms.map((p) => ({
        platform: p,
        budget:
          (budgetOut.recommendedTotal * (budgetOut.platformAllocation[p] ?? 50)) / 100,
        budgetPercent: budgetOut.platformAllocation[p] ?? 50,
        adTypes: [
          {
            adType: p === 'google' ? 'search' : 'feed',
            adCount: 3,
            targeting: {
              locations: userPreferences?.targetCountries ?? [brandOut.country],
              ageRange: '25-44',
              gender: 'All',
              languages: ['English'],
              interests: intentOut.audienceSignals.slice(0, 3),
              keywords: intentOut.keywords.slice(0, 10)
            },
            bidStrategy: p === 'google'
              ? intentOut.platformObjectives.google.bidStrategy
              : p === 'meta'
                ? 'lowest cost'
                : intentOut.platformObjectives.bing.bidStrategy,
            ads: creativeOut.adVariations.slice(0, 3).map((v, i) => ({
              id: crypto.randomUUID(),
              headlines: [v.headline, ...creativeOut.headlines.slice(0, 4)],
              descriptions: [v.description, ...creativeOut.descriptions.slice(0, 2)],
              imageUrls: [],
              imagePrompt: creativeOut.imagePrompts[i] ?? creativeOut.imagePrompts[0],
              ctaText: v.cta,
              destinationUrl: url
            }))
          }
        ]
      })),
      summary: {
        brandName: brandOut.brandName,
        tagline: brandOut.valuePropositions[0] ?? '',
        primaryObjective: lpuOut.conversionGoal
      },
      executiveSummary: `A ${intentOut.funnelStage}-funnel campaign for ${brandOut.brandName} targeting ${intentOut.primaryIntent}. The strategy focuses on ${connectedPlatforms.join(' and ')} based on intent match and creative readiness.`,
      prerequisites: hasPixel ? [] : [
        { item: 'Install Tracking Pixel', priority: 'blocker', description: 'No tracking pixel detected. Install Meta Pixel and/or Google Tag before launching conversion campaigns.' }
      ],
      riskFlags: [],
      kpiForecast: null,
      audienceStrategy: null
    },
    connectedAccounts
  );

  // Populate ads in each platform from creativeOut (strategy agent no longer generates them)
  for (const platform of mediaPlan.platforms) {
    for (const adType of platform.adTypes) {
      if (!adType.ads || adType.ads.length === 0) {
        const isSearch = adType.adType === 'search' || adType.adType === 'rsa';
        if (isSearch) {
          adType.ads = [{
            id: crypto.randomUUID(),
            headlines: creativeOut.rsaHeadlines.slice(0, 15).map((h) => h.text),
            descriptions: creativeOut.descriptions.slice(0, 4),
            imageUrls: [],
            ctaText: creativeOut.adVariations[0]?.cta ?? 'Learn More',
            destinationUrl: url
          }];
        } else {
          adType.ads = creativeOut.adVariations.slice(0, 3).map((v, i) => ({
            id: crypto.randomUUID(),
            headlines: [v.headline, ...creativeOut.headlines.slice(0, 4)],
            descriptions: [v.description, ...creativeOut.descriptions.slice(0, 2)],
            imageUrls: [],
            imagePrompt: creativeOut.imagePrompts[i] ?? creativeOut.imagePrompts[0],
            ctaText: v.cta,
            destinationUrl: url
          }));
        }
      }
    }
  }

  const timeTaken = Date.now() - start;
  enqueue({
    type: 'agent_complete',
    agent: 'strategy',
    message: STRATEGY_MESSAGES.complete,
    output: {
      capabilities: mediaPlan.platforms.map((p) => ({
        title: p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
        description: `${p.budgetPercent}% budget — ${mediaPlan.currency} ${p.budget.toLocaleString()}`
      })),
      summary: `${mediaPlan.campaignName} | ${mediaPlan.objective}`
    },
    timeTaken,
    confidence: rawMediaPlan ? 'High' : 'Medium'
  });

  return mediaPlan;
}

// ---------------------------------------------------------------------------
// Main runner: orchestrates all agents in phased DAG
// ---------------------------------------------------------------------------

export async function runCampaignAgents(params: {
  url: string;
  organizationId: string;
  connectedAccounts: ConnectedAccountInfo[];
  userPreferences?: UserPreferences;
  enqueue: (event: AgentEvent) => void;
}): Promise<{ mediaPlan: MediaPlan; agentOutputs: StoredAgentOutputs }> {
  const { url, organizationId, connectedAccounts, userPreferences, enqueue } = params;

  // Filter connected accounts to user-specified platforms (e.g. "only in META")
  const platformFilter = userPreferences?.platforms;
  const activeAccounts =
    platformFilter && platformFilter.length > 0
      ? connectedAccounts.filter((a) => platformFilter.includes(a.platform))
      : connectedAccounts;

  // Authoritative platform list: user-specified > derived from accounts > default
  const authorizedPlatforms: string[] =
    platformFilter && platformFilter.length > 0
      ? platformFilter
      : activeAccounts.length > 0
      ? [...new Set(activeAccounts.map((a) => a.platform))]
      : ['google', 'meta'];

  // Scrape both the given URL and the homepage (for brand detection)
  // Also extract real product images so ads use them instead of AI-generated images
  const homepage = homepageUrl(url);
  const [pageContent, homepageContent, productImages] = await Promise.all([
    scrapeUrl(url),
    homepage !== url ? scrapeUrl(homepage) : Promise.resolve(''),
    scrapeProductImages(url)
  ]);
  // Combine homepage + product page content for brand agent (homepage has stronger brand signals)
  const brandPageContent = homepageContent
    ? `=== HOMEPAGE ===\n${homepageContent}\n\n=== PRODUCT PAGE ===\n${pageContent}`
    : pageContent;

  // Extract Meta access token for Ad Library competitor research
  const metaAccount =
    connectedAccounts.find((a) => a.platform === 'meta' && a.isDefault) ??
    connectedAccounts.find((a) => a.platform === 'meta');
  const metaAccessToken = metaAccount?.accessToken ?? null;

  // Resolve target countries: user pref → default US
  const targetCountries =
    userPreferences?.targetCountries && userPreferences.targetCountries.length > 0
      ? userPreferences.targetCountries
      : ['US'];

  // Phase 1 (parallel): Brand, LPU, Competitor, Trend — all independent, use pageContent
  const [brandOut, lpuOut, competitorOut, trendOut] = await Promise.all([
    runBrandAgent({ url: homepage, pageContent: brandPageContent, enqueue }),
    runLpuAgent({ url, pageContent, enqueue }),
    runCompetitorAgent({ url, pageContent, metaAccessToken, targetCountries, enqueue }),
    runTrendAgent({ url, pageContent, enqueue })
  ]);

  // Conflict check: does user intent conflict with trend signals?
  const conflictSignal = detectSeasonalConflict(userPreferences?.notes ?? '', trendOut);
  if (conflictSignal) {
    enqueue({
      type: 'conflict_check',
      conflictId: `conflict_${Date.now()}`,
      message: conflictSignal.message,
      question: conflictSignal.question,
      options: conflictSignal.options
    } as unknown as AgentEvent);
    // Return a sentinel to signal the pipeline was paused
    throw new Error('CONFLICT_DETECTED');
  }

  // Phase 2 (after Phase 1): Intent — uses brandOut + lpuOut + pageContent
  const intentOut = await runIntentAgent({
    url,
    pageContent,
    brandOutput: brandOut,
    lpuOutput: lpuOut,
    userPreferences,
    enqueue
  });

  // Phase 3 (after Phase 1+2): Creative — uses brandOut + lpuOut + intentOut + competitorOut + pageContent
  // Budget runs in parallel with Creative since it is independent of all agent outputs
  const [creativeOut, budgetOut] = await Promise.all([
    runCreativeAgent({
      url,
      pageContent,
      brandOutput: brandOut,
      lpuOutput: lpuOut,
      intentOutput: intentOut,
      competitorOutput: competitorOut,
      userPreferences,
      enqueue
    }),
    runBudgetAgent({ url, connectedAccounts: activeAccounts, userPreferences, authorizedPlatforms, brandCountry: brandOut.country, enqueue })
  ]);

  // Phase 4: Strategy — synthesises all outputs
  const mediaPlan = await runStrategyAgent({
    url,
    organizationId,
    connectedAccounts: activeAccounts,
    userPreferences,
    authorizedPlatforms,
    brandOut,
    lpuOut,
    intentOut,
    trendOut,
    competitorOut,
    creativeOut,
    budgetOut,
    enqueue
  });

  // When the user specifies a seasonal/event theme, let the Creative agent's
  // Always use real product images when available — they look better than AI-generated ones.
  // The ad copy (headlines/descriptions) already carries any seasonal/theme context.
  if (productImages.length > 0) {
    for (const platform of mediaPlan.platforms) {
      for (const adType of platform.adTypes) {
        const t = adType.adType.toLowerCase();
        if (t === 'search' || t === 'rsa') continue;
        for (let i = 0; i < adType.ads.length; i++) {
          const ad = adType.ads[i];
          if (ad && ad.imageUrls.length === 0) {
            ad.imageUrls = [productImages[i % productImages.length]!];
          }
        }
      }
    }
  }

  return {
    mediaPlan,
    productImages,
    agentOutputs: {
      brand: brandOut,
      lpu: lpuOut,
      intent: intentOut,
      competitor: competitorOut,
      trend: trendOut,
      creative: creativeOut,
      budget: budgetOut
    }
  };
}
