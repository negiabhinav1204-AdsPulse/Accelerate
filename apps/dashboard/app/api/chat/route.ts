import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';

import { auth } from '@workspace/auth';
import { prisma } from '@workspace/database/client';
import { searchMemory, upsertMemoryNode } from '~/lib/memory/memory-service';
import { SERVICES } from '~/lib/service-router';
import {
  ECOMMERCE_TOOL_NAMES,
  ECOMMERCE_TOOL_SCHEMAS,
  executeEcommerceTool,
  type ToolContext,
} from './tools/ecommerce';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

function buildSystemPrompt(ctx: {
  userName: string;
  orgName: string;
  connectedPlatforms: string[];
  memories?: string;
  performanceData?: string;
}): string {
  const platformList =
    ctx.connectedPlatforms.length > 0
      ? ctx.connectedPlatforms.join(', ')
      : 'none connected yet';

  return `You are Accelera AI, the intelligent assistant inside InMobi Accelerate — an AI-powered digital advertising platform for small and medium businesses.

## User Context
- User: ${ctx.userName}
- Organisation: ${ctx.orgName}
- Connected ad platforms: ${platformList}
${ctx.memories ? `\n## What you already know about this organisation\n${ctx.memories}\n(Use this to personalise responses — do not repeat it back verbatim.)` : ''}
${ctx.performanceData ? `\n## Live Campaign Performance Data (last 30 days from synced ad accounts)\nUse this real data when answering questions about performance, spend, campaigns, or results. Do NOT invent numbers — only use what is provided here.\n${ctx.performanceData}` : ''}

## Your Role
Help users with:
- Planning and creating advertising campaigns across Google, Meta, Microsoft Advertising, and other platforms
- Analysing ad account performance and metrics
- Optimising budgets, bids, and targeting
- Understanding campaign reports and insights
- Navigating the Accelerate platform

You have deep knowledge of digital advertising — Google Ads, Meta Ads (Facebook/Instagram), Microsoft Advertising, campaign structures, targeting options, bidding strategies, creatives, conversion tracking, and performance metrics.

## Data Tools (execute server-side — results returned to you)
You have access to real ecommerce data tools. Call these to get LIVE data before answering:
- \`get_products\` — list the product catalog with prices, inventory, and 30-day velocity
- \`get_sales\` — revenue, orders, AOV for any time period with period-over-period comparison
- \`get_ecommerce_overview\` — full KPI dashboard: revenue, orders, AOV, repeat rate, trends
- \`get_inventory_health\` — flag low-stock and out-of-stock products with days-until-stockout
- \`get_product_insights\` — deep analysis of a specific product
- \`get_product_suggestions\` — top products to advertise ranked by velocity and revenue

## Generative UI Tools (rendered in chat — use AFTER data tools)
You have access to special UI rendering tools. Use them to show rich data visually:
- Use \`show_metrics\` to display KPI cards when discussing performance numbers
- Use \`show_campaigns\` to display a campaign table when listing campaigns
- Use \`show_chart\` to display a performance chart when showing trends over time
- Use \`show_products\` to display a product leaderboard when showing product lists or suggestions
- Use \`show_inventory\` to display an inventory health card when showing stock status
- Use \`navigate_to\` to suggest a platform navigation link when the user should go somewhere in the app (except campaign creation — see below)
- Use \`connect_accounts_prompt\` when the user asks to analyse/optimise/create campaigns but no ad accounts are connected

## Campaign Creation
When the user wants to create a new campaign, DO NOT use navigate_to. Instead, tell them to paste their landing page or product URL directly into this chat. The campaign pipeline will start automatically when a URL is detected — it runs inline here without navigating away.

## Rules
- Always be helpful, concise, and actionable. Use simple language suitable for SMB marketers.
- When using tools, also include a brief text explanation alongside the tool call.
- If asked about topics unrelated to advertising, marketing, or the Accelerate platform, politely redirect.
- Format text responses in markdown when it helps readability.
- Never use emoji in any response. Plain text only.
- IMPORTANT: If the user has at least one connected ad platform, NEVER suggest or recommend connecting more accounts unless they specifically ask about it. Many advertisers only run campaigns on a single platform — that is completely normal. Work with the platforms they have connected.
- Only use \`connect_accounts_prompt\` (and only in that case suggest connecting accounts at all) when connectedPlatforms is empty AND the user is asking for something that requires account data.`;
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'show_metrics',
    description:
      'Display KPI metric cards in the chat. Use when presenting performance numbers like impressions, clicks, spend, ROAS, CTR, conversions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Section title, e.g. "Campaign Performance"' },
        metrics: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string' },
              value: { type: 'string' },
              change: { type: 'string', description: 'e.g. "+12%" or "-5%"' },
              trend: { type: 'string', enum: ['up', 'down', 'neutral'] }
            },
            required: ['label', 'value']
          }
        }
      },
      required: ['title', 'metrics']
    }
  },
  {
    name: 'show_campaigns',
    description:
      'Display a campaign data table. Use when listing campaigns with their stats.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string' },
        campaigns: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              status: { type: 'string', enum: ['active', 'paused', 'ended'] },
              budget: { type: 'string' },
              spend: { type: 'string' },
              impressions: { type: 'string' },
              clicks: { type: 'string' },
              ctr: { type: 'string' },
              conversions: { type: 'string' }
            },
            required: ['name', 'status']
          }
        }
      },
      required: ['title', 'campaigns']
    }
  },
  {
    name: 'show_chart',
    description:
      'Display a performance trend chart. Use when showing data over time.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string' },
        metric: { type: 'string', description: 'The metric being charted, e.g. "Spend", "Impressions"' },
        data: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              date: { type: 'string' },
              value: { type: 'number' }
            },
            required: ['date', 'value']
          }
        }
      },
      required: ['title', 'metric', 'data']
    }
  },
  {
    name: 'navigate_to',
    description:
      'Suggest a navigation action — show a clickable card directing the user to a specific section of Accelerate.',
    input_schema: {
      type: 'object' as const,
      properties: {
        label: { type: 'string', description: 'Button label, e.g. "Go to Campaign Manager"' },
        description: { type: 'string', description: 'Short description of what they will find there' },
        path: {
          type: 'string',
          enum: [
            'create-campaign',
            'campaigns',
            'reporting',
            'connectors',
            'settings',
            'accelera-ai'
          ]
        }
      },
      required: ['label', 'description', 'path']
    }
  },
  {
    name: 'connect_accounts_prompt',
    description:
      'Show a prompt asking the user to connect their ad accounts. ONLY use this when connectedPlatforms is empty AND the user is asking for something that requires account data (e.g. analyse, optimise, view campaigns). Never use this if even one platform is connected.',
    input_schema: {
      type: 'object' as const,
      properties: {
        message: {
          type: 'string',
          description: 'Explanation of why they need to connect accounts'
        }
      },
      required: ['message']
    }
  },
  {
    name: 'show_products',
    description:
      'Display a product leaderboard table with velocity badges. Use AFTER calling get_products or get_product_suggestions to show the results visually.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Card title, e.g. "Top Products by Velocity"' },
        products: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              price: { type: 'string', description: 'Formatted price, e.g. "$49.99"' },
              sold_30d: { type: 'number', description: '30-day units sold' },
              revenue_30d: { type: 'string', description: 'Formatted revenue, e.g. "$1,200"' },
              inventory: { type: 'number', description: 'Current inventory quantity' },
              badge: { type: 'string', enum: ['best_seller', 'trending', 'high_value', 'low_stock', 'new', ''] },
              insight: { type: 'string', description: 'One-line AI insight about this product' }
            },
            required: ['title']
          }
        }
      },
      required: ['title', 'products']
    }
  },
  {
    name: 'show_inventory',
    description:
      'Display an inventory health card with alerts. Use AFTER calling get_inventory_health to show the results visually.',
    input_schema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string' },
        summary: {
          type: 'object',
          properties: {
            total_products: { type: 'number' },
            out_of_stock: { type: 'number' },
            low_stock: { type: 'number' },
            at_risk_revenue: { type: 'string', description: 'Weekly revenue at risk, e.g. "$450"' }
          },
          required: ['total_products', 'out_of_stock', 'low_stock']
        },
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              inventory: { type: 'number' },
              days_until_stockout: { type: 'number' },
              weekly_velocity: { type: 'number' },
              status: { type: 'string', enum: ['out_of_stock', 'critical', 'low', 'ok'] }
            },
            required: ['title', 'inventory', 'status']
          }
        }
      },
      required: ['title', 'summary', 'items']
    }
  },
  // ── Ecommerce data tools (server-side execution) ──────────────────────────
  ...ECOMMERCE_TOOL_SCHEMAS,
];

