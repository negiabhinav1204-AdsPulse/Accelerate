/**
 * Campaign creation agent pipeline.
 * 7 agents run in parallel, then a Strategy agent synthesizes results into a MediaPlan.
 * Progress is streamed via SSE events through the `enqueue` callback.
 */

import Anthropic from '@anthropic-ai/sdk';
import FirecrawlApp from '@mendable/firecrawl-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

import { transformMediaPlan } from './transformers';
import type { MediaPlan, ConnectedAccount } from './transformers';

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
  | { type: 'error'; message: string };

export type UserPreferences = {
  primaryPlatform?: string;
  monthlyBudget?: number;
  currency?: string;
  targetCountries?: string[];
  campaignObjective?: string;
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
};

// Agent output types
export type BrandOutput = {
  brandName: string;
  industry: string;
  colors: string[];
  tone: string;
  valuePropositions: string[];
  targetAudience: string;
};

export type LpuOutput = {
  pageType: string;
  products: string[];
  offers: string[];
  keywords: string[];
  callToAction: string;
  conversionGoal: string;
};

export type IntentOutput = {
  primaryIntent: string;
  keywords: string[];
  funnelStage: string;
  audienceSignals: string[];
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
};

export type CreativeOutput = {
  headlines: string[];
  descriptions: string[];
  imagePrompts: string[];
  adVariations: Array<{
    headline: string;
    description: string;
    cta: string;
  }>;
};

export type BudgetOutput = {
  recommendedTotal: number;
  platformAllocation: Record<string, number>;
  dailyBudget: number;
  duration: number;
};

export type AgentOutput =
  | BrandOutput
  | LpuOutput
  | IntentOutput
  | TrendOutput
  | CompetitorOutput
  | CreativeOutput
  | BudgetOutput
  | MediaPlan;

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

// ---------------------------------------------------------------------------
// Helper: call Claude claude-sonnet-4-6 (non-streaming)
// ---------------------------------------------------------------------------

