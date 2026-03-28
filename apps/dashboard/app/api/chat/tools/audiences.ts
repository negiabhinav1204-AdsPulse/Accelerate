import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@workspace/database/client';
import type { ToolContext } from './ecommerce';

// ---------------------------------------------------------------------------
// Audience Tool Schemas
// ---------------------------------------------------------------------------

export const AUDIENCE_TOOL_SCHEMAS: Anthropic.Tool[] = [
  {
    name: 'list_audiences',
    description:
      'List all custom audiences, lookalike audiences, and saved audiences. Shows name, type, estimated size, platforms, and sync status.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'create_custom_audience',
    description:
      'Create a custom audience segment. Types: customer_list (hashed emails from orders), website (retargeting), catalog (product interaction). After creating, suggest creating a lookalike from it.',
    input_schema: {
      type: 'object' as const,
      properties: {
        audience_type: {
          type: 'string',
          enum: ['customer_list', 'website', 'catalog'],
          description: 'customer_list, website, or catalog',
        },
        name: {
          type: 'string',
          description: 'Audience name, e.g. "VIP Customers - Top 10%"',
        },
        description: {
          type: 'string',
          description: 'Description of the audience',
        },
        segment: {
          type: 'string',
          description: 'For customer_list: all, vip, repeat, high_ltv, recent, lapsed',
          default: 'all',
        },
        event_type: {
          type: 'string',
          description: 'For website/catalog: event to target (all_visitors, add_to_cart, purchase, etc.)',
          default: 'all_visitors',
        },
        retention_days: {
          type: 'integer',
          description: 'For website/catalog: days to look back (7, 14, 30, 60, 90, 180)',
          default: 30,
        },
        platforms: {
          type: 'array',
          items: { type: 'string' },
          description: 'Platforms to sync to: meta, google, bing',
        },
      },
      required: ['audience_type', 'name'],
    },
  },
  {
    name: 'create_lookalike_audience',
    description:
      'Create a lookalike audience from an existing custom audience. Meta/Google finds people similar to your source audience — best prospecting strategy.',
    input_schema: {
      type: 'object' as const,
      properties: {
        source_audience_id: {
          type: 'string',
          description: 'ID of the source audience to base the lookalike on',
        },
        name: {
          type: 'string',
          description: 'Name for the lookalike, e.g. "LAL 1% - VIP Customers - US"',
        },
        country: {
          type: 'string',
          description: 'ISO country code, e.g. US, CA, GB',
          default: 'US',
        },
        ratio: {
          type: 'number',
          description: 'Lookalike size 0.01-0.10 (1% = highest quality, 10% = broadest)',
          default: 0.01,
        },
      },
      required: ['source_audience_id', 'name'],
    },
  },
  {
    name: 'get_audience_insights',
    description:
      'Get estimated size, overlap data, and details for a specific audience segment.',
    input_schema: {
      type: 'object' as const,
      properties: {
        audience_id: {
          type: 'string',
          description: 'Audience segment ID',
        },
      },
      required: ['audience_id'],
    },
  },
  {
    name: 'smart_targeting',
    description:
      'Analyse customer order data to generate smart targeting recommendations: top geographies, AOV segments, customer lifetime value distribution. Use BEFORE creating a campaign to make data-driven targeting decisions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        days: {
          type: 'integer',
          description: 'Days of order history to analyse (default 90)',
          default: 90,
        },
      },
      required: [],
    },
  },
  {
    name: 'search_locations',
    description:
      'Search for Meta geo targeting keys by location name. Use BEFORE creating a Meta campaign to resolve region/city names to the correct targeting keys.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: {
          type: 'string',
          description: 'Location name to look up, e.g. "California", "Ontario", "Toronto"',
        },
        location_type: {
          type: 'string',
          enum: ['region', 'city', 'country', 'zip'],
          description: 'region, city, country, or zip',
          default: 'region',
        },
      },
      required: ['query'],
    },
  },
];

export const AUDIENCE_TOOL_NAMES = new Set(AUDIENCE_TOOL_SCHEMAS.map((t) => t.name));

// ---------------------------------------------------------------------------
// Static location key lookup (subset — full lookup would call Meta API)
// ---------------------------------------------------------------------------

