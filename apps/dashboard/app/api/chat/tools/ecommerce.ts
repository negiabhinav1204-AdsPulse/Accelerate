/**
 * Ecommerce data tools for Accelera AI — Phase 2.
 *
 * Each tool has:
 *   - schema: Anthropic Tool definition (shown to Claude)
 *   - handler: server-side execution, calls commerce-service or falls back to Prisma
 *
 * Adaptiv reference: copilot.py get_shopify_* tools, rewritten for CommerceConnector pattern.
 */

import type Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@workspace/database/client';
import { SERVICES, getService } from '~/lib/service-router';
import { MOCK_SHOPIFY_PRODUCTS } from '~/lib/platforms/shopify-mock';

// ── Schemas ────────────────────────────────────────────────────────────────

export const ECOMMERCE_TOOL_SCHEMAS: Anthropic.Tool[] = [
  {
    name: 'get_products',
    description:
      'List products from connected commerce stores. Returns product titles, prices, inventory, and 30-day sales velocity. Use when the user asks about products, catalog, or which items to advertise.',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: {
          type: 'integer',
          description: 'Max products to return (1–50, default 20)',
          default: 20,
        },
        sort: {
          type: 'string',
          description:
            'Sort order: velocity_desc (top sellers by 30d velocity), revenue_desc (top by revenue), inventory_asc (low stock first), title_asc',
          default: 'velocity_desc',
        },
        status: {
          type: 'string',
          description: 'Filter by status: active, draft. Default: active.',
          default: 'active',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_sales',
    description:
      'Get real sales and orders data for a time period. Returns order count, total revenue, AOV, and top-selling products scoped to the period. Use when asked about sales performance, revenue, or orders.',
    input_schema: {
      type: 'object' as const,
      properties: {
        days: {
          type: 'integer',
          description: 'Number of days to look back (default 30)',
          default: 30,
        },
      },
      required: [],
    },
  },
  {
    name: 'get_ecommerce_overview',
    description:
      'Get full ecommerce KPI overview: revenue, orders, AOV, new customers, repeat rate, and period-over-period comparison. Best for "how is the store doing" or "ecommerce performance" questions.',
    input_schema: {
      type: 'object' as const,
      properties: {
        period: {
          type: 'string',
          description: 'Period: 7d, 30d, or 90d. Default: 30d.',
          default: '30d',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_inventory_health',
    description:
      'Get inventory health report: low-stock items, out-of-stock products, sales velocity, and estimated days-until-stockout. Use for "what products are running low", "inventory status", or "out of stock" queries.',
    input_schema: {
      type: 'object' as const,
      properties: {
        threshold: {
          type: 'integer',
          description: 'Stock quantity threshold to flag as low (default 10)',
          default: 10,
        },
      },
      required: [],
    },
  },
  {
    name: 'get_product_insights',
    description:
      'Get AI-generated insights for a specific product: performance analysis, ad readiness score, recommended improvements, and campaign suggestions. Use when the user asks about a specific product or wants to advertise one product.',
    input_schema: {
      type: 'object' as const,
      properties: {
        product_id: {
          type: 'string',
          description: 'Product ID to get insights for',
        },
        product_title: {
          type: 'string',
          description: 'Product title (use if no product_id)',
        },
      },
      required: [],
    },
  },
  {
    name: 'get_product_suggestions',
    description:
      'Get AI-ranked product suggestions for advertising — top products by sales velocity, ad readiness, and revenue potential. Use when user asks "what should I advertise?", "which products to promote?", or "best products for ads".',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: {
          type: 'integer',
          description: 'Max products to return (default 5, max 10)',
          default: 5,
        },
      },
      required: [],
    },
  },
];

export const ECOMMERCE_TOOL_NAMES = new Set(ECOMMERCE_TOOL_SCHEMAS.map((t) => t.name));

// ── Handler context ────────────────────────────────────────────────────────

export type ToolContext = {
  orgId: string;
  currency: string;
};

// ── Helpers ────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function periodDays(period: string): number {
  if (period === '7d') return 7;
  if (period === '90d') return 90;
  return 30;
}

function classify(product: { salesVelocity: number | null; revenueL30d: unknown; inventoryQty: number | null }): string {
  const velocity = product.salesVelocity ?? 0;
  const revenue = parseFloat(String(product.revenueL30d ?? '0'));
  if (velocity > 10 && revenue > 500) return 'best_seller';
  if (velocity > 5) return 'trending';
  if (revenue > 200) return 'high_value';
  if ((product.inventoryQty ?? 999) < 5) return 'low_stock';
  return '';
}

// ── Tool handlers ──────────────────────────────────────────────────────────

async function handleGetProducts(
  input: { limit?: number; sort?: string; status?: string },
  ctx: ToolContext
): Promise<unknown> {
  const limit = Math.min(input.limit ?? 20, 50);
  const sort = input.sort ?? 'velocity_desc';
  const status = input.status ?? 'active';

  // Try commerce-service first
  if (SERVICES.commerce.enabled) {
    try {
      const params = new URLSearchParams({
        org_id: ctx.orgId,
        limit: String(limit),
        sort,
        status,
      });
      const res = await getService(SERVICES.commerce.url, `/products?${params}`);
      if (res.ok) return await res.json();
    } catch { /* fall through */ }
  }

  // Shopping Feeds mock data fallback
  let mockProducts = [...MOCK_SHOPIFY_PRODUCTS];

  // Apply status filter
  if (status === 'active') {
    mockProducts = mockProducts.filter((p) => p.availability === 'in stock');
  }

  // Apply sort
  if (sort === 'inventory_asc') mockProducts.sort((a, b) => a.inventory - b.inventory);
  else if (sort === 'revenue_desc') mockProducts.sort((a, b) => b.velocity_30d * b.price - a.velocity_30d * a.price);
  else if (sort === 'title_asc') mockProducts.sort((a, b) => a.title.localeCompare(b.title));
  else mockProducts.sort((a, b) => b.velocity_30d - a.velocity_30d);

  mockProducts = mockProducts.slice(0, limit);

  return {
    products: mockProducts.map((p) => ({
      id: p.id,
      title: p.title,
      price: `$${p.price.toFixed(2)}`,
      sale_price: p.salePrice ? `$${p.salePrice.toFixed(2)}` : null,
      image_url: p.imageUrl,
      sku: p.sku,
      status: p.availability,
      inventory: p.inventory,
      velocity_30d: p.velocity_30d,
      sold_30d: p.sold_30d,
      revenue_30d: `$${(p.velocity_30d * (p.salePrice ?? p.price)).toFixed(2)}`,
      currency: p.currency,
      badge: (() => {
        if (p.velocity_30d > 20) return 'best_seller';
        if (p.velocity_30d > 8) return 'trending';
        if (p.price > 150 && p.velocity_30d > 0) return 'high_value';
        if (p.inventory > 0 && p.inventory < 10) return 'low_stock';
        return '';
      })(),
      insight: p.velocity_30d > 15
        ? 'Top performer — consider increasing ad spend'
        : p.inventory < 10 && p.inventory > 0
        ? 'Low inventory — replenish soon'
        : p.velocity_30d === 0
        ? 'No recent sales — review listing quality'
        : 'Steady performer',
    })),
    total: mockProducts.length,
    source: 'shopping_feeds_mock',
  };
}

async function handleGetSales(
  input: { days?: number },
  ctx: ToolContext
): Promise<unknown> {
  const days = Math.min(input.days ?? 30, 365);

  if (SERVICES.commerce.enabled) {
    try {
      const params = new URLSearchParams({ org_id: ctx.orgId, days: String(days) });
      const res = await getService(SERVICES.commerce.url, `/revenue/summary?${params}`);
      if (res.ok) return await res.json();
    } catch { /* fall through */ }
  }

  const since = daysAgo(days);
  const prevSince = daysAgo(days * 2);

  const [currentRows, prevRows] = await Promise.all([
    prisma.dailyRevenueSummary.findMany({
      where: { organizationId: ctx.orgId, date: { gte: since } },
      select: { revenue: true, orders: true, date: true },
    }),
    prisma.dailyRevenueSummary.findMany({
      where: { organizationId: ctx.orgId, date: { gte: prevSince, lt: since } },
      select: { revenue: true, orders: true },
    }),
  ]);

  const revenue = currentRows.reduce((s, r) => s + parseFloat(r.revenue.toString()), 0);
  const orders = currentRows.reduce((s, r) => s + r.orders, 0);
  const prevRevenue = prevRows.reduce((s, r) => s + parseFloat(r.revenue.toString()), 0);
  const prevOrders = prevRows.reduce((s, r) => s + r.orders, 0);
  const aov = orders > 0 ? revenue / orders : 0;
  const prevAov = prevOrders > 0 ? prevRevenue / prevOrders : 0;

  // Top products by revenue in period
  const topOrders = await prisma.commerceOrderItem.findMany({
    where: {
      order: {
        organizationId: ctx.orgId,
        placedAt: { gte: since },
      },
    },
    select: {
      title: true,
      quantity: true,
      price: true,
      externalProductId: true,
    },
    take: 200,
  });

  const productMap = new Map<string, { title: string; revenue: number; units: number }>();
  for (const item of topOrders) {
    const key = item.externalProductId ?? item.title;
    const ex = productMap.get(key) ?? { title: item.title, revenue: 0, units: 0 };
    productMap.set(key, {
      title: ex.title,
      revenue: ex.revenue + parseFloat(item.price.toString()) * item.quantity,
      units: ex.units + item.quantity,
    });
  }
  const topProducts = [...productMap.values()]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10)
    .map((p) => ({ title: p.title, revenue: p.revenue.toFixed(2), units: p.units }));

  return {
    period_days: days,
    revenue: revenue.toFixed(2),
    orders,
    aov: aov.toFixed(2),
    currency: ctx.currency,
    prev_revenue: prevRevenue.toFixed(2),
    prev_orders: prevOrders,
    revenue_change_pct:
      prevRevenue > 0 ? (((revenue - prevRevenue) / prevRevenue) * 100).toFixed(1) : null,
    orders_change_pct:
      prevOrders > 0 ? (((orders - prevOrders) / prevOrders) * 100).toFixed(1) : null,
    aov_change_pct:
      prevAov > 0 ? (((aov - prevAov) / prevAov) * 100).toFixed(1) : null,
    top_products: topProducts,
    daily_data: currentRows
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((r) => ({ date: r.date.toISOString().split('T')[0], revenue: parseFloat(r.revenue.toString()) })),
  };
}