async function callClaude(systemPrompt: string, userPrompt: string): Promise<string> {
  try {
    const client = getAnthropicClient();
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
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
// Agent: Brand
// ---------------------------------------------------------------------------

const BRAND_MESSAGES = {
  start: 'Understanding your brand...',
  progress: [
    'Reviewing your website and brand presence',
    'Identifying brand tone and messaging style',
    'Extracting key value propositions',
    'Structuring brand identity signals'
  ],
  complete: 'Brand profile ready'
};

async function runBrandAgent(params: {
  url: string;
  enqueue: (event: AgentEvent) => void;
}): Promise<BrandOutput> {
  const { url, enqueue } = params;
  const start = Date.now();

  enqueue({ type: 'agent_start', agent: 'brand', message: BRAND_MESSAGES.start });

  const progressPromise = streamProgress('brand', BRAND_MESSAGES.progress, enqueue);

  const pageContent = await scrapeUrl(url);

  const systemPrompt = `You are a brand analyst. Extract structured brand identity information from website content. Respond with valid JSON only — no markdown fences, no explanation.`;

  const userPrompt = `Analyze this website content and extract brand identity information.
URL: ${url}

Content:
${pageContent || '(Could not fetch content — infer from URL)'}

Return a JSON object with these exact fields:
{
  "brandName": "string",
  "industry": "string",
  "colors": ["string"],
  "tone": "string (e.g. professional, friendly, playful, bold)",
  "valuePropositions": ["string"],
  "targetAudience": "string"
}`;

  const [rawOutput] = await Promise.all([callClaude(systemPrompt, userPrompt), progressPromise]);

  const output = parseJsonFromLlm<BrandOutput>(rawOutput, {
    brandName: new URL(url).hostname.replace('www.', '').split('.')[0] ?? 'Brand',
    industry: 'General',
    colors: ['#000000', '#ffffff'],
    tone: 'professional',
    valuePropositions: ['Quality products', 'Great service'],
    targetAudience: 'General consumers'
  });

  const timeTaken = Date.now() - start;
  enqueue({
    type: 'agent_complete',
    agent: 'brand',
    message: BRAND_MESSAGES.complete,
    output,
    timeTaken,
    confidence: pageContent ? 'High' : 'Low'
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
    'Evaluating user experience and clarity',
    'Extracting product and offer details',
    'Identifying conversion elements'
  ],
  complete: 'Landing page insights generated'
};

async function runLpuAgent(params: {
  url: string;
  enqueue: (event: AgentEvent) => void;
}): Promise<LpuOutput> {
  const { url, enqueue } = params;
  const start = Date.now();

  enqueue({ type: 'agent_start', agent: 'lpu', message: LPU_MESSAGES.start });

  const progressPromise = streamProgress('lpu', LPU_MESSAGES.progress, enqueue);

  const pageContent = await scrapeUrl(url);

  const systemPrompt = `You are a landing page analyst. Extract structured conversion insights from website content. Respond with valid JSON only — no markdown fences, no explanation.`;

  const userPrompt = `Analyze this landing page and extract conversion-relevant information.
URL: ${url}

Content:
${pageContent || '(Could not fetch content — infer from URL)'}

Return a JSON object with these exact fields:
{
  "pageType": "string (e.g. homepage, product, landing, ecommerce, saas)",
  "products": ["string"],
  "offers": ["string (discounts, free trials, promotions)"],
  "keywords": ["string (10-15 relevant search keywords)"],
  "callToAction": "string (primary CTA text)",
  "conversionGoal": "string (e.g. purchase, sign-up, contact, download)"
}`;

  const [rawOutput] = await Promise.all([callClaude(systemPrompt, userPrompt), progressPromise]);

  const output = parseJsonFromLlm<LpuOutput>(rawOutput, {
    pageType: 'homepage',
    products: [],
    offers: [],
    keywords: [],
    callToAction: 'Learn More',
    conversionGoal: 'purchase'
  });

  const timeTaken = Date.now() - start;
  enqueue({
    type: 'agent_complete',
    agent: 'lpu',
    message: LPU_MESSAGES.complete,
    output,
    timeTaken,
    confidence: pageContent ? 'High' : 'Medium'
  });

  return output;
}

// ---------------------------------------------------------------------------
// Agent: Intent
// ---------------------------------------------------------------------------

const INTENT_MESSAGES = {
  start: 'Analyzing customer intent signals...',
  progress: [
    'Reviewing search and engagement patterns',
    'Mapping intent across funnel stages',
    'Identifying high-intent keyword themes',
    'Aligning intent with ad platforms'
  ],
  complete: 'Intent analysis complete'
};

async function runIntentAgent(params: {
  url: string;
  lpuOutput: LpuOutput;
  brandOutput: BrandOutput;
  enqueue: (event: AgentEvent) => void;
}): Promise<IntentOutput> {
  const { url, lpuOutput, brandOutput, enqueue } = params;
  const start = Date.now();

  enqueue({ type: 'agent_start', agent: 'intent', message: INTENT_MESSAGES.start });

  const progressPromise = streamProgress('intent', INTENT_MESSAGES.progress, enqueue);

  const systemPrompt = `You are a search intent analyst specializing in digital advertising. Respond with valid JSON only — no markdown fences, no explanation.`;

  const userPrompt = `Analyze customer search intent for this brand and landing page.

Brand: ${brandOutput.brandName}
Industry: ${brandOutput.industry}
Value Propositions: ${brandOutput.valuePropositions.join(', ')}
Target Audience: ${brandOutput.targetAudience}
Page Type: ${lpuOutput.pageType}
Products/Services: ${lpuOutput.products.join(', ')}
Conversion Goal: ${lpuOutput.conversionGoal}
Existing Keywords: ${lpuOutput.keywords.join(', ')}
URL: ${url}

Return a JSON object with these exact fields:
{
  "primaryIntent": "string (commercial, informational, navigational, transactional)",
  "keywords": ["string (20 high-intent keywords for paid search)"],
  "funnelStage": "string (awareness, consideration, decision)",
  "audienceSignals": ["string (behavioral and interest signals for targeting)"]
}`;

  const [rawOutput] = await Promise.all([callClaude(systemPrompt, userPrompt), progressPromise]);

  const output = parseJsonFromLlm<IntentOutput>(rawOutput, {
    primaryIntent: 'commercial',
    keywords: lpuOutput.keywords.slice(0, 10),
    funnelStage: 'consideration',
    audienceSignals: []
  });

  const timeTaken = Date.now() - start;
  enqueue({
    type: 'agent_complete',
    agent: 'intent',
    message: INTENT_MESSAGES.complete,
    output,
    timeTaken,
    confidence: 'High'
  });

  return output;
}

// ---------------------------------------------------------------------------
// Agent: Trend
// ---------------------------------------------------------------------------

const TREND_MESSAGES = {
  start: 'Analyzing market trends...',
  progress: [
    'Reviewing industry and category trends',
    'Analyzing seasonal demand patterns',
    'Identifying emerging opportunities',
    'Compiling trend signals'
  ],
  complete: 'Market trend insights ready'
};

async function runTrendAgent(params: {
  brandOutput: BrandOutput;
  enqueue: (event: AgentEvent) => void;
}): Promise<TrendOutput> {
  const { brandOutput, enqueue } = params;
  const start = Date.now();

  enqueue({ type: 'agent_start', agent: 'trend', message: TREND_MESSAGES.start });

  const progressPromise = streamProgress('trend', TREND_MESSAGES.progress, enqueue);

  const systemPrompt = `You are a market trends analyst specializing in digital advertising. Respond with valid JSON only — no markdown fences, no explanation.`;

  const currentMonth = new Date().toLocaleString('default', { month: 'long' });
  const currentYear = new Date().getFullYear();

  const userPrompt = `Analyze market trends for this brand's industry.

Brand: ${brandOutput.brandName}
Industry: ${brandOutput.industry}
Target Audience: ${brandOutput.targetAudience}
Current Period: ${currentMonth} ${currentYear}

Based on your knowledge of the ${brandOutput.industry} industry, provide trend analysis. Return a JSON object with these exact fields:
{
  "trends": ["string (5-7 current market trends relevant to this industry)"],
  "seasonalFactors": ["string (seasonal demand patterns for ${currentMonth})"],
  "opportunities": ["string (3-5 advertising opportunities based on trends)"]
}`;

  const [rawOutput] = await Promise.all([callClaude(systemPrompt, userPrompt), progressPromise]);

  const output = parseJsonFromLlm<TrendOutput>(rawOutput, {
    trends: [`Growing demand in ${brandOutput.industry}`, 'Digital-first consumer behavior'],
    seasonalFactors: ['Standard seasonal patterns'],
    opportunities: ['Search advertising', 'Social media advertising']
  });

  const timeTaken = Date.now() - start;
  enqueue({
    type: 'agent_complete',
    agent: 'trend',
    message: TREND_MESSAGES.complete,
    output,
    timeTaken,
    confidence: 'Medium'
  });

  return output;
}

// ---------------------------------------------------------------------------
// Agent: Competitor
// ---------------------------------------------------------------------------

const COMPETITOR_MESSAGES = {
  start: 'Analyzing competitor activity...',
  progress: [
    'Identifying key competitors',
    'Reviewing competitor positioning',
    'Analyzing competitor ad presence',
    'Identifying gaps and opportunities'
  ],
  complete: 'Competitor insights ready'
};

async function runCompetitorAgent(params: {
  url: string;
  brandOutput: BrandOutput;
  enqueue: (event: AgentEvent) => void;
}): Promise<CompetitorOutput> {
  const { url, brandOutput, enqueue } = params;
  const start = Date.now();

  enqueue({ type: 'agent_start', agent: 'competitor', message: COMPETITOR_MESSAGES.start });

  const progressPromise = streamProgress('competitor', COMPETITOR_MESSAGES.progress, enqueue);

  const systemPrompt = `You are a competitive intelligence analyst for digital advertising. Respond with valid JSON only — no markdown fences, no explanation.`;

  const userPrompt = `Analyze the competitive landscape for this brand.

Brand: ${brandOutput.brandName}
Industry: ${brandOutput.industry}
Value Propositions: ${brandOutput.valuePropositions.join(', ')}
Target Audience: ${brandOutput.targetAudience}
Website: ${url}

Based on your knowledge of the ${brandOutput.industry} industry, identify competitors and competitive insights. Return a JSON object with these exact fields:
{
  "competitors": ["string (5-8 likely competitors by name)"],
  "competitorStrategies": ["string (common advertising strategies used by competitors)"],
  "gaps": ["string (market gaps or underserved segments)"],
  "differentiators": ["string (potential differentiators for ${brandOutput.brandName} based on their value propositions)"]
}`;

  const [rawOutput] = await Promise.all([callClaude(systemPrompt, userPrompt), progressPromise]);

  const output = parseJsonFromLlm<CompetitorOutput>(rawOutput, {
    competitors: [],
    competitorStrategies: ['Search advertising', 'Social media presence'],
    gaps: [],
    differentiators: brandOutput.valuePropositions
  });

  const timeTaken = Date.now() - start;
  enqueue({
    type: 'agent_complete',
    agent: 'competitor',
    message: COMPETITOR_MESSAGES.complete,
    output,
    timeTaken,
    confidence: 'Medium'
  });

  return output;
}

// ---------------------------------------------------------------------------
// Agent: Creative
// ---------------------------------------------------------------------------

const CREATIVE_MESSAGES = {
  start: 'Preparing ad creative concepts...',
  progress: [
    'Loading brand and product context',
    'Drafting headline variations',
    'Writing description copy',
    'Structuring ad variations',
    'Preparing image and video prompts'
  ],
  complete: 'Creative concepts ready'
};

async function runCreativeAgent(params: {
  url: string;
  brandOutput: BrandOutput;
  lpuOutput: LpuOutput;
  enqueue: (event: AgentEvent) => void;
}): Promise<CreativeOutput> {
  const { url, brandOutput, lpuOutput, enqueue } = params;
  const start = Date.now();

  enqueue({ type: 'agent_start', agent: 'creative', message: CREATIVE_MESSAGES.start });

  const progressPromise = streamProgress('creative', CREATIVE_MESSAGES.progress, enqueue);

  // Generate ad copy with Claude
  const systemPrompt = `You are a world-class advertising copywriter specializing in high-converting digital ads. Respond with valid JSON only — no markdown fences, no explanation.`;

  const userPrompt = `Create compelling ad copy for this brand.

Brand: ${brandOutput.brandName}
Industry: ${brandOutput.industry}
Tone: ${brandOutput.tone}
Value Propositions: ${brandOutput.valuePropositions.join(' | ')}
Target Audience: ${brandOutput.targetAudience}
Products/Services: ${lpuOutput.products.join(', ')}
Offers: ${lpuOutput.offers.join(', ')}
Primary CTA: ${lpuOutput.callToAction}
Conversion Goal: ${lpuOutput.conversionGoal}
Landing Page: ${url}

Create ad copy for Google Search Ads and Meta Feed Ads. Return a JSON object with these exact fields:
{
  "headlines": ["string (15 headlines, max 30 chars each, compelling and varied)"],
  "descriptions": ["string (4 descriptions, max 90 chars each)"],
  "imagePrompts": ["string (5 detailed Stable Diffusion / image generation prompts for ad visuals)"],
  "adVariations": [
    {
      "headline": "string",
      "description": "string",
      "cta": "string"
    }
  ]
}
Provide 5 adVariations.`;

  const [rawOutput] = await Promise.all([callClaude(systemPrompt, userPrompt), progressPromise]);

  const output = parseJsonFromLlm<CreativeOutput>(rawOutput, {
    headlines: [
      `${brandOutput.brandName} — Official Site`,
      `Shop ${brandOutput.brandName} Today`,
      'Trusted by Thousands'
    ],
    descriptions: [
      `Discover ${brandOutput.brandName}. ${brandOutput.valuePropositions[0] ?? 'Quality products and great service.'}`,
      `Shop now and explore our latest offers. ${lpuOutput.callToAction}.`
    ],
    imagePrompts: [
      `Professional product photography for ${brandOutput.industry} brand, clean white background, high quality`
    ],
    adVariations: [
      {
        headline: `${brandOutput.brandName} — Shop Now`,
        description: `${brandOutput.valuePropositions[0] ?? 'Quality guaranteed.'}`,
        cta: lpuOutput.callToAction || 'Shop Now'
      }
    ]
  });

  // Try to generate actual images with Gemini (optional, graceful fallback)
  try {
    const genAI = getGeminiClient();
    // imagen-3.0-generate-002 for image generation
    // If not accessible, we keep imagePrompts as strings
    const imageModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    // We use Gemini Flash to refine image prompts rather than generate actual images
    // (imagen model access may be restricted in many environments)
    if (output.imagePrompts.length > 0) {
      const refinedResult = await imageModel.generateContent(
        `Refine these image generation prompts to be more specific and visually compelling for digital ads:
${output.imagePrompts.slice(0, 3).join('\n')}

Return exactly the same number of improved prompts, one per line, no numbering.`
      );
      const refinedText = refinedResult.response.text();
      const refinedPrompts = refinedText
        .split('\n')
        .map((l: string) => l.trim())
        .filter(Boolean);
      if (refinedPrompts.length > 0) {
        output.imagePrompts = refinedPrompts;
      }
    }
  } catch {
    // Gracefully fall back to Claude-generated prompts
  }

  const timeTaken = Date.now() - start;
  enqueue({
    type: 'agent_complete',
    agent: 'creative',
    message: CREATIVE_MESSAGES.complete,
    output,
    timeTaken,
    confidence: 'High'
  });

  return output;
}

// ---------------------------------------------------------------------------
// Agent: Budget
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
  brandOutput: BrandOutput;
  connectedAccounts: ConnectedAccountInfo[];
  userPreferences?: UserPreferences;
  enqueue: (event: AgentEvent) => void;
}): Promise<BudgetOutput> {
  const { brandOutput, connectedAccounts, userPreferences, enqueue } = params;
  const start = Date.now();

  enqueue({ type: 'agent_start', agent: 'budget', message: BUDGET_MESSAGES.start });

  const progressPromise = streamProgress('budget', BUDGET_MESSAGES.progress, enqueue);

  const connectedPlatforms = [...new Set(connectedAccounts.map((a) => a.platform))];
  const monthlyBudgetHint = userPreferences?.monthlyBudget;
  const currency =
    userPreferences?.currency ??
    connectedAccounts.find((a) => a.currency)?.currency ??
    'USD';

  const systemPrompt = `You are a digital advertising budget strategist. Respond with valid JSON only — no markdown fences, no explanation.`;

  const userPrompt = `Recommend a campaign budget allocation for this brand.

Brand: ${brandOutput.brandName}
Industry: ${brandOutput.industry}
Target Audience: ${brandOutput.targetAudience}
Connected Ad Platforms: ${connectedPlatforms.join(', ') || 'google, meta'}
${monthlyBudgetHint ? `Monthly Budget Hint: ${currency} ${monthlyBudgetHint}` : ''}
Currency: ${currency}

Provide budget recommendations. Return a JSON object with these exact fields:
{
  "recommendedTotal": number (total campaign budget in ${currency}),
  "platformAllocation": {
    "google": number (percentage 0-100),
    "meta": number (percentage 0-100),
    "bing": number (percentage 0-100)
  },
  "dailyBudget": number (recommended daily budget),
  "duration": number (recommended campaign duration in days)
}
Platform percentages must sum to 100. Only include platforms that are in the connected platforms list or all if none specified.`;

  const [rawOutput] = await Promise.all([callClaude(systemPrompt, userPrompt), progressPromise]);

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
    output,
    timeTaken,
    confidence: monthlyBudgetHint ? 'High' : 'Medium'
  });

  return output;
}

