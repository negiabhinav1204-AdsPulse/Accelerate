import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@workspace/database/client';
import type { ToolContext } from './analytics';

// ---------------------------------------------------------------------------
// Campaign Tool Schemas
// ---------------------------------------------------------------------------

export const CAMPAIGN_TOOL_SCHEMAS: Anthropic.Tool[] = [
  {
    name: 'campaign_health_check',
    description:
      'Run a health check across all campaigns. Scores each campaign as: winner (ROAS >3), learner (spend <$100), underperformer (ROAS 1-3), or bleeder (ROAS <1). Returns prioritised recommendations.',
    input_schema: {
      type: 'object' as const,
      properties: {
        days: {
          type: 'integer',
          description: 'Look-back period in days (default 30)',
          default: 30,
        },
      },
      required: [],
    },
  },
  {
    name: 'campaign_optimizer',
    description:
      'Analyse all campaigns and return specific optimisation actions: pause bleeders, scale winners, adjust budgets, improve creatives.',
    input_schema: {
      type: 'object' as const,
      properties: {
        days: {
          type: 'integer',
          description: 'Look-back period in days (default 30)',
          default: 30,
        },
      },
      required: [],
    },
  },
  {
    name: 'toggle_campaign',
    description:
      'Pause or activate a campaign. Pass the campaign ID and the desired action.',
    input_schema: {
      type: 'object' as const,
      properties: {
        campaign_id: {
          type: 'string',
          description: 'Campaign ID to toggle',
        },
        action: {
          type: 'string',
          enum: ['pause', 'activate'],
          description: 'pause or activate',
        },
      },
      required: ['campaign_id', 'action'],
    },
  },
  {
    name: 'update_budget',
    description:
      'Update the daily budget for a campaign. Use daily_budget (absolute new value) OR scale_percent (relative increase, e.g. 25 = +25%).',
    input_schema: {
      type: 'object' as const,
      properties: {
        campaign_id: {
          type: 'string',
          description: 'Campaign ID',
        },
        daily_budget: {
          type: 'number',
          description: 'New daily budget in the org currency (e.g. 50 = $50). Use this OR scale_percent.',
        },
        scale_percent: {
          type: 'number',
          description: 'Increase budget by this percentage (e.g. 25 = +25%). Use this OR daily_budget.',
        },
      },
      required: ['campaign_id'],
    },
  },
  {
    name: 'get_campaign_history',
    description:
      'Get a list of all campaigns with their budgets, status, platforms, and health scores.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          description: 'Filter by status: active, paused, draft, all (default all)',
          default: 'all',
        },
        limit: {
          type: 'integer',
          description: 'Max campaigns to return (default 20)',
          default: 20,
        },
      },
      required: [],
    },
  },
];

export const CAMPAIGN_TOOL_NAMES = new Set(CAMPAIGN_TOOL_SCHEMAS.map((t) => t.name));

// ---------------------------------------------------------------------------
// Thresholds (from expansion plan / campaign_health.py)
// ---------------------------------------------------------------------------

type HealthCategory = 'winner' | 'learner' | 'underperformer' | 'bleeder' | 'paused';

function classifyHealth(roas: number, spend: number, status: string): HealthCategory {
  if (status === 'paused' || status === 'PAUSED') return 'paused';
  if (spend < 100) return 'learner';
  if (roas >= 3) return 'winner';
  if (roas >= 1) return 'underperformer';
  return 'bleeder';
}

function healthRecommendation(category: HealthCategory, campaignName: string): string {
  switch (category) {
    case 'winner':       return `Scale ${campaignName} — increase budget by 20-30%`;
    case 'learner':      return `Give ${campaignName} more time — insufficient spend data (<$100)`;
    case 'underperformer': return `Optimise ${campaignName} — improve creative or audience targeting`;
    case 'bleeder':      return `Pause ${campaignName} immediately — ROAS below 1x, actively losing money`;
    case 'paused':       return `${campaignName} is paused — review before reactivating`;
  }
}

// ---------------------------------------------------------------------------
// Tool handlers
// ---------------------------------------------------------------------------