async function handleGetEcommerceOverview(
  input: { period?: string },
  ctx: ToolContext
): Promise<unknown> {
  const days = periodDays(input.period ?? '30d');

  if (SERVICES.commerce.enabled) {
    try {
      const params = new URLSearchParams({ org_id: ctx.orgId, period: input.period ?? '30d' });
      const res = await getService(SERVICES.commerce.url, `/revenue/summary?${params}`);
      if (res.ok) {
        const data = await res.json() as Record<string, unknown>;
        return data;
      }
    } catch { /* fall through */ }
  }

  const since = daysAgo(days);
  const prevSince = daysAgo(days * 2);

  const [summaries, prevSummaries, orders, prevOrders] = await Promise.all([
    prisma.dailyRevenueSummary.findMany({
      where: { organizationId: ctx.orgId, date: { gte: since } },
      select: { revenue: true, orders: true },
    }),
    prisma.dailyRevenueSummary.findMany({
      where: { organizationId: ctx.orgId, date: { gte: prevSince, lt: since } },
      select: { revenue: true, orders: true },
    }),
    prisma.commerceOrder.count({
      where: { organizationId: ctx.orgId, placedAt: { gte: since } },
    }),
    prisma.commerceOrder.count({
      where: { organizationId: ctx.orgId, placedAt: { gte: prevSince, lt: since } },
    }),
  ]);

  const revenue = summaries.reduce((s, r) => s + parseFloat(r.revenue.toString()), 0);
  const totalOrders = summaries.reduce((s, r) => s + r.orders, 0);
  const prevRevenue = prevSummaries.reduce((s, r) => s + parseFloat(r.revenue.toString()), 0);
  const prevTotal = prevSummaries.reduce((s, r) => s + r.orders, 0);
  const aov = totalOrders > 0 ? revenue / totalOrders : 0;
  const prevAov = prevTotal > 0 ? prevRevenue / prevTotal : 0;

  const pct = (a: number, b: number) => (b > 0 ? (((a - b) / b) * 100).toFixed(1) : null);

  return {
    period: input.period ?? '30d',
    period_days: days,
    revenue: revenue.toFixed(2),
    orders: totalOrders,
    aov: aov.toFixed(2),
    currency: ctx.currency,
    prev_revenue: prevRevenue.toFixed(2),
    prev_orders: prevTotal,
    prev_aov: prevAov.toFixed(2),
    revenue_change_pct: pct(revenue, prevRevenue),
    orders_change_pct: pct(totalOrders, prevTotal),
    aov_change_pct: pct(aov, prevAov),
    total_order_count: orders,
    prev_order_count: prevOrders,
    note: revenue === 0 ? 'No revenue data found. Connect a commerce store to see ecommerce KPIs.' : null,
  };
}

