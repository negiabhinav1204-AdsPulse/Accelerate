import Anthropic from '@anthropic-ai/sdk';
import { NextRequest } from 'next/server';

import { auth } from '@workspace/auth';
import { prisma } from '@workspace/database/client';

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

function buildSystemPrompt(ctx: {
  userName: string;
  orgName: string;
  connectedPlatforms: string[];
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

## Your Role
Help users with:
- Planning and creating advertising campaigns across Google, Meta, Microsoft Advertising, and other platforms
- Analysing ad account performance and metrics
- Optimising budgets, bids, and targeting
- Understanding campaign reports and insights
- Navigating the Accelerate platform

You have deep knowledge of digital advertising — Google Ads, Meta Ads (Facebook/Instagram), Microsoft Advertising, campaign structures, targeting options, bidding strategies, creatives, conversion tracking, and performance metrics.

## Generative UI Tools
You have access to special UI rendering tools. Use them to show rich data visually:
- Use \`show_metrics\` to display KPI cards when discussing performance numbers
- Use \`show_campaigns\` to display a campaign table when listing campaigns
- Use \`show_chart\` to display a performance chart when showing trends over time
- Use \`navigate_to\` to suggest a platform navigation link when the user should go somewhere in the app
- Use \`connect_accounts_prompt\` when the user asks to analyse/optimise/create campaigns but no ad accounts are connected

## Rules
- Always be helpful, concise, and actionable. Use simple language suitable for SMB marketers.
- When using tools, also include a brief text explanation alongside the tool call.
- If asked about topics unrelated to advertising, marketing, or the Accelerate platform, politely redirect.
- Format text responses in markdown when it helps readability.
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
  }
];

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

  const systemPrompt = buildSystemPrompt({ userName, orgName, connectedPlatforms });

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
        const anthropicMessages: Anthropic.MessageParam[] = body.messages.map(
          (m) => ({ role: m.role, content: m.content })
        );

        const anthropicStream = client.messages.stream({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2048,
          system: systemPrompt,
          tools: TOOLS,
          messages: anthropicMessages
        });

        const toolInputBuffers: Record<string, string> = {};
        const toolNames: Record<string, string> = {};

        for await (const event of anthropicStream) {
          if (event.type === 'content_block_start') {
            if (event.content_block.type === 'tool_use') {
              toolInputBuffers[event.index] = '';
              toolNames[event.index] = event.content_block.name;
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
            const rawInput = toolInputBuffers[event.index];
            if (name && rawInput !== undefined) {
              try {
                const toolInput = JSON.parse(rawInput) as unknown;
                assistantTools.push({ name, input: toolInput });
                enqueue({ type: 'tool', name, input: toolInput });
              } catch {
                // ignore malformed tool input
              }
            }
          }
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