// ---------------------------------------------------------------------------
// Memory extraction — saves learnt facts from each conversation turn
// ---------------------------------------------------------------------------

async function extractAndSaveMemory(params: {
  orgId: string;
  userId: string;
  userMessage: string;
  assistantMessage: string;
}): Promise<void> {
  const { orgId, userId, userMessage, assistantMessage } = params;
  const combined = `User: ${userMessage}\nAssistant: ${assistantMessage}`;

  // Campaign preference signals
  const budgetMatch = userMessage.match(/(?:budget|spend)[^\d]*(\d[\d,]*)\s*(INR|USD|GBP|AED|₹|\$)?/i);
  if (budgetMatch) {
    await upsertMemoryNode({
      orgId, userId, type: 'campaign_preference',
      key: 'budget_preference',
      summary: `Preferred budget: ${budgetMatch[0]}`,
      content: { raw: budgetMatch[0], message: userMessage.slice(0, 200) },
      confidenceDelta: 0.1
    });
  }

  // Platform preferences
  const platformSignals: string[] = [];
  if (/\bmeta\b|facebook|instagram/i.test(combined)) platformSignals.push('meta');
  if (/\bgoogle\b/i.test(combined)) platformSignals.push('google');
  if (/\bbing\b|microsoft ads/i.test(combined)) platformSignals.push('bing');
  if (platformSignals.length > 0) {
    await upsertMemoryNode({
      orgId, userId, type: 'campaign_preference',
      key: 'platform_preference',
      summary: `Mentioned platforms: ${platformSignals.join(', ')}`,
      content: { platforms: platformSignals },
      confidenceDelta: 0.05
    });
  }

  // Brand / URL context
  const urlMatch = userMessage.match(/https?:\/\/([^\s/]+)/);
  if (urlMatch) {
    await upsertMemoryNode({
      orgId, userId: undefined, type: 'brand_profile',
      key: urlMatch[1]!,
      summary: `Brand URL used: ${urlMatch[0]}`,
      content: { url: urlMatch[0], domain: urlMatch[1] },
      sourceUrl: urlMatch[0],
      confidenceDelta: 0.1
    });
  }

  // Objective / campaign theme
  const objectiveMatch = userMessage.match(/\b(awareness|leads?|sales|traffic|conversions?|installs?|diwali|holi|christmas|launch|sale)\b/i);
  if (objectiveMatch) {
    await upsertMemoryNode({
      orgId, userId, type: 'campaign_preference',
      key: 'objective_preference',
      summary: `Campaign objective mentioned: ${objectiveMatch[1]}`,
      content: { objective: objectiveMatch[1]!.toLowerCase() },
      confidenceDelta: 0.05
    });
  }
}

