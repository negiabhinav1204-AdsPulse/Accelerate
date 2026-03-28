import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@workspace/database/client';
import type { ToolContext } from './ecommerce';

// ---------------------------------------------------------------------------
// Platform + Feeds + Strategy Tool Schemas
// ---------------------------------------------------------------------------

export const PLATFORM_TOOL_SCHEMAS: Anthropic.Tool[] = [
  // ── Platform status ──────────────────────────────────────────────────────
  {
    name: 'get_connected_platforms',
    description:
      'Get all connected ad platforms (Meta, Google, Bing) with account details, connection status, and last sync time.',
    input_schema: {
      type: 'object' as const,
      properties: {
        platform: {
          type: 'string',
          description: 'Filter by platform: google, meta, bing, or omit for all',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_ad_platform_status',
    description:
      'Check the health and connection status of all ad platforms. Use when the user asks "which platforms are connected" or before suggesting multi-platform campaigns.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  // ── Product feeds ────────────────────────────────────────────────────────
  {
    name: 'get_feed_health',
    description:
      'Get product feed health scores, last push times, and issue counts for all connected feeds (Google Shopping, Meta Catalog, etc.).',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  {
    name: 'generate_product_feed',
    description:
      'Generate an optimised product feed snapshot from the product catalog. Returns products with AI-optimised titles, health scores, and smart segments.',
    input_schema: {
      type: 'object' as const,
      properties: {
        segment: {
          type: 'string',
          description: 'Filter by segment: best_sellers, new_arrivals, high_margin, underperformers, all (default all)',
          default: 'all',
        },
        limit: {
          type: 'integer',
          description: 'Max products to return (default 20)',
          default: 20,
        },
      },
      required: [],
    },
  },
  {
    name: 'get_merchant_center_status',
    description:
      'Check connected Google Merchant Center accounts, their sync status, and any product disapprovals.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
  // ── Strategy ─────────────────────────────────────────────────────────────
  {
    name: 'suggest_campaign_strategy',
    description:
      'Analyse product feed segments and suggest an optimal multi-campaign strategy. Returns segment breakdown with recommended campaign configurations. Use when user asks "what campaigns should I run?" or "help me plan my ads".',
    input_schema: {
      type: 'object' as const,
      properties: {
        total_daily_budget: {
          type: 'number',
          description: 'Total daily budget available across all campaigns (in org currency)',
        },
        objective: {
          type: 'string',
          description: 'Primary goal: max_conversions, max_roas, awareness, traffic (default max_conversions)',
          default: 'max_conversions',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_campaign_strategies',
    description:
      'Get available campaign strategies/types for a specific platform. Call this when the user is choosing what type of campaign to create.',
    input_schema: {
      type: 'object' as const,
      properties: {
        platform: {
          type: 'string',
          enum: ['google', 'meta', 'bing'],
          description: 'Ad platform: google, meta, or bing',
        },
      },
      required: ['platform'],
    },
  },
  {
    name: 'growth_opportunities',
    description:
      'Find untapped growth opportunities by comparing customer data with campaign coverage. Identifies products with high velocity but no active campaigns, top regions with no geo-targeting, and audience gaps.',
    input_schema: {
      type: 'object' as const,
      properties: {},
      required: [],
    },
  },
];

export const PLATFORM_TOOL_NAMES = new Set(PLATFORM_TOOL_SCHEMAS.map((t) => t.name));

// ---------------------------------------------------------------------------
// Static strategy configs
// ---------------------------------------------------------------------------

const PLATFORM_STRATEGIES: Record<string, { id: string; name: string; description: string; best_for: string }[]> = {
  google: [
    { id: 'pmax', name: 'Performance Max', description: 'AI-driven across Search, Display, YouTube, Shopping. Google auto-optimises.', best_for: 'Most businesses — best overall performance' },
    { id: 'shopping_pmax', name: 'Shopping PMax', description: 'Product feed-powered PMax. Shows in Google Shopping and Search.', best_for: 'E-commerce with Merchant Center feed' },
    { id: 'search', name: 'Search (RSA)', description: 'Responsive Search Ads with keywords. High intent traffic.', best_for: 'Products with specific search demand' },
    { id: 'display', name: 'Display', description: 'Image ads across 2M+ sites on Google Display Network.', best_for: 'Retargeting and awareness' },
  ],
  meta: [
    { id: 'advantage_plus', name: 'Advantage+ Shopping', description: 'Meta\'s AI-powered shopping campaign. Best-in-class for e-commerce.', best_for: 'E-commerce with product catalog' },
    { id: 'catalog_sales', name: 'Catalog Sales', description: 'Dynamic product ads from your Meta catalog.', best_for: 'Retargeting with specific products' },
    { id: 'traffic', name: 'Traffic', description: 'Drive clicks to your website or landing page.', best_for: 'Top-of-funnel and content promotion' },
    { id: 'lead_gen', name: 'Lead Generation', description: 'Capture leads with native Meta forms.', best_for: 'Services and consultation businesses' },
  ],
  bing: [
    { id: 'search', name: 'Search (RSA)', description: 'Responsive Search Ads with keyword targeting on Bing.', best_for: 'High-intent search traffic at lower CPC than Google' },
    { id: 'audience', name: 'Audience Ads', description: 'Native ads on Microsoft Audience Network.', best_for: 'Display/native reach with LinkedIn data targeting' },
    { id: 'shopping', name: 'Shopping', description: 'Product ads via Bing Merchant Center.', best_for: 'E-commerce with Bing Merchant Center' },
  ],
};

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

async function handleGetConnectedPlatforms(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  const platformFilter = input.platform as string | undefined;

  const accounts = await prisma.connectedAdAccount.findMany({
    where: {
      organizationId: ctx.orgId,
      ...(platformFilter ? { platform: platformFilter } : {}),
    },
    select: {
      id: true,
      platform: true,
      accountId: true,
      accountName: true,
      currency: true,
      status: true,
      archivedAt: true,
      lastSyncAt: true,
    },
  });

  return {
    total: accounts.length,
    accounts: accounts.map((a) => ({
      id: a.id,
      platform: a.platform,
      account_id: a.accountId,
      account_name: a.accountName,
      currency: a.currency,
      is_active: a.status === 'connected' && !a.archivedAt,
      last_sync_at: a.lastSyncAt?.toISOString() ?? null,
    })),
  };
}

async function handleGetAdPlatformStatus(ctx: ToolContext): Promise<unknown> {
  const accounts = await prisma.connectedAdAccount.findMany({
    where: { organizationId: ctx.orgId },
    select: { platform: true, status: true, archivedAt: true, lastSyncAt: true, accountName: true },
  });

  const byPlatform: Record<string, { connected: boolean; accounts: string[]; last_sync: string | null }> = {
    meta: { connected: false, accounts: [], last_sync: null },
    google: { connected: false, accounts: [], last_sync: null },
    bing: { connected: false, accounts: [], last_sync: null },
  };

  for (const a of accounts) {
    const p = a.platform.toLowerCase();
    const isActive = a.status === 'connected' && !a.archivedAt;
    if (byPlatform[p]) {
      byPlatform[p]!.connected = isActive;
      byPlatform[p]!.accounts.push(a.accountName ?? a.platform);
      if (a.lastSyncAt) {
        byPlatform[p]!.last_sync = a.lastSyncAt.toISOString().slice(0, 16).replace('T', ' ');
      }
    }
  }

  const connectedCount = Object.values(byPlatform).filter((v) => v.connected).length;

  return {
    platforms: byPlatform,
    connected_count: connectedCount,
    summary: connectedCount === 0
      ? 'No ad platforms connected. Go to Connectors to link Meta, Google, or Bing.'
      : `${connectedCount} platform(s) connected.`,
  };
}

async function handleGetFeedHealth(ctx: ToolContext): Promise<unknown> {
  const feeds = await prisma.productFeed.findMany({
    where: { organizationId: ctx.orgId },
    include: {
      connector: { select: { name: true, platform: true } },
      rules: { select: { id: true, isActive: true } },
    },
  });

  if (feeds.length === 0) {
    return {
      total: 0,
      feeds: [],
      message: 'No product feeds configured. Connect a commerce store and set up a feed in Shopping Feeds.',
    };
  }

  return {
    total: feeds.length,
    feeds: feeds.map((f) => ({
      id: f.id,
      name: f.name,
      channel: f.channel,
      connector: f.connector.name,
      health_score: f.healthScore ?? null,
      last_pushed_at: f.lastPushedAt?.toISOString().slice(0, 16).replace('T', ' ') ?? null,
      active_rules: f.rules.filter((r) => r.isActive).length,
      health_label:
        f.healthScore == null ? 'Unknown'
        : f.healthScore >= 90 ? 'Excellent'
        : f.healthScore >= 70 ? 'Good'
        : f.healthScore >= 50 ? 'Fair'
        : 'Needs attention',
    })),
  };
}

async function handleGenerateProductFeed(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  const segment = (input.segment as string) ?? 'all';
  const limit = (input.limit as number) ?? 20;

  const products = await prisma.product.findMany({
    where: {
      organizationId: ctx.orgId,
      status: 'ACTIVE',
    },
    orderBy: [{ salesVelocity: 'desc' }, { revenueL30d: 'desc' }],
    take: limit * 2, // fetch more, filter down
    select: {
      id: true,
      title: true,
      price: true,
      inventoryQty: true,
      salesVelocity: true,
      revenueL30d: true,
      externalId: true,
    },
  });

  let filtered = products;
  if (segment === 'best_sellers') {
    filtered = products.filter((p) => (p.salesVelocity ?? 0) > 5).slice(0, limit);
  } else if (segment === 'new_arrivals') {
    // For now, just take recent products (we'd need createdAt sorting for real logic)
    filtered = products.slice(0, limit);
  } else if (segment === 'high_margin') {
    filtered = products.filter((p) => parseFloat(p.price.toString()) > 50).slice(0, limit);
  } else if (segment === 'underperformers') {
    filtered = products.filter((p) => (p.salesVelocity ?? 0) < 1).slice(0, limit);
  } else {
    filtered = products.slice(0, limit);
  }

  return {
    segment,
    total: filtered.length,
    currency: ctx.currency,
    products: filtered.map((p) => ({
      id: p.id,
      external_id: p.externalId,
      title: p.title,
      price: parseFloat(p.price.toString()).toFixed(2),
      inventory: p.inventoryQty,
      weekly_velocity: p.salesVelocity ?? 0,
      revenue_30d: p.revenueL30d ? parseFloat(p.revenueL30d.toString()).toFixed(2) : '0',
      feed_health: p.inventoryQty === 0 ? 'out_of_stock' : (p.salesVelocity ?? 0) > 5 ? 'active' : 'low_demand',
    })),
  };
}

async function handleGetMerchantCenterStatus(ctx: ToolContext): Promise<unknown> {
  const accounts = await prisma.merchantCenterAccount.findMany({
    where: { organizationId: ctx.orgId },
    select: {
      id: true,
      merchantId: true,
      accountName: true,
      isActive: true,
      lastSyncAt: true,
      createdAt: true,
    },
  });

  if (accounts.length === 0) {
    return {
      connected: false,
      message: 'No Google Merchant Center account connected. Go to Connectors → Shopping Feeds to link your GMC account.',
    };
  }

  return {
    connected: true,
    accounts: accounts.map((a) => ({
      id: a.id,
      merchant_id: a.merchantId,
      account_name: a.accountName,
      is_active: a.isActive,
      last_sync_at: a.lastSyncAt?.toISOString().slice(0, 16).replace('T', ' ') ?? null,
    })),
  };
}

async function handleSuggestCampaignStrategy(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  const totalBudget = (input.total_daily_budget as number) ?? null;
  const objective = (input.objective as string) ?? 'max_conversions';

  // Count products by segment
  const [totalProducts, highVelocity, lowStock] = await Promise.all([
    prisma.product.count({ where: { organizationId: ctx.orgId, status: 'ACTIVE' } }),
    prisma.product.count({ where: { organizationId: ctx.orgId, status: 'ACTIVE', salesVelocity: { gte: 5 } } }),
    prisma.product.count({ where: { organizationId: ctx.orgId, inventoryQty: { gt: 0, lte: 10 } } }),
  ]);

  // Count existing active campaigns per platform
  const activePlatforms = await prisma.platformCampaign.groupBy({
    by: ['platform'],
    where: { campaign: { organizationId: ctx.orgId, archivedAt: null }, status: 'active' },
    _count: true,
  });

  const platformCoverage: Record<string, number> = {};
  for (const row of activePlatforms) {
    platformCoverage[row.platform.toLowerCase()] = row._count;
  }

  const suggestions = [];

  if (highVelocity > 0) {
    suggestions.push({
      priority: 1,
      type: 'google_pmax',
      platform: 'google',
      reason: `${highVelocity} best-selling products need Google PMax campaigns`,
      recommended_budget: totalBudget ? (totalBudget * 0.5).toFixed(0) : '30',
      objective,
    });
  }

  if (!platformCoverage.meta) {
    suggestions.push({
      priority: 2,
      type: 'meta_advantage_plus',
      platform: 'meta',
      reason: 'No Meta campaigns active — Advantage+ Shopping is typically the highest-ROAS Meta campaign type',
      recommended_budget: totalBudget ? (totalBudget * 0.35).toFixed(0) : '20',
      objective,
    });
  }

  if (lowStock > 0) {
    suggestions.push({
      priority: 3,
      type: 'pause_low_inventory',
      platform: 'all',
      reason: `${lowStock} products have <10 units left — pause or exclude from campaigns to avoid wasted ad spend`,
      recommended_budget: null,
      objective: 'inventory_management',
    });
  }

  return {
    total_products: totalProducts,
    best_sellers: highVelocity,
    low_stock_products: lowStock,
    active_campaigns_by_platform: platformCoverage,
    objective,
    suggestions,
    summary:
      suggestions.length === 0
        ? 'Your campaign coverage looks solid. Consider running a campaign health check to find optimisation opportunities.'
        : `Found ${suggestions.length} strategic opportunities to improve your campaign mix.`,
  };
}

async function handleGetCampaignStrategies(input: Record<string, unknown>): Promise<unknown> {
  const platform = (input.platform as string) ?? 'google';
  const strategies = PLATFORM_STRATEGIES[platform];

  if (!strategies) return { error: `Unknown platform: ${platform}` };

  return {
    platform,
    strategies,
  };
}

async function handleGrowthOpportunities(ctx: ToolContext): Promise<unknown> {
  const [
    topProducts,
    activeCampaignProductIds,
    totalCustomers,
    recentOrders,
  ] = await Promise.all([
    prisma.product.findMany({
      where: { organizationId: ctx.orgId, status: 'ACTIVE' },
      orderBy: [{ salesVelocity: 'desc' }],
      take: 20,
      select: { id: true, title: true, salesVelocity: true, revenueL30d: true },
    }),
    // Products referenced in existing campaigns via agentOutputs
    prisma.campaign.findMany({
      where: { organizationId: ctx.orgId, archivedAt: null },
      select: { agentOutputs: true },
    }),
    prisma.customerProfile.count({ where: { organizationId: ctx.orgId } }),
    prisma.commerceOrder.count({
      where: { organizationId: ctx.orgId, placedAt: { gte: new Date(Date.now() - 30 * 86400000) } },
    }),
  ]);

  // Extract product IDs from campaign agent outputs
  const campaignedProductIds = new Set<string>();
  for (const c of activeCampaignProductIds) {
    const outputs = c.agentOutputs as Record<string, unknown> | null;
    if (outputs?.productId) campaignedProductIds.add(outputs.productId as string);
  }

  const uncoveredProducts = topProducts
    .filter((p) => !campaignedProductIds.has(p.id) && (p.salesVelocity ?? 0) > 2)
    .slice(0, 5);

  const opportunities = [];

  if (uncoveredProducts.length > 0) {
    opportunities.push({
      type: 'uncovered_products',
      title: 'Top products with no campaigns',
      description: `${uncoveredProducts.length} best-selling products are not covered by any active campaign`,
      products: uncoveredProducts.map((p) => ({
        name: p.title,
        weekly_velocity: p.salesVelocity,
        revenue_30d: p.revenueL30d ? parseFloat(p.revenueL30d.toString()).toFixed(2) : '0',
      })),
      action: 'Create campaigns for these products to capture more revenue',
      priority: 'high',
    });
  }

  if (totalCustomers > 100) {
    opportunities.push({
      type: 'lookalike_audience',
      title: 'Create lookalike audiences from existing customers',
      description: `You have ${totalCustomers.toLocaleString()} customer profiles — enough to build high-quality lookalike audiences`,
      action: 'Use create_custom_audience to build a VIP customer list, then create_lookalike_audience for prospecting',
      priority: 'medium',
    });
  }

  if (recentOrders > 0) {
    opportunities.push({
      type: 'retargeting',
      title: 'Retarget recent buyers with upsells',
      description: `${recentOrders} orders in the last 30 days — target these buyers with complementary products`,
      action: 'Create a "recent_buyers" custom audience and run a catalog retargeting campaign',
      priority: 'medium',
    });
  }

  return {
    opportunities,
    customer_count: totalCustomers,
    recent_orders: recentOrders,
    summary:
      opportunities.length === 0
        ? 'Great coverage — no obvious growth gaps found. Run a campaign health check for optimisation opportunities.'
        : `Found ${opportunities.length} growth opportunity(ies) ready to act on.`,
  };
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export async function executePlatformTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  switch (name) {
    case 'get_connected_platforms':   return handleGetConnectedPlatforms(input, ctx);
    case 'get_ad_platform_status':    return handleGetAdPlatformStatus(ctx);
    case 'get_feed_health':           return handleGetFeedHealth(ctx);
    case 'generate_product_feed':     return handleGenerateProductFeed(input, ctx);
    case 'get_merchant_center_status': return handleGetMerchantCenterStatus(ctx);
    case 'suggest_campaign_strategy': return handleSuggestCampaignStrategy(input, ctx);
    case 'get_campaign_strategies':   return handleGetCampaignStrategies(input);
    case 'growth_opportunities':      return handleGrowthOpportunities(ctx);
    default:
      throw new Error(`Unknown platform tool: ${name}`);
  }
}
