/**
 * Internal tools endpoint — called by the agentic service to proxy Accelerate data tools.
 *
 * POST /api/internal/tools
 * Header: x-internal-api-key: <INTERNAL_API_KEY>
 * Body: { tool_name: string, args: Record<string, unknown>, org_id: string, user_id: string }
 *
 * Returns { result: unknown } on success or { error: string } on failure.
 *
 * Exposes all 38 data tools (no show_* generative UI tools).
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@workspace/database/client';

import {
  executeEcommerceTool,
  ECOMMERCE_TOOL_NAMES,
  type ToolContext,
} from '../../chat/tools/ecommerce';
import {
  executeAnalyticsTool,
  ANALYTICS_TOOL_NAMES,
} from '../../chat/tools/analytics';
import {
  executeCampaignTool,
  CAMPAIGN_TOOL_NAMES,
} from '../../chat/tools/campaigns';
import {
  executeAudienceTool,
  AUDIENCE_TOOL_NAMES,
} from '../../chat/tools/audiences';
import {
  executePlatformTool,
  PLATFORM_TOOL_NAMES,
} from '../../chat/tools/platform';

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

function isAuthorised(req: NextRequest): boolean {
  const key = req.headers.get('x-internal-api-key');
  return Boolean(key && key === process.env.INTERNAL_API_KEY);
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!isAuthorised(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: {
    tool_name: string;
    args: Record<string, unknown>;
    org_id: string;
    user_id: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { tool_name, args = {}, org_id, user_id } = body;

  if (!tool_name || typeof tool_name !== 'string') {
    return NextResponse.json({ error: 'tool_name is required' }, { status: 400 });
  }
  if (!org_id || typeof org_id !== 'string') {
    return NextResponse.json({ error: 'org_id is required' }, { status: 400 });
  }

  // Resolve org currency (best-effort; fall back to USD)
  let currency = 'USD';
  try {
    const org = await prisma.organization.findUnique({
      where: { id: org_id },
      select: { currency: true },
    });
    if (org?.currency) currency = org.currency;
  } catch {
    // Non-fatal — proceed with default currency
  }

  const ctx: ToolContext = { orgId: org_id, currency };

  try {
    let result: unknown;

    if (ECOMMERCE_TOOL_NAMES.has(tool_name)) {
      result = await executeEcommerceTool(tool_name, args, ctx);
    } else if (ANALYTICS_TOOL_NAMES.has(tool_name)) {
      result = await executeAnalyticsTool(tool_name, args, ctx);
    } else if (CAMPAIGN_TOOL_NAMES.has(tool_name)) {
      result = await executeCampaignTool(tool_name, args, ctx);
    } else if (AUDIENCE_TOOL_NAMES.has(tool_name)) {
      result = await executeAudienceTool(tool_name, args, ctx);
    } else if (PLATFORM_TOOL_NAMES.has(tool_name)) {
      result = await executePlatformTool(tool_name, args, ctx);
    } else {
      return NextResponse.json(
        { error: `Unknown tool: ${tool_name}` },
        { status: 400 },
      );
    }

    return NextResponse.json({ result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[internal/tools] tool=${tool_name} org=${org_id} error=${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