async function handleGetInventoryHealth(
  input: { threshold?: number },
  ctx: ToolContext
): Promise<unknown> {
  const threshold = input.threshold ?? 10;

  if (SERVICES.commerce.enabled) {
    try {
      const params = new URLSearchParams({ org_id: ctx.orgId, threshold: String(threshold) });
      const res = await getService(SERVICES.commerce.url, `/inventory/health?${params}`);
      if (res.ok) return await res.json();
    } catch { /* fall through */ }
  }

  // Shopping Feeds mock data fallback
  const activeProducts = MOCK_SHOPIFY_PRODUCTS;
  const outOfStock = activeProducts.filter((p) => p.inventory === 0);
  const lowStock = activeProducts.filter((p) => p.inventory > 0 && p.inventory <= threshold);

  const toItem = (p: typeof activeProducts[0], status: 'out_of_stock' | 'critical' | 'low') => {
    const weeklyVelocity = p.velocity_30d / 4;
    const daysUntilStockout =
      status !== 'out_of_stock' && weeklyVelocity > 0
        ? Math.round((p.inventory / weeklyVelocity) * 7)
        : null;
    return {
      title: p.title,
      inventory: p.inventory,
      weekly_velocity: parseFloat(weeklyVelocity.toFixed(1)),
      days_until_stockout: daysUntilStockout,
      at_risk_revenue: weeklyVelocity > 0 ? (weeklyVelocity * p.price).toFixed(2) : '0',
      status,
    };
  };

  const atRiskRevenue = [...outOfStock, ...lowStock].reduce((s, p) => {
    return s + (p.velocity_30d / 4) * p.price;
  }, 0);

  return {
    total_products: activeProducts.length,
    out_of_stock_count: outOfStock.length,
    low_stock_count: lowStock.length,
    threshold,
    at_risk_weekly_revenue: atRiskRevenue.toFixed(2),
    currency: ctx.currency,
    items: [
      ...outOfStock.map((p) => toItem(p, 'out_of_stock')),
      ...lowStock.map((p) => toItem(p, p.inventory <= 3 ? 'critical' : 'low')),
    ],
    note:
      outOfStock.length === 0 && lowStock.length === 0
        ? `No products below the ${threshold}-unit threshold.`
        : null,
    source: 'shopping_feeds_mock',
  };
}