async function handleCampaignHealthCheck(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  const days = (input.days as number) ?? 30;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const campaigns = await prisma.campaign.findMany({
    where: { organizationId: ctx.orgId, archivedAt: null },
    include: {
      platformCampaigns: { select: { platform: true, budget: true, status: true } },
      healthScores: {
        where: { date: { gte: since } },
        orderBy: { date: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const results: {
    id: string;
    name: string;
    platform: string;
    status: string;
    budget: string;
    spend: string;
    roas: number;
    category: HealthCategory;
    score: number;
    recommendation: string;
  }[] = [];

  for (const c of campaigns) {
    const platform = c.platformCampaigns[0]?.platform ?? 'unknown';
    const pcStatus = c.platformCampaigns[0]?.status ?? 'draft';
    const budget = parseFloat((c.platformCampaigns[0]?.budget ?? c.totalBudget).toString());
    const hs = c.healthScores[0];

    const spend = hs ? parseFloat(hs.spend.toString()) : 0;
    const roas = hs?.roas ? parseFloat(hs.roas.toString()) : 0;
    const score = hs?.score ?? 0;
    const category = hs?.category
      ? (hs.category.toLowerCase() as HealthCategory)
      : classifyHealth(roas, spend, pcStatus);

    results.push({
      id: c.id,
      name: c.name,
      platform,
      status: pcStatus,
      budget: budget.toFixed(2),
      spend: spend.toFixed(2),
      roas,
      category,
      score,
      recommendation: healthRecommendation(category, c.name),
    });
  }

  const summary = {
    total: results.length,
    winners: results.filter((r) => r.category === 'winner').length,
    bleeders: results.filter((r) => r.category === 'bleeder').length,
    underperformers: results.filter((r) => r.category === 'underperformer').length,
    learners: results.filter((r) => r.category === 'learner').length,
    paused: results.filter((r) => r.category === 'paused').length,
  };

  return {
    period: `${days}d`,
    currency: ctx.currency,
    summary,
    campaigns: results,
  };
}

async function handleCampaignOptimizer(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  const health = (await handleCampaignHealthCheck(input, ctx)) as {
    campaigns: { id: string; name: string; category: HealthCategory; recommendation: string; roas: number; spend: string }[];
    summary: Record<string, number>;
  };

  const actions = health.campaigns
    .filter((c) => c.category !== 'paused')
    .map((c) => ({
      priority: c.category === 'bleeder' ? 'high' : c.category === 'winner' ? 'medium' : 'low',
      action: c.category === 'bleeder' ? 'pause' : c.category === 'winner' ? 'scale' : 'optimise',
      campaign_id: c.id,
      campaign_name: c.name,
      recommendation: c.recommendation,
      roas: c.roas,
      spend: c.spend,
    }))
    .sort((a, b) => (a.priority === 'high' ? -1 : b.priority === 'high' ? 1 : 0));

  return {
    summary: health.summary,
    actions,
    top_priority: actions[0] ?? null,
  };
}

async function handleToggleCampaign(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  const { campaign_id, action } = input as { campaign_id: string; action: 'pause' | 'activate' };

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaign_id, organizationId: ctx.orgId },
    select: { id: true, name: true },
  });

  if (!campaign) return { error: 'Campaign not found' };

  const newStatus = action === 'pause' ? 'paused' : 'active';

  await prisma.platformCampaign.updateMany({
    where: { campaignId: campaign_id },
    data: { status: newStatus },
  });

  return {
    success: true,
    campaign_id,
    campaign_name: campaign.name,
    new_status: newStatus,
    message: `Campaign "${campaign.name}" has been ${newStatus}.`,
  };
}

async function handleUpdateBudget(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  const { campaign_id, daily_budget, scale_percent } = input as {
    campaign_id: string;
    daily_budget?: number;
    scale_percent?: number;
  };

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaign_id, organizationId: ctx.orgId },
    include: { platformCampaigns: { select: { id: true, budget: true } } },
  });

  if (!campaign) return { error: 'Campaign not found' };

  const currentBudget = parseFloat(
    (campaign.platformCampaigns[0]?.budget ?? campaign.totalBudget).toString()
  );

  let newBudget: number;
  if (daily_budget != null) {
    newBudget = daily_budget;
  } else if (scale_percent != null) {
    newBudget = currentBudget * (1 + scale_percent / 100);
  } else {
    return { error: 'Provide daily_budget or scale_percent' };
  }

  newBudget = Math.round(newBudget * 100) / 100;

  await prisma.platformCampaign.updateMany({
    where: { campaignId: campaign_id },
    data: { budget: newBudget },
  });

  await prisma.campaign.update({
    where: { id: campaign_id },
    data: { totalBudget: newBudget },
  });

  return {
    success: true,
    campaign_id,
    campaign_name: campaign.name,
    previous_budget: currentBudget.toFixed(2),
    new_budget: newBudget.toFixed(2),
    currency: ctx.currency,
    change_pct: currentBudget > 0 ? (((newBudget - currentBudget) / currentBudget) * 100).toFixed(1) : '0',
  };
}

async function handleGetCampaignHistory(
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  const status = (input.status as string) ?? 'all';
  const limit = (input.limit as number) ?? 20;

  const campaigns = await prisma.campaign.findMany({
    where: {
      organizationId: ctx.orgId,
      archivedAt: null,
    },
    include: {
      platformCampaigns: { select: { platform: true, budget: true, status: true } },
      healthScores: {
        orderBy: { date: 'desc' },
        take: 1,
        select: { category: true, score: true, roas: true, spend: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  const rows = campaigns
    .map((c) => {
      const pc = c.platformCampaigns[0];
      const hs = c.healthScores[0];
      const pcStatus = pc?.status ?? 'draft';
      return {
        id: c.id,
        name: c.name,
        objective: c.objective,
        platform: pc?.platform ?? 'unknown',
        status: pcStatus,
        budget: parseFloat((pc?.budget ?? c.totalBudget).toString()).toFixed(2),
        currency: c.currency,
        health_category: hs?.category ?? null,
        health_score: hs?.score ?? null,
        roas: hs?.roas ? parseFloat(hs.roas.toString()) : null,
        created_at: c.createdAt.toISOString().slice(0, 10),
      };
    })
    .filter((c) => status === 'all' || c.status === status);

  return {
    total: rows.length,
    campaigns: rows,
  };
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

export async function executeCampaignTool(
  name: string,
  input: Record<string, unknown>,
  ctx: ToolContext
): Promise<unknown> {
  switch (name) {
    case 'campaign_health_check': return handleCampaignHealthCheck(input, ctx);
    case 'campaign_optimizer':    return handleCampaignOptimizer(input, ctx);
    case 'toggle_campaign':       return handleToggleCampaign(input, ctx);
    case 'update_budget':         return handleUpdateBudget(input, ctx);
    case 'get_campaign_history':  return handleGetCampaignHistory(input, ctx);
    default:
      throw new Error(`Unknown campaign tool: ${name}`);
  }
}