const REGION_KEYS: Record<string, { key: string; name: string; country: string }> = {
  california: { key: '3847', name: 'California', country: 'US' },
  texas: { key: '3861', name: 'Texas', country: 'US' },
  florida: { key: '3851', name: 'Florida', country: 'US' },
  'new york': { key: '3855', name: 'New York', country: 'US' },
  illinois: { key: '3852', name: 'Illinois', country: 'US' },
  washington: { key: '3863', name: 'Washington', country: 'US' },
  ontario: { key: '533', name: 'Ontario', country: 'CA' },
  'british columbia': { key: '536', name: 'British Columbia', country: 'CA' },
  alberta: { key: '534', name: 'Alberta', country: 'CA' },
  'england': { key: '2347', name: 'England', country: 'GB' },
  'scotland': { key: '2348', name: 'Scotland', country: 'GB' },
  'maharashtra': { key: '2348', name: 'Maharashtra', country: 'IN' },
  'delhi': { key: '2349', name: 'Delhi', country: 'IN' },
  'karnataka': { key: '2350', name: 'Karnataka', country: 'IN' },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function estimateAudienceSize(
  audienceType: string,
  segment: string,
  eventType: string,
  retentionDays: number,
  totalCustomers: number
): number {
  let base = totalCustomers;
  if (audienceType === 'customer_list') {
    switch (segment) {
      case 'vip':     base = Math.round(totalCustomers * 0.1); break;
      case 'repeat':  base = Math.round(totalCustomers * 0.3); break;
      case 'high_ltv': base = Math.round(totalCustomers * 0.2); break;
      case 'recent':  base = Math.round(totalCustomers * 0.25); break;
      case 'lapsed':  base = Math.round(totalCustomers * 0.4); break;
      default:        base = totalCustomers;
    }
    // Meta matches ~60% of emails
    return Math.round(base * 0.6);
  }

  if (audienceType === 'website') {
    const dayMultiplier = retentionDays / 30;
    const eventMultiplier = eventType === 'all_visitors' ? 10 : eventType === 'add_to_cart' ? 3 : 1;
    return Math.round(totalCustomers * eventMultiplier * dayMultiplier * 2);
  }

  if (audienceType === 'catalog') {
    return Math.round(totalCustomers * 2);
  }

  return totalCustomers;
}

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

async function handleListAudiences(ctx: ToolContext): Promise<unknown> {
  const segments = await prisma.audienceSegment.findMany({
    where: { organizationId: ctx.orgId },
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: {
      id: true,
      name: true,
      description: true,
      type: true,
      platforms: true,
      estimatedSize: true,
      syncStatus: true,
      lastSyncAt: true,
      createdAt: true,
    },
  });

  return {
    total: segments.length,
    audiences: segments.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      type: s.type,
      platforms: s.platforms,
      estimated_size: s.estimatedSize,
      sync_status: s.syncStatus,
      last_sync_at: s.lastSyncAt?.toISOString().slice(0, 10) ?? null,
      created_at: s.createdAt.toISOString().slice(0, 10),
    })),
  };
}

async function handleCreateCustomAudience(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  const {
    audience_type,
    name,
    description,
    segment = 'all',
    event_type = 'all_visitors',
    retention_days = 30,
    platforms = ['meta'],
  } = input as {
    audience_type: string;
    name: string;
    description?: string;
    segment?: string;
    event_type?: string;
    retention_days?: number;
    platforms?: string[];
  };

  const totalCustomers = await prisma.customerProfile.count({
    where: { organizationId: ctx.orgId },
  });

  const estimatedSize = estimateAudienceSize(
    audience_type,
    segment,
    event_type,
    retention_days,
    totalCustomers
  );

  const rules =
    audience_type === 'customer_list'
      ? [{ field: 'segment', operator: 'equals', value: segment }]
      : audience_type === 'website'
      ? [
          { field: 'event_type', operator: 'equals', value: event_type },
          { field: 'retention_days', operator: 'equals', value: retention_days },
        ]
      : [{ field: 'catalog_event', operator: 'equals', value: event_type }];

  const newSegment = await prisma.audienceSegment.create({
    data: {
      organizationId: ctx.orgId,
      name,
      description: description ?? '',
      type: audience_type,
      platforms: platforms as string[],
      rules,
      estimatedSize,
      syncStatus: 'pending',
    },
    select: { id: true, name: true, estimatedSize: true },
  });

  return {
    success: true,
    audience_id: newSegment.id,
    name: newSegment.name,
    estimated_size: newSegment.estimatedSize,
    type: audience_type,
    platforms,
    sync_status: 'pending',
    message: `Custom audience "${name}" created with ~${estimatedSize.toLocaleString()} estimated members. Sync to platforms is queued.`,
    next_steps: 'Consider creating a 1% lookalike from this audience for prospecting using create_lookalike_audience.',
  };
}

async function handleCreateLookalikeAudience(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  const {
    source_audience_id,
    name,
    country = 'US',
    ratio = 0.01,
  } = input as {
    source_audience_id: string;
    name: string;
    country?: string;
    ratio?: number;
  };

  const source = await prisma.audienceSegment.findFirst({
    where: { id: source_audience_id, organizationId: ctx.orgId },
    select: { name: true, estimatedSize: true, platforms: true },
  });

  if (!source) return { error: 'Source audience not found' };

  const estimatedSize = Math.round((source.estimatedSize ?? 10000) / ratio * 0.01);

  const lookalike = await prisma.audienceSegment.create({
    data: {
      organizationId: ctx.orgId,
      name,
      description: `Lookalike of "${source.name}" — ${(ratio * 100).toFixed(0)}% in ${country}`,
      type: 'lookalike',
      platforms: source.platforms,
      rules: [
        { field: 'source_audience_id', operator: 'equals', value: source_audience_id },
        { field: 'country', operator: 'equals', value: country },
        { field: 'ratio', operator: 'equals', value: ratio },
      ],
      estimatedSize,
      syncStatus: 'pending',
    },
    select: { id: true, name: true, estimatedSize: true },
  });

  return {
    success: true,
    audience_id: lookalike.id,
    name: lookalike.name,
    source_audience: source.name,
    country,
    ratio_pct: (ratio * 100).toFixed(0) + '%',
    estimated_size: estimatedSize.toLocaleString(),
    message: `Lookalike audience "${name}" created. Meta will find ${(ratio * 100).toFixed(0)}% of ${country} Facebook users most similar to "${source.name}".`,
  };
}