async function handleGetProductInsights(
  input: { product_id?: string; product_title?: string },
): Promise<unknown> {
  // Find matching product from mock data
  let product = MOCK_SHOPIFY_PRODUCTS.find(p => p.id === input.product_id);
  if (!product && input.product_title) {
    const titleLower = input.product_title.toLowerCase();
    product = MOCK_SHOPIFY_PRODUCTS.find(p => p.title.toLowerCase().includes(titleLower));
  }
  if (!product) product = MOCK_SHOPIFY_PRODUCTS.sort((a, b) => b.velocity_30d - a.velocity_30d)[0];

  // Score ad readiness (0-100)
  let score = 50;
  if (product.imageUrl) score += 15;
  if (product.price > 20) score += 10;
  if ((product.issues?.length ?? 0) === 0) score += 15;
  if (product.velocity_30d > 5) score += 10;
  if (product.inventory > 10) score += 10;
  if (product.availability === 'in stock') score += 0; // already counted in inventory

  const badge = product.velocity_30d > 20 ? 'best_seller' : product.velocity_30d > 8 ? 'trending' : product.velocity_30d > 0 ? 'active' : 'low_velocity';

  const recommendations: string[] = [];
  if ((product.issues?.length ?? 0) > 0) recommendations.push(`Fix feed issues: ${product.issues![0]}`);
  if (product.inventory < 10 && product.inventory > 0) recommendations.push('Low inventory — replenish before running ads to avoid wasted spend');
  if (product.velocity_30d === 0) recommendations.push('No recent sales — improve product listing quality before advertising');
  if (score >= 75) recommendations.push('Strong ad candidate — consider Performance Max or Advantage+ Shopping');
  if (product.velocity_30d > 15) recommendations.push('Top seller — increase budget on this product, ROAS likely strong');

  return {
    product: {
      id: product.id,
      title: product.title,
      price: `$${product.price.toFixed(2)}`,
      inventory: product.inventory,
      velocity_30d: product.velocity_30d,
      badge,
    },
    ad_readiness_score: score,
    ad_readiness_label: score >= 80 ? 'Excellent' : score >= 65 ? 'Good' : score >= 50 ? 'Fair' : 'Poor',
    insights: {
      revenue_30d: `$${(product.velocity_30d * (product.salePrice ?? product.price)).toFixed(2)}`,
      channel_status: {
        google: product.channelStatus.google,
        meta: product.channelStatus.meta,
        microsoft: product.channelStatus.microsoft,
      },
      issues: product.issues ?? [],
    },
    recommendations,
    suggested_campaigns: score >= 60 ? [
      { platform: 'google', type: 'Performance Max', reason: 'High-intent buyers searching for this product' },
      { platform: 'meta', type: 'Advantage+ Shopping', reason: 'Visual product ads for discovery and retargeting' },
    ] : [
      { platform: 'meta', type: 'Traffic', reason: 'Build awareness before investing in conversion campaigns' },
    ],
  };
}