// ---------------------------------------------------------------------------
// Fetch real campaign performance data from DB to ground the AI
// ---------------------------------------------------------------------------

type InsightRow = {
  date_start: string;
  campaign_id: string;
  campaign_name: string;
  impressions: string;
  spend: string;
  clicks: string;
  actions?: { action_type: string; value: string }[];
  purchase_roas?: { action_type: string; value: string }[];
};

type AgeGenderRow = { age: string; gender: string; impressions: string; spend: string; clicks: string; date_start: string; actions?: { action_type: string; value: string }[] };
type PlacementRow = { publisher_platform: string; platform_position: string; impressions: string; spend: string; clicks: string; date_start: string };
type CountryRow = { country: string; impressions: string; spend: string; clicks: string; date_start: string; actions?: { action_type: string; value: string }[] };
type AdInsightRow = { ad_id: string; ad_name: string; impressions: string; spend: string; clicks: string; date_start: string; quality_ranking?: string; engagement_rate_ranking?: string; actions?: { action_type: string; value: string }[] };

function sumConversions(actions?: { action_type: string; value: string }[]): number {
  return (actions ?? [])
    .filter((a) => a.action_type === 'purchase' || a.action_type === 'offsite_conversion.fb_pixel_purchase')
    .reduce((s, a) => s + parseFloat(a.value || '0'), 0);
}