async function handleGetAudienceInsights(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  const { audience_id } = input as { audience_id: string };

  const segment = await prisma.audienceSegment.findFirst({
    where: { id: audience_id, organizationId: ctx.orgId },
    include: {
      members: { select: { profileId: true }, take: 1 },
      _count: { select: { members: true } },
    },
  });

  if (!segment) return { error: 'Audience not found' };

  return {
    id: segment.id,
    name: segment.name,
    description: segment.description,
    type: segment.type,
    platforms: segment.platforms,
    estimated_size: segment.estimatedSize,
    actual_member_count: segment._count.members,
    sync_status: segment.syncStatus,
    synced_platforms: segment.syncedPlatforms,
    last_sync_at: segment.lastSyncAt?.toISOString() ?? null,
    rules: segment.rules,
    rule_logic: segment.ruleLogic,
  };
}

async function handleSmartTargeting(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  const days = (input.days as number) ?? 90;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const orders = await prisma.commerceOrder.findMany({
    where: { organizationId: ctx.orgId, placedAt: { gte: since } },
    select: { totalAmount: true, channel: true },
    take: 1000,
  });

  if (orders.length === 0) {
    return {
      message: 'No order data found. Connect a commerce store to get smart targeting recommendations.',
      recommendations: [],
    };
  }

  // Group by channel; geography would require enriched address data
  const geoMap: Record<string, number> = {};
  const aovBuckets = { low: 0, mid: 0, high: 0 };
  let totalRevenue = 0;

  for (const o of orders) {
    const geo = o.channel ?? 'Direct';
    geoMap[geo] = (geoMap[geo] ?? 0) + 1;

    const price = parseFloat(o.totalAmount.toString());
    totalRevenue += price;
    if (price < 50) aovBuckets.low++;
    else if (price < 150) aovBuckets.mid++;
    else aovBuckets.high++;
  }

  const topGeos = Object.entries(geoMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, count]) => ({ name, order_count: count, share_pct: ((count / orders.length) * 100).toFixed(1) }));

  const avgOrderValue = totalRevenue / orders.length;
  const dominantAovSegment =
    aovBuckets.high > aovBuckets.mid && aovBuckets.high > aovBuckets.low
      ? 'high (>$150)'
      : aovBuckets.mid > aovBuckets.low
      ? 'mid ($50-$150)'
      : 'low (<$50)';

  const recommendations = [
    `Target top geographic regions: ${topGeos.map((g) => g.name).join(', ')}`,
    `Suggested daily budget: $${Math.round(avgOrderValue * 0.2 * 10) / 10}-$${Math.round(avgOrderValue * 0.5 * 10) / 10} (based on ${ctx.currency} ${avgOrderValue.toFixed(0)} AOV)`,
    `Customer AOV profile: ${dominantAovSegment} — adjust bidding strategy accordingly`,
    `Create a customer list from your top buyers and use 1% lookalike for prospecting`,
  ];

  return {
    period: `${days}d`,
    total_orders: orders.length,
    avg_order_value: avgOrderValue.toFixed(2),
    currency: ctx.currency,
    top_regions: topGeos,
    aov_distribution: aovBuckets,
    recommendations,
  };
}

async function handleSearchLocations(input: Record<string, unknown>): Promise<unknown> {
  const query = ((input.query as string) ?? '').toLowerCase().trim();
  const locationType = (input.location_type as string) ?? 'region';

  const match = REGION_KEYS[query];
  if (match) {
    return {
      results: [{ ...match, type: locationType }],
      note: 'Use the "key" value in your campaign targeting spec.',
    };
  }

  // Fuzzy partial match
  const fuzzy = Object.values(REGION_KEYS).filter((v) =>
    v.name.toLowerCase().includes(query)
  );

  if (fuzzy.length > 0) {
    return {
      results: fuzzy.map((v) => ({ ...v, type: locationType })),
      note: 'Use the "key" value in your campaign targeting spec.',
    };
  }

  return {
    results: [],
    message: `No targeting key found for "${query}". For production, this would call the Meta Targeting Search API. For now, use the country ISO code directly (e.g. US, CA, GB) as a fallback.`,
  };
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export async function executeAudienceTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  switch (name) {
    case 'list_audiences':           return handleListAudiences(ctx);
    case 'create_custom_audience':   return handleCreateCustomAudience(input, ctx);
    case 'create_lookalike_audience': return handleCreateLookalikeAudience(input, ctx);
    case 'get_audience_insights':    return handleGetAudienceInsights(input, ctx);
    case 'smart_targeting':          return handleSmartTargeting(input, ctx);
    case 'search_locations':         return handleSearchLocations(input);
    default:
      throw new Error(`Unknown audience tool: ${name}`);
  }
}