async function handleGetProductSuggestions(
  input: { limit?: number },
): Promise<unknown> {
  const limit = Math.min(input.limit ?? 5, 10);

  // Score products by ad readiness (same logic as ad_creator.py)
  const scored = MOCK_SHOPIFY_PRODUCTS.map(p => {
    let score = 0;
    if (p.imageUrl) score += 15;
    if (p.price >= 100) score += 15;
    else if (p.price >= 50) score += 10;
    else if (p.price >= 20) score += 5;
    if (p.velocity_30d > 20) score += 20;
    else if (p.velocity_30d > 10) score += 15;
    else if (p.velocity_30d > 5) score += 10;
    else if (p.velocity_30d > 0) score += 5;
    if ((p.issues?.length ?? 0) === 0) score += 15;
    if (p.inventory > 20) score += 10;
    else if (p.inventory > 5) score += 5;
    if (p.availability === 'in stock') score += 5;
    return { ...p, ad_score: score };
  });

  const top = scored.sort((a, b) => b.ad_score - a.ad_score).slice(0, limit);

  return {
    suggestions: top.map(p => ({
      id: p.id,
      title: p.title,
      price: `$${p.price.toFixed(2)}`,
      image_url: p.imageUrl,
      inventory: p.inventory,
      velocity_30d: p.velocity_30d,
      revenue_30d: `$${(p.velocity_30d * (p.salePrice ?? p.price)).toFixed(2)}`,
      ad_readiness_score: p.ad_score,
      badge: p.velocity_30d > 20 ? 'best_seller' : p.velocity_30d > 8 ? 'trending' : p.price > 150 ? 'high_value' : 'standard',
      why: p.velocity_30d > 15 ? 'Top seller with proven demand — high ROI potential' :
           p.price > 150 ? 'Premium price point — good margin for ad spend' :
           p.inventory > 50 ? 'High inventory — ideal to push sales volume' :
           'Good balance of price, availability, and ad readiness',
    })),
    total_products: MOCK_SHOPIFY_PRODUCTS.length,
    source: 'shopping_feeds_catalog',
  };
}

function buildInsight(p: { salesVelocity: number | null; revenueL30d: unknown; inventoryQty: number | null }): string {
  const velocity = p.salesVelocity ?? 0;
  const revenue = parseFloat(String(p.revenueL30d ?? '0'));
  if (velocity > 10) return `Selling ~${velocity.toFixed(0)} units/month — a proven top seller.`;
  if (revenue > 500) return `Generated $${revenue.toFixed(0)} in the last 30 days — high-value candidate.`;
  if ((p.inventoryQty ?? 999) < 5) return 'Low inventory — advertise before it sells out.';
  if (velocity > 2) return `Trending with ${velocity.toFixed(0)} units/month — good momentum to amplify.`;
  return 'Stable product with untapped advertising potential.';
}

// ── Main dispatcher ────────────────────────────────────────────────────────

export async function executeEcommerceTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  switch (name) {
    case 'get_products':
      return handleGetProducts(input as Parameters<typeof handleGetProducts>[0], ctx);
    case 'get_sales':
      return handleGetSales(input as Parameters<typeof handleGetSales>[0], ctx);
    case 'get_ecommerce_overview':
      return handleGetEcommerceOverview(input as Parameters<typeof handleGetEcommerceOverview>[0], ctx);
    case 'get_inventory_health':
      return handleGetInventoryHealth(input as Parameters<typeof handleGetInventoryHealth>[0], ctx);
    case 'get_product_insights':
      return handleGetProductInsights(input as Parameters<typeof handleGetProductInsights>[0]);
    case 'get_product_suggestions':
      return handleGetProductSuggestions(input as Parameters<typeof handleGetProductSuggestions>[0]);
    default:
      return { error: `Unknown ecommerce tool: ${name}` };
  }
}