async function fetchPerformanceContext(orgId: string): Promise<string> {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceStr = since.toISOString().split('T')[0]!;

    const [allReports, lastSync] = await Promise.all([
      prisma.adPlatformReport.findMany({
        where: {
          organizationId: orgId,
          reportType: { in: ['campaign_insights_daily', 'ad_insights_daily', 'insights_by_age_gender', 'insights_by_platform_placement', 'insights_by_country'] }
        }
      }),
      prisma.connectedAdAccount.findFirst({
        where: { organizationId: orgId, archivedAt: null },
        orderBy: { lastSyncAt: 'desc' },
        select: { lastSyncAt: true, platform: true, accountName: true }
      })
    ]);

    const byType = (type: string) => allReports.filter((r) => r.reportType === type);

    // ── Campaign totals ───────────────────────────────────────────────────────
    const campaignRows: InsightRow[] = [];
    for (const r of byType('campaign_insights_daily')) {
      for (const row of (r.data as InsightRow[]) ?? []) {
        if (row.date_start >= sinceStr) campaignRows.push(row);
      }
    }

    if (campaignRows.length === 0) {
      return lastSync
        ? `No campaign data for the last 30 days. Last sync: ${lastSync.lastSyncAt?.toISOString() ?? 'unknown'}. Tell the user to run a sync from the Connectors page.`
        : 'No ad accounts synced yet. Tell the user to connect and sync their ad account from the Connectors page.';
    }

    let totalSpend = 0, totalImpressions = 0, totalClicks = 0, totalConversions = 0;
    const campaignMap = new Map<string, { name: string; spend: number; impressions: number; clicks: number; conversions: number }>();
    for (const row of campaignRows) {
      const spend = parseFloat(row.spend || '0');
      const impressions = parseInt(row.impressions || '0', 10);
      const clicks = parseInt(row.clicks || '0', 10);
      const conversions = sumConversions(row.actions);
      totalSpend += spend; totalImpressions += impressions; totalClicks += clicks; totalConversions += conversions;
      const ex = campaignMap.get(row.campaign_id) ?? { name: row.campaign_name, spend: 0, impressions: 0, clicks: 0, conversions: 0 };
      campaignMap.set(row.campaign_id, { name: ex.name, spend: ex.spend + spend, impressions: ex.impressions + impressions, clicks: ex.clicks + clicks, conversions: ex.conversions + conversions });
    }
    const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : '0';
    const cpc = totalClicks > 0 ? (totalSpend / totalClicks).toFixed(2) : '0';
    const topCampaigns = [...campaignMap.values()].sort((a, b) => b.spend - a.spend).slice(0, 10);
    const campaignLines = topCampaigns.map((c) => {
      const cCtr = c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(2) : '0';
      return `  - "${c.name}": spend=$${c.spend.toFixed(2)}, impressions=${c.impressions.toLocaleString()}, clicks=${c.clicks.toLocaleString()}, CTR=${cCtr}%, conversions=${c.conversions.toFixed(0)}`;
    }).join('\n');

    // ── Ad/asset performance ──────────────────────────────────────────────────
    const adMap = new Map<string, { name: string; spend: number; impressions: number; clicks: number; conversions: number; quality?: string; engagement?: string }>();
    for (const r of byType('ad_insights_daily')) {
      for (const row of (r.data as AdInsightRow[]) ?? []) {
        if (row.date_start < sinceStr) continue;
        const ex = adMap.get(row.ad_id) ?? { name: row.ad_name, spend: 0, impressions: 0, clicks: 0, conversions: 0, quality: row.quality_ranking, engagement: row.engagement_rate_ranking };
        adMap.set(row.ad_id, { ...ex, spend: ex.spend + parseFloat(row.spend || '0'), impressions: ex.impressions + parseInt(row.impressions || '0', 10), clicks: ex.clicks + parseInt(row.clicks || '0', 10), conversions: ex.conversions + sumConversions(row.actions) });
      }
    }
    const topAds = [...adMap.values()].sort((a, b) => b.spend - a.spend).slice(0, 10);
    const adLines = topAds.length > 0
      ? topAds.map((a) => {
          const aCtr = a.impressions > 0 ? ((a.clicks / a.impressions) * 100).toFixed(2) : '0';
          const q = a.quality ? `, quality=${a.quality}` : '';
          return `  - "${a.name}": spend=$${a.spend.toFixed(2)}, CTR=${aCtr}%${q}, conversions=${a.conversions.toFixed(0)}`;
        }).join('\n')
      : '  (not synced yet — run a sync to get asset data)';

    // ── Age/gender breakdown ──────────────────────────────────────────────────
    const ageGenderMap = new Map<string, { female: number; male: number; unknown: number; fSpend: number; mSpend: number }>();
    for (const r of byType('insights_by_age_gender')) {
      for (const row of (r.data as AgeGenderRow[]) ?? []) {
        if (row.date_start < sinceStr) continue;
        const ex = ageGenderMap.get(row.age) ?? { female: 0, male: 0, unknown: 0, fSpend: 0, mSpend: 0 };
        const clicks = parseInt(row.clicks || '0', 10);
        const spend = parseFloat(row.spend || '0');
        if (row.gender === 'female') { ex.female += clicks; ex.fSpend += spend; }
        else if (row.gender === 'male') { ex.male += clicks; ex.mSpend += spend; }
        else ex.unknown += clicks;
        ageGenderMap.set(row.age, ex);
      }
    }
    const ageLines = ageGenderMap.size > 0
      ? [...ageGenderMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([age, d]) => {
          const total = d.female + d.male + d.unknown || 1;
          return `  - Age ${age}: female=${d.female.toLocaleString()} clicks (${((d.female/total)*100).toFixed(0)}%), male=${d.male.toLocaleString()} clicks (${((d.male/total)*100).toFixed(0)}%), female spend=$${d.fSpend.toFixed(2)}, male spend=$${d.mSpend.toFixed(2)}`;
        }).join('\n')
      : '  (not synced yet)';

    // ── Platform/placement breakdown ──────────────────────────────────────────
    const platformMap = new Map<string, { impressions: number; clicks: number; spend: number }>();
    for (const r of byType('insights_by_platform_placement')) {
      for (const row of (r.data as PlacementRow[]) ?? []) {
        if (row.date_start < sinceStr) continue;
        const key = `${row.publisher_platform} / ${row.platform_position}`.replace(/_/g, ' ');
        const ex = platformMap.get(key) ?? { impressions: 0, clicks: 0, spend: 0 };
        platformMap.set(key, { impressions: ex.impressions + parseInt(row.impressions || '0', 10), clicks: ex.clicks + parseInt(row.clicks || '0', 10), spend: ex.spend + parseFloat(row.spend || '0') });
      }
    }
    const platformLines = platformMap.size > 0
      ? [...platformMap.entries()].sort((a, b) => b[1].spend - a[1].spend).map(([plat, d]) => {
          const pCtr = d.impressions > 0 ? ((d.clicks / d.impressions) * 100).toFixed(2) : '0';
          return `  - ${plat}: spend=$${d.spend.toFixed(2)}, impressions=${d.impressions.toLocaleString()}, CTR=${pCtr}%`;
        }).join('\n')
      : '  (not synced yet)';

    // ── Country/location breakdown ────────────────────────────────────────────
    const countryMap = new Map<string, { impressions: number; clicks: number; spend: number; conversions: number }>();
    for (const r of byType('insights_by_country')) {
      for (const row of (r.data as CountryRow[]) ?? []) {
        if (row.date_start < sinceStr) continue;
        const ex = countryMap.get(row.country) ?? { impressions: 0, clicks: 0, spend: 0, conversions: 0 };
        countryMap.set(row.country, { impressions: ex.impressions + parseInt(row.impressions || '0', 10), clicks: ex.clicks + parseInt(row.clicks || '0', 10), spend: ex.spend + parseFloat(row.spend || '0'), conversions: ex.conversions + sumConversions(row.actions) });
      }
    }
    const countryLines = countryMap.size > 0
      ? [...countryMap.entries()].sort((a, b) => b[1].spend - a[1].spend).slice(0, 15).map(([country, d]) => {
          const cCtr = d.impressions > 0 ? ((d.clicks / d.impressions) * 100).toFixed(2) : '0';
          return `  - ${country}: spend=$${d.spend.toFixed(2)}, clicks=${d.clicks.toLocaleString()}, CTR=${cCtr}%, conversions=${d.conversions.toFixed(0)}`;
        }).join('\n')
      : '  (not synced yet — will appear after next sync)';

    return `Last sync: ${lastSync?.lastSyncAt?.toISOString() ?? 'unknown'} | Account: ${lastSync?.accountName ?? ''} (${lastSync?.platform ?? ''})
Date range: last 30 days

## Overall Totals
  - Total spend: $${totalSpend.toFixed(2)}
  - Impressions: ${totalImpressions.toLocaleString()}
  - Clicks: ${totalClicks.toLocaleString()}
  - CTR: ${ctr}%
  - CPC: $${cpc}
  - Conversions: ${totalConversions.toFixed(0)}
  - Active campaigns: ${campaignMap.size}

## Top Campaigns by Spend
${campaignLines}

## Top Ads/Assets by Spend
${adLines}

## Age & Gender Breakdown (clicks + spend)
${ageLines}

## Platform & Placement Breakdown
${platformLines}

## Country / Location Breakdown
${countryLines}`;
  } catch (e) {
    console.error('[chat] performance context fetch failed:', e);
    return '';
  }
}

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type RequestBody = {
  messages: ChatMessage[];
  sessionId?: string;
  organizationId?: string;
};