// ---------------------------------------------------------------------------
// Agent: Strategy (runs after all others)
// ---------------------------------------------------------------------------

const STRATEGY_MESSAGES = {
  start: 'Building your campaign strategy...',
  progress: [
    'Combining insights from all analyses',
    'Structuring platform-level strategy',
    'Defining campaign setup and priorities',
    'Finalizing recommendations'
  ],
  complete: 'Campaign strategy ready'
};

async function runStrategyAgent(params: {
  url: string;
  organizationId: string;
  connectedAccounts: ConnectedAccountInfo[];
  userPreferences?: UserPreferences;
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

  const connectedPlatforms = [...new Set(connectedAccounts.map((a) => a.platform))];
  const currency =
    userPreferences?.currency ??
    connectedAccounts.find((a) => a.currency)?.currency ??
    'USD';

  const systemPrompt = `You are a senior digital advertising strategist at InMobi Accelerate. Your job is to synthesize insights from multiple AI agents into a comprehensive, actionable media plan. Respond with valid JSON only — no markdown fences, no explanation.`;

  const userPrompt = `Create a comprehensive media plan for this campaign.

=== BRAND INSIGHTS ===
${JSON.stringify(brandOut, null, 2)}

=== LANDING PAGE INSIGHTS ===
${JSON.stringify(lpuOut, null, 2)}

=== INTENT ANALYSIS ===
${JSON.stringify(intentOut, null, 2)}

=== MARKET TRENDS ===
${JSON.stringify(trendOut, null, 2)}

=== COMPETITOR INSIGHTS ===
${JSON.stringify(competitorOut, null, 2)}

=== CREATIVE ASSETS ===
Headlines: ${creativeOut.headlines.slice(0, 10).join(' | ')}
Descriptions: ${creativeOut.descriptions.join(' | ')}

=== BUDGET RECOMMENDATION ===
${JSON.stringify(budgetOut, null, 2)}

=== CONSTRAINTS ===
Connected Ad Platforms: ${connectedPlatforms.join(', ') || 'google, meta'}
Currency: ${currency}
Landing Page: ${url}
${userPreferences?.campaignObjective ? `User Objective: ${userPreferences.campaignObjective}` : ''}
${userPreferences?.targetCountries ? `Target Countries: ${userPreferences.targetCountries.join(', ')}` : ''}

Generate a complete media plan. Return a JSON object matching this exact structure:
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
      "adTypes": [
        {
          "adType": "string",
          "adCount": number,
          "targeting": {
            "locations": ["string"],
            "ageRange": "string",
            "gender": "string",
            "languages": ["string"],
            "interests": ["string"],
            "keywords": ["string"]
          },
          "bidStrategy": "string",
          "ads": [
            {
              "headlines": ["string"],
              "descriptions": ["string"],
              "imageUrls": [],
              "ctaText": "string",
              "destinationUrl": "${url}"
            }
          ]
        }
      ]
    }
  ],
  "summary": {
    "brandName": "${brandOut.brandName}",
    "tagline": "string",
    "primaryObjective": "string"
  }
}

Only include platforms from the connected platforms list. Use the creative assets and insights above to populate headlines, descriptions, targeting, and ad variations.`;

  const [rawOutput] = await Promise.all([callClaude(systemPrompt, userPrompt), progressPromise]);

  const rawMediaPlan = parseJsonFromLlm<unknown>(rawOutput, null);

  // Transform and validate
  const mediaPlan = transformMediaPlan(
    rawMediaPlan ?? {
      campaignName: `${brandOut.brandName} Campaign`,
      objective: 'SALES',
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
        locations: userPreferences?.targetCountries ?? ['United States'],
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
              locations: userPreferences?.targetCountries ?? ['United States'],
              ageRange: '25-44',
              gender: 'All',
              languages: ['English'],
              interests: intentOut.audienceSignals.slice(0, 3),
              keywords: intentOut.keywords.slice(0, 10)
            },
            bidStrategy: 'maximize conversions',
            ads: creativeOut.adVariations.slice(0, 3).map((v) => ({
              headlines: [v.headline, ...creativeOut.headlines.slice(0, 4)],
              descriptions: [v.description, ...creativeOut.descriptions.slice(0, 2)],
              imageUrls: [],
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
      }
    },
    connectedAccounts
  );

  const timeTaken = Date.now() - start;
  enqueue({
    type: 'agent_complete',
    agent: 'strategy',
    message: STRATEGY_MESSAGES.complete,
    output: mediaPlan,
    timeTaken,
    confidence: rawMediaPlan ? 'High' : 'Medium'
  });

  enqueue({ type: 'media_plan', plan: mediaPlan });

  return mediaPlan;
}

// ---------------------------------------------------------------------------
// Main runner: orchestrates all agents
// ---------------------------------------------------------------------------

export async function runCampaignAgents(params: {
  url: string;
  organizationId: string;
  connectedAccounts: ConnectedAccountInfo[];
  userPreferences?: UserPreferences;
  enqueue: (event: AgentEvent) => void;
}): Promise<MediaPlan> {
  const { url, organizationId, connectedAccounts, userPreferences, enqueue } = params;

  // Phase 1: Run brand and LPU agents first (others depend on them)
  const [brandOut, lpuOut] = await Promise.all([
    runBrandAgent({ url, enqueue }),
    runLpuAgent({ url, enqueue })
  ]);

  // Phase 2: Run remaining 5 agents in parallel (they use brand/lpu outputs)
  const [intentOut, trendOut, competitorOut, creativeOut, budgetOut] = await Promise.all([
    runIntentAgent({ url, lpuOutput: lpuOut, brandOutput: brandOut, enqueue }),
    runTrendAgent({ brandOutput: brandOut, enqueue }),
    runCompetitorAgent({ url, brandOutput: brandOut, enqueue }),
    runCreativeAgent({ url, brandOutput: brandOut, lpuOutput: lpuOut, enqueue }),
    runBudgetAgent({ brandOutput: brandOut, connectedAccounts, userPreferences, enqueue })
  ]);

  // Phase 3: Strategy agent synthesizes all outputs
  const mediaPlan = await runStrategyAgent({
    url,
    organizationId,
    connectedAccounts,
    userPreferences,
    brandOut,
    lpuOut,
    intentOut,
    trendOut,
    competitorOut,
    creativeOut,
    budgetOut,
    enqueue
  });

  return mediaPlan;
}