export async function POST(request: NextRequest): Promise<Response> {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
    if (!Array.isArray(body.messages) || body.messages.length === 0) {
      return new Response('Invalid request', { status: 400 });
    }
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  // Forward to chat microservice if enabled
  if (SERVICES.chat.enabled) {
    const internalKey = process.env.INTERNAL_API_KEY;
    if (!internalKey) return new Response('Server configuration error', { status: 500 });

    const res = await fetch(`${SERVICES.chat.url}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-internal-api-key': internalKey },
      body: JSON.stringify({ ...body, userId: session.user.id }),
    });

    return new Response(res.body, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-cache',
        ...(res.headers.get('X-Session-Id') ? { 'X-Session-Id': res.headers.get('X-Session-Id')! } : {})
      }
    });
  }

  // Build context: user + org + connected accounts
  let userName = session.user.name ?? 'there';
  let orgName = 'your organisation';
  let connectedPlatforms: string[] = [];
  let sessionId = body.sessionId ?? null;

  try {
    const userDetails = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { firstName: true, name: true }
    });
    userName = userDetails?.firstName || userDetails?.name?.split(' ')[0] || 'there';

    if (body.organizationId) {
      const org = await prisma.organization.findFirst({
        where: {
          id: body.organizationId,
          memberships: { some: { userId: session.user.id } }
        },
        select: { name: true }
      });
      if (org) orgName = org.name;

      const accounts = await prisma.connectedAdAccount.findMany({
        where: { organizationId: body.organizationId, status: 'connected' },
        select: { platform: true }
      });
      connectedPlatforms = [...new Set(accounts.map((a) => a.platform))];
    }
  } catch (e) {
    console.error('[chat] context fetch failed:', e);
  }

  // Fetch real performance data and memories in parallel
  const [performanceData, memories] = await Promise.all([
    body.organizationId ? fetchPerformanceContext(body.organizationId) : Promise.resolve(''),
    body.organizationId
      ? (async () => {
          try {
            const lastUserMsg = body.messages[body.messages.length - 1];
            const query = lastUserMsg?.content ?? orgName;
            const nodes = await searchMemory(body.organizationId!, session.user.id, query, 6);
            return nodes.length > 0 ? nodes.map((n) => `[${n.type}] ${n.summary}`).join('\n') : '';
          } catch { return ''; }
        })()
      : Promise.resolve('')
  ]);

  const systemPrompt = buildSystemPrompt({ userName, orgName, connectedPlatforms, memories, performanceData });

  // Streaming response — we use a custom JSON-lines format so the client can
  // distinguish text chunks from tool-call results
  const encoder = new TextEncoder();

  // Ensure session exists before streaming so we have an id to attach messages to
  let activeSessionId = sessionId;
  if (!activeSessionId && body.organizationId) {
    try {
      const firstUserMsg = body.messages[body.messages.length - 1];
      const newSession = await prisma.chatSession.create({
        data: {
          organizationId: body.organizationId,
          userId: session.user.id,
          title: firstUserMsg?.content.slice(0, 80) ?? 'New conversation'
        },
        select: { id: true }
      });
      activeSessionId = newSession.id;
    } catch {
      // non-fatal — chat still works without persistence
    }
  }

  // Save the user message immediately
  if (activeSessionId) {
    const lastUserMsg = body.messages[body.messages.length - 1];
    if (lastUserMsg?.role === 'user') {
      try {
        await prisma.chatMessage.create({
          data: { sessionId: activeSessionId, role: 'user', content: lastUserMsg.content }
        });
      } catch {
        // non-fatal
      }
    }
  }

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (obj: unknown) => {
        controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));
      };

      // Accumulate full assistant response for DB persistence
      let assistantText = '';
      const assistantTools: { name: string; input: unknown }[] = [];

      try {
        const toolCtx: ToolContext = {
          orgId: body.organizationId ?? '',
          currency: 'USD',
        };

        // Fetch org currency for tool context (best-effort)
        if (body.organizationId) {
          try {
            const org = await prisma.organization.findFirst({
              where: { id: body.organizationId },
              select: { currency: true },
            });
            if (org?.currency) toolCtx.currency = org.currency;
          } catch { /* non-fatal */ }
        }

        let messages: Anthropic.MessageParam[] = body.messages.map(
          (m) => ({ role: m.role, content: m.content })
        );

        // Agentic tool-use loop — handles data tool execution + streaming final response.
        // Loop exits when stop_reason is 'end_turn' or we exceed 4 turns (safety limit).
        let loopCount = 0;
        const MAX_LOOPS = 4;

        while (loopCount < MAX_LOOPS) {
          loopCount++;
          const isLastLoop = loopCount >= MAX_LOOPS;

          const anthropicStream = client.messages.stream({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 2048,
            system: systemPrompt,
            tools: TOOLS,
            messages,
          });

          const toolInputBuffers: Record<number, string> = {};
          const toolIdBuffers: Record<number, string> = {};
          const toolNames: Record<number, string> = {};
          // Data tool calls to execute after this streaming turn
          const pendingDataToolCalls: { id: string; name: string; input: Record<string, unknown> }[] = [];

          for await (const event of anthropicStream) {
            if (event.type === 'content_block_start') {
              if (event.content_block.type === 'tool_use') {
                toolInputBuffers[event.index] = '';
                toolNames[event.index] = event.content_block.name;
                toolIdBuffers[event.index] = event.content_block.id;
              }
            } else if (event.type === 'content_block_delta') {
              if (event.delta.type === 'text_delta') {
                assistantText += event.delta.text;
                enqueue({ type: 'text', text: event.delta.text });
              } else if (event.delta.type === 'input_json_delta') {
                toolInputBuffers[event.index] =
                  (toolInputBuffers[event.index] ?? '') + event.delta.partial_json;
              }
            } else if (event.type === 'content_block_stop') {
              const name = toolNames[event.index];
              const id = toolIdBuffers[event.index];
              const rawInput = toolInputBuffers[event.index];
              if (name && rawInput !== undefined) {
                let toolInput: Record<string, unknown> = {};
                try {
                  toolInput = JSON.parse(rawInput) as Record<string, unknown>;
                } catch { /* ignore malformed */ }

                if (ECOMMERCE_TOOL_NAMES.has(name)) {
                  // Data tool — queue for server-side execution, don't stream to client
                  pendingDataToolCalls.push({ id: id!, name, input: toolInput });
                  enqueue({ type: 'tool_thinking', name });
                } else {
                  // UI tool — stream to client for rendering
                  assistantTools.push({ name, input: toolInput });
                  enqueue({ type: 'tool', name, input: toolInput });
                }
              }
            }
          }

          // If no data tool calls, we're done
          if (pendingDataToolCalls.length === 0 || isLastLoop) {
            break;
          }

          // Get full assistant content blocks from the final message for the loop
          const finalMsg = await anthropicStream.finalMessage();

          // Execute data tools in parallel
          const toolResults = await Promise.all(
            pendingDataToolCalls.map(async ({ id, name, input }) => {
              try {
                const result = await executeEcommerceTool(name, input, toolCtx);
                return {
                  type: 'tool_result' as const,
                  tool_use_id: id,
                  content: JSON.stringify(result),
                };
              } catch (err) {
                const msg = err instanceof Error ? err.message : 'Tool execution failed';
                return {
                  type: 'tool_result' as const,
                  tool_use_id: id,
                  content: JSON.stringify({ error: msg }),
                };
              }
            })
          );

          // Append assistant turn (using SDK content blocks) + tool results, then loop
          messages = [
            ...messages,
            { role: 'assistant' as const, content: finalMsg.content },
            { role: 'user' as const, content: toolResults },
          ];
        }

        // Extract and save memory facts from the conversation (fire-and-forget)
        if (body.organizationId && assistantText && session.user?.id) {
          void extractAndSaveMemory({
            orgId: body.organizationId,
            userId: session.user.id as string,
            userMessage: body.messages[body.messages.length - 1]?.content ?? '',
            assistantMessage: assistantText
          });
        }

        // Persist assistant response
        if (activeSessionId && (assistantText || assistantTools.length > 0)) {
          try {
            await prisma.chatMessage.create({
              data: {
                sessionId: activeSessionId,
                role: 'assistant',
                content: assistantText,
                toolData: assistantTools.length > 0 ? (assistantTools as object[]) : undefined
              }
            });
            // Update session updatedAt
            await prisma.chatSession.update({
              where: { id: activeSessionId },
              data: { updatedAt: new Date() }
            });
          } catch {
            // non-fatal
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'An error occurred';
        enqueue({ type: 'error', message: msg });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'Cache-Control': 'no-cache',
      ...(activeSessionId ? { 'X-Session-Id': activeSessionId } : {})
    }
  });
}
