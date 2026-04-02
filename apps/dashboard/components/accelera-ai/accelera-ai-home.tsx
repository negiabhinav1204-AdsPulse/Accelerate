'use client';

import * as React from 'react';
import {
  BarChart3Icon,
  ImageIcon,
  PaperclipIcon,
  SendIcon,
  SparklesIcon,
  TrendingUpIcon,
  XIcon,
  ZapIcon
} from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { cn } from '@workspace/ui/lib/utils';

import { AgentProgressPanel } from '../campaign/agent-progress-panel';
import { CampaignEditPanel } from '../campaign/campaign-edit-panel';
import { CampaignPreviewPanel } from '../campaign/campaign-preview-panel';
import type { EditScope } from '../campaign/campaign-preview-panel';
import type { AgentName, AgentState, MediaPlan, SSEEvent } from '../campaign/types';
import { resolveBlockType } from './block-registry';
import { HITLCard } from './HITLCard';
import type { HITLDecision } from './HITLCard';
import { ModalPanel } from './ModalPanel';
import { PanelProvider, usePanel } from './PanelContext';
import { SidebarPanel } from './SidebarPanel';
import { WorkflowProgressBlock } from './WorkflowProgressBlock';
import { ChatAudienceCard } from './chat-audience-card';
import { ChatAutoSetupCard } from './chat-auto-setup-card';
import { ChatCampaignTable } from './chat-campaign-table';
import { ChatConnectPrompt } from './chat-connect-prompt';
import { ChatDemographicsCard } from './chat-demographics-card';
import { ChatExecutiveSummaryCard } from './chat-executive-summary-card';
import { ChatFeedHealthCard } from './chat-feed-health-card';
import { ChatFunnelChartCard } from './chat-funnel-chart-card';
import { ChatHealthScoreCard } from './chat-health-score-card';
import { ChatInventoryCard } from './chat-inventory-card';
import { ChatMetricCard } from './chat-metric-card';
import { ChatNavSuggestion } from './chat-nav-suggestion';
import { ChatPerformanceChart } from './chat-performance-chart';
import { ChatPlacementsCard } from './chat-placements-card';
import { ChatPlatformComparisonCard } from './chat-platform-comparison-card';
import { ChatProductLeaderboard } from './chat-product-leaderboard';
import { ChatRevenueBreakdownCard } from './chat-revenue-breakdown-card';
import { ChatStrategyCard } from './chat-strategy-card';
import { ChatWastedSpendCard } from './chat-wasted-spend-card';
import { JsonRenderBlock } from './json-render-block';
import { AgenticSidebarPanel } from './AgenticSidebarPanel';

// ── Constants ─────────────────────────────────────────────────────────────────

const INITIAL_AGENTS: AgentState[] = [
  { name: 'brand', label: 'Brand Analysis Agent', icon: '🎨', status: 'idle', currentMessage: 'Waiting to start...', expanded: false },
  { name: 'lpu', label: 'Landing Page Agent', icon: '📄', status: 'idle', currentMessage: 'Waiting to start...', expanded: false },
  { name: 'intent', label: 'Intent Analysis Agent', icon: '🎯', status: 'idle', currentMessage: 'Waiting to start...', expanded: false },
  { name: 'trend', label: 'Trend Analysis Agent', icon: '📈', status: 'idle', currentMessage: 'Waiting to start...', expanded: false },
  { name: 'competitor', label: 'Competitor Analysis Agent', icon: '🔍', status: 'idle', currentMessage: 'Waiting to start...', expanded: false },
  { name: 'creative', label: 'Creative Agent', icon: '✨', status: 'idle', currentMessage: 'Waiting to start...', expanded: false },
  { name: 'budget', label: 'Budget Agent', icon: '💰', status: 'idle', currentMessage: 'Waiting to start...', expanded: false },
  { name: 'strategy', label: 'Strategy Agent', icon: '🚀', status: 'idle', currentMessage: 'Waiting to start...', expanded: false }
];

const URL_REGEX = /https?:\/\/[^\s]+/;

// ── Types ────────────────────────────────────────────────────────────────────

type CampaignMessageData = {
  id: string;
  role: 'campaign';
  url: string;
  agents: AgentState[];
  mediaPlan: MediaPlan | null;
  done: boolean;
};

type ToolBlock =
  | { name: 'show_metrics'; input: { title: string; metrics: { label: string; value: string; change?: string; trend?: 'up' | 'down' | 'neutral' }[] } }
  | { name: 'show_campaigns'; input: { title: string; campaigns: { name: string; status: 'active' | 'paused' | 'ended'; budget?: string; spend?: string; impressions?: string; clicks?: string; ctr?: string; conversions?: string }[] } }
  | { name: 'show_chart'; input: { title: string; metric: string; data: { date: string; value: number }[] } }
  | { name: 'navigate_to'; input: { label: string; description: string; path: 'create-campaign' | 'campaigns' | 'reporting' | 'connectors' | 'settings' | 'accelera-ai' } }
  | { name: 'connect_accounts_prompt'; input: { message: string } }
  | { name: 'show_products'; input: { title: string; products: { title: string; price?: string; sold_30d?: number; revenue_30d?: string; inventory?: number; badge?: string; insight?: string }[] } }
  | { name: 'show_inventory'; input: { title: string; summary: { total_products: number; out_of_stock: number; low_stock: number; at_risk_revenue?: string }; items: { title: string; inventory: number; days_until_stockout?: number | null; weekly_velocity?: number; status: 'out_of_stock' | 'critical' | 'low' | 'ok' }[] } }
  | { name: 'show_health_scores'; input: { period?: string; currency?: string; summary: { total: number; winners: number; bleeders: number; underperformers: number; learners: number; paused: number }; campaigns: { id: string; name: string; platform?: string; status?: string; budget?: string; spend?: string; roas?: number; category: 'winner' | 'learner' | 'underperformer' | 'bleeder' | 'paused'; score?: number; recommendation: string }[] } }
  | { name: 'show_executive_summary'; input: { period?: string; currency?: string; blended_roas: string; mer?: string; total_spend: string; total_revenue: string; total_orders?: number; total_impressions?: number; total_clicks?: number; total_conversions?: number; spend_change_pct?: string; revenue_change_pct?: string; top_platform?: string } }
  | { name: 'show_funnel'; input: { period?: string; stages: { stage: string; count: number; drop_off_pct?: string | null }[]; overall_conversion_rate?: string; biggest_opportunity?: string | null; note?: string } }
  | { name: 'show_revenue_breakdown'; input: { period?: string; currency?: string; total_revenue: string; ad_attributed: string; organic: string; ad_share_pct?: string; organic_share_pct?: string; by_platform?: { platform: string; attributed_revenue: number; spend: number }[] } }
  | { name: 'show_wasted_spend'; input: { period?: string; currency?: string; total_wasted: string; items_count: number; items: { platform: string; campaign: string; spend: number; conversions: number; roas: number; recommendation: string }[]; summary: string } }
  | { name: 'show_platform_comparison'; input: { period?: string; currency?: string; platforms: { platform: string; spend: string; impressions?: number; clicks?: number; ctr?: string; cpc?: string; conversions?: number; roas?: string; cpa?: string }[] } }
  | { name: 'show_audience'; input: { total: number; audiences: { id: string; name: string; type: string; platforms?: string[]; estimated_size?: number | null; sync_status?: string; created_at?: string }[] } }
  | { name: 'show_feed_health'; input: { total: number; message?: string; feeds: { id: string; name: string; channel: string; connector?: string; health_score?: number | null; last_pushed_at?: string | null; active_rules?: number; health_label: string }[] } }
  | { name: 'show_strategy'; input: { title?: string; total_campaigns: number; total_daily_budget: string; total_monthly_estimate: string; currency?: string; campaigns: { segment: string; label: string; strategy: string; product_count: number; revenue_60d?: number; suggested_budget_daily: string; priority: 'high' | 'medium' | 'low'; campaign_type?: string; top_products?: { title: string; revenue?: number }[] }[] } }
  | { name: 'show_demographics'; input: { period?: string; currency?: string; best_roas_segment?: string; highest_spend_segment?: string; note?: string; data: { age_range: string; spend: number; revenue: number; conversions: number; roas: number; cpa: number; currency: string }[] } }
  | { name: 'show_placements'; input: { period?: string; currency?: string; best_placement?: string; note?: string; data: { publisher: string; placement: string; spend: number; revenue: number; conversions: number; roas: number; cpa: number; currency: string }[] } }
  | { name: 'show_auto_setup'; input: { products_configured: number; total_daily_budget: string; total_monthly_estimate: string; message?: string; next_step?: string; results: { title: string; badge: string; suggested_strategy: string; suggested_platforms: string[]; daily_budget: string; monthly_estimate: string; status: string }[] } }
  | { name: 'json_render_spec'; input: Record<string, unknown> }
  // Phase 2 — agentic workflow blocks
  | { name: 'workflow_progress'; input: Record<string, unknown> }
  | { name: 'hitl_request'; input: Record<string, unknown> }
  | { name: 'generated_image'; input: { url: string; alt?: string } }
  | { name: 'campaign_overview'; input: Record<string, unknown> }
  | { name: 'media_plan'; input: Record<string, unknown> }
  | { name: 'campaign_details'; input: Record<string, unknown> }
  | { name: 'budget_approval'; input: Record<string, unknown> };

type HITLFormPart = {
  type: 'hitl';
  step_id: string;
  fields: { name: string; label: string; type: string; default?: unknown; options?: string[] }[];
  actions: { action: string; label: string; style?: string }[];
  title?: string;
};

type WorkflowProgressPart = {
  type: 'workflow_progress';
  data: unknown;
};

type HITLRequestPart = {
  type: 'hitl_request';
  data: Record<string, unknown>;
};

type GeneratedImagePart = {
  type: 'generated_image';
  url: string;
  alt?: string;
};

type MessagePart =
  | { type: 'text'; text: string }
  | { type: 'tool'; tool: ToolBlock }
  | HITLFormPart
  | WorkflowProgressPart
  | HITLRequestPart
  | GeneratedImagePart;

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  parts: MessagePart[];
  streaming?: boolean;
};

type Message = ChatMessage | CampaignMessageData;

type QuickAction = {
  id: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  prompt: string;
};

// ── Constants ─────────────────────────────────────────────────────────────────

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: 'create-campaign',
    label: 'Create a campaign',
    icon: <ZapIcon className="size-5" />,
    description: 'Launch a new ad campaign across platforms',
    prompt: 'I want to create a new ad campaign. Help me get started.'
  },
  {
    id: 'analyse',
    label: 'Analyse my Ad Account',
    icon: <BarChart3Icon className="size-5" />,
    description: 'Get AI-powered insights on your performance',
    prompt:
      'Analyse my ad account performance and give me key insights and recommendations.'
  },
  {
    id: 'optimise',
    label: 'Optimise my campaigns',
    icon: <TrendingUpIcon className="size-5" />,
    description: 'Let Accelera find opportunities to improve',
    prompt:
      'Look at my campaigns and suggest specific optimisations to improve performance and reduce wasted spend.'
  }
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Merge incoming mediaPlan onto existing, preserving imageUrls that
 * image_update events already placed in state (media_plan event strips
 * images to keep Redis payload small).
 */
function mergeMediaPlan(existing: MediaPlan | undefined, incoming: MediaPlan): MediaPlan {
  if (!existing) return incoming;
  return {
    ...incoming,
    platforms: incoming.platforms.map((p) => {
      const prev = existing.platforms.find((ep) => ep.platform === p.platform);
      if (!prev) return p;
      return {
        ...p,
        adTypes: p.adTypes.map((at) => {
          const prevAt = prev.adTypes.find((a) => a.adType === at.adType);
          if (!prevAt) return at;
          return {
            ...at,
            ads: at.ads.map((ad, i) => ({
              ...ad,
              imageUrls: ad.imageUrls.length > 0 ? ad.imageUrls : (prevAt.ads[i]?.imageUrls ?? [])
            }))
          };
        })
      };
    })
  };
}

/** Reconstruct MessagePart[] from a persisted DB row */
function buildPartsFromPersistedMessage(content: string, toolData: unknown): MessagePart[] {
  const parts: MessagePart[] = [];
  if (content) {
    parts.push({ type: 'text', text: content });
  }
  if (Array.isArray(toolData)) {
    for (const tool of toolData as { name: string; input: unknown }[]) {
      parts.push({ type: 'tool', tool: tool as ToolBlock });
    }
  }
  return parts;
}

/** Check if a persisted DB message is a saved campaign result */
function isCampaignResultMessage(toolData: unknown): toolData is { type: 'campaign_result'; url: string; mediaPlan: MediaPlan } {
  return (
    typeof toolData === 'object' &&
    toolData !== null &&
    !Array.isArray(toolData) &&
    (toolData as Record<string, unknown>)['type'] === 'campaign_result'
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

export type ConnectedAccount = {
  id: string;
  platform: string;
  accountName: string;
};

type AcceleraAiHomeProps = {
  firstName: string;
  organizationId: string;
  orgSlug: string;
  connectedAccounts: ConnectedAccount[];
  orgCurrency?: string;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function AcceleraAiHome(props: AcceleraAiHomeProps): React.JSX.Element {
  return (
    <PanelProvider>
      <SidebarPanel />
      <ModalPanel />
      <AcceleraAiHomeInner {...props} />
    </PanelProvider>
  );
}

function AcceleraAiHomeInner({
  firstName,
  organizationId,
  orgSlug,
  connectedAccounts,
  orgCurrency
}: AcceleraAiHomeProps): React.JSX.Element {
  const { openSidebar, openModal, closePanel, closeModal } = usePanel();
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [historyLoading, setHistoryLoading] = React.useState(true);
  const [sessionId, setSessionId] = React.useState<string | null>(null);
  const [attachments, setAttachments] = React.useState<{ name: string; url: string; type: 'image' | 'video' }[]>([]);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  const campaignAbortRef = React.useRef<AbortController | null>(null);
  // Ref to always have latest sessionId in stale closures
  const sessionIdRef = React.useRef<string | null>(null);
  // Tracks partial text from the last interrupted response so the next message can resume it
  const interruptedContextRef = React.useRef<string | null>(null);

  const [activeCampaign, setActiveCampaign] = React.useState<{
    agents: AgentState[];
    mediaPlan: MediaPlan | null;
    phase: 'analyzing' | 'preview' | 'editing';
    editScope: EditScope | null;
    campaignId?: string;
  } | null>(null);
  const [publishing, setPublishing] = React.useState(false);

  // Keep sessionIdRef in sync so stale closures always see the latest value
  React.useEffect(() => { sessionIdRef.current = sessionId; }, [sessionId]);

  /**
   * Handle HITL decisions from HITLCard.
   * Submits the decision to the agentic service via the main /api/chat endpoint
   * and starts streaming the resumed workflow response.
   */
  const handleHITLAction = React.useCallback((decision: HITLDecision) => {
    const currentSessionId = sessionIdRef.current;
    if (!currentSessionId) {
      console.warn('[HITL] No session ID — cannot submit decision');
      return;
    }

    // Find the message that owns this hitl_request and reuse it so the resumed
    // workflow updates the SAME card instead of spawning a duplicate.
    let targetMsgId: string | null = null;
    const isRejection = decision.action === 'cancel' || decision.action === 'reject';

    setMessages((prev) => {
      for (const m of prev) {
        if (m.role === 'campaign') continue;
        const cm = m as ChatMessage;
        for (const p of cm.parts) {
          if (p.type === 'hitl_request' && (p.data as Record<string, unknown>)['hitl_id'] === decision.hitl_id) {
            targetMsgId = cm.id;
            break;
          }
        }
        if (targetMsgId) break;
      }

      if (!targetMsgId) {
        // Fallback: create new message if we can't find the originating one
        targetMsgId = crypto.randomUUID();
        return [...prev, { id: targetMsgId, role: 'assistant' as const, parts: [], streaming: true } as ChatMessage];
      }

      // Mark hitl_request resolved (so HITLCard returns null) and set streaming
      return prev.map((m) => {
        if (m.id !== targetMsgId || m.role === 'campaign') return m;
        const cm = m as ChatMessage;
        return {
          ...cm,
          streaming: true,
          parts: cm.parts.map((p) => {
            if (p.type === 'hitl_request') {
              const d = p.data as Record<string, unknown>;
              if (d['hitl_id'] === decision.hitl_id) {
                return { type: 'hitl_request' as const, data: { ...d, status: isRejection ? 'rejected' : 'approved' } } as HITLRequestPart;
              }
            }
            return p;
          }),
        };
      });
    });

    const assistantId = targetMsgId!;
    setLoading(true);

    void (async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [],
            organizationId,
            sessionId: currentSessionId,
            hitlResponse: decision,
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error('Failed to resume workflow after HITL decision');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const chunk = JSON.parse(line) as
                | { type: 'text'; text: string }
                | { type: 'tool'; name: string; input: unknown }
                | { type: 'error'; message: string }
                | { type: string };

              if (chunk.type === 'text') {
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id !== assistantId || m.role === 'campaign') return m;
                    const cm = m as ChatMessage;
                    const parts = [...cm.parts];
                    const lastPart = parts[parts.length - 1];
                    if (lastPart?.type === 'text') {
                      parts[parts.length - 1] = { type: 'text', text: lastPart.text + (chunk as { type: 'text'; text: string }).text };
                    } else {
                      parts.push({ type: 'text', text: (chunk as { type: 'text'; text: string }).text });
                    }
                    return { ...cm, parts };
                  })
                );
              } else if (chunk.type === 'tool') {
                const c = chunk as { type: 'tool'; name: string; input: unknown };
                const resolvedName = resolveBlockType(c.name);
                if (resolvedName === 'workflow_progress') {
                  setMessages((prev) =>
                    prev.map((m) => {
                      if (m.id !== assistantId || m.role === 'campaign') return m;
                      const cm = m as ChatMessage;
                      const filtered = cm.parts.filter((p) => p.type !== 'workflow_progress');
                      return { ...cm, parts: [...filtered, { type: 'workflow_progress' as const, data: c.input } as WorkflowProgressPart] };
                    })
                  );
                } else if (resolvedName === 'hitl_request') {
                  setMessages((prev) =>
                    prev.map((m) => {
                      if (m.id !== assistantId || m.role === 'campaign') return m;
                      const cm = m as ChatMessage;
                      return { ...cm, parts: [...cm.parts, { type: 'hitl_request' as const, data: c.input as Record<string, unknown> } as HITLRequestPart] };
                    })
                  );
                } else {
                  const blockValue = c.input as Record<string, unknown>;
                  const agMeta = (blockValue.__agui_meta ?? {}) as Record<string, unknown>;
                  const display = agMeta.display as string | undefined;
                  const inlineTrigger = (agMeta.inline_trigger ?? blockValue) as Record<string, unknown>;
                  const { __agui_meta: _meta, ...blockData } = blockValue;
                  if (display === 'sidebar') {
                    openSidebar(<AgenticSidebarPanel blockType={resolvedName} data={blockData} onClose={closePanel} />);
                  } else if (display === 'modal') {
                    openModal(<AgenticSidebarPanel blockType={resolvedName} data={blockData} onClose={closeModal} />);
                  }
                  setMessages((prev) =>
                    prev.map((m) => {
                      if (m.id !== assistantId || m.role === 'campaign') return m;
                      const cm = m as ChatMessage;
                      return { ...cm, parts: [...cm.parts, { type: 'tool' as const, tool: { name: resolvedName, input: display === 'sidebar' || display === 'modal' ? { ...inlineTrigger, __display: display } : blockData } as ToolBlock }] };
                    })
                  );
                }
              } else if (chunk.type === 'error') {
                throw new Error((chunk as { type: 'error'; message: string }).message);
              }
            } catch {
              // skip malformed lines
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== assistantId || m.role === 'campaign') return m;
              return { ...(m as ChatMessage), parts: [...(m as ChatMessage).parts, { type: 'text', text: '\n\n_Something went wrong. Please try again._' }], streaming: false };
            })
          );
        }
      } finally {
        setMessages((prev) =>
          prev.map((m) => m.id === assistantId && m.role !== 'campaign' ? { ...(m as ChatMessage), streaming: false } : m)
        );
        setLoading(false);
        abortRef.current = null;
        inputRef.current?.focus();
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  // Load conversation history on mount.
  // If the agentic service is enabled, try to resume the latest agentic conversation.
  // Otherwise fall back to the legacy DB session system.
  React.useEffect(() => {
    void (async () => {
      try {
        // ── Agentic service path ───────────────────────────────────────────────
        // Try to load from agentic service first. We probe by calling the
        // conversation proxy; if it returns null or fails, fall through to legacy.
        let agenticConvId: string | null = null;
        try {
          const latestRes = await fetch(
            `/api/chat/conversation?latest=true&organizationId=${organizationId}`
          );
          if (latestRes.ok) {
            const latestData = (await latestRes.json()) as { conversation_id: string | null };
            agenticConvId = latestData.conversation_id ?? null;
          }
        } catch {
          // agentic service unreachable — fall through to legacy
        }

        if (agenticConvId) {
          // We have an agentic conversation — set session ID for future messages
          setSessionId(agenticConvId);

          // Try to load agentic message history; if it has content, use it and stop
          try {
            const msgsRes = await fetch(
              `/api/chat/messages?conv_id=${agenticConvId}&organizationId=${organizationId}`
            );
            if (msgsRes.ok) {
              const msgsData = (await msgsRes.json()) as {
                messages: Array<{
                  id: string;
                  role: 'user' | 'assistant';
                  parts: MessagePart[];
                }>;
              };
              if (msgsData.messages.length > 0) {
                setMessages(
                  msgsData.messages.map((m) => ({
                    id: m.id,
                    role: m.role,
                    parts: m.parts,
                  }) as ChatMessage)
                );
                return; // have agentic history — done
              }
            }
          } catch {
            // non-fatal — fall through to load legacy history
          }
          // Agentic conv exists but no messages yet — fall through to show legacy history
        } else {
          // No agentic conversation yet — create one so it's ready for first message.
          try {
            const createRes = await fetch('/api/chat/conversation', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ organizationId }),
            });
            if (createRes.ok) {
              const createData = (await createRes.json()) as { conversation_id: string | null };
              if (createData.conversation_id) {
                setSessionId(createData.conversation_id);
              }
            }
          } catch {
            // non-fatal
          }
          // Fall through to load legacy history for display
        }

        // ── Legacy DB session history (always load for display) ───────────────
        const res = await fetch(`/api/chat/sessions?organizationId=${organizationId}`);
        if (!res.ok) return;
        const sessions = (await res.json()) as Array<{
          id: string;
          messages: Array<{ id: string; role: string; content: string; toolData: unknown; createdAt: string }>;
        }>;

        if (sessions.length === 0) return;

        // Only use the legacy session ID if we don't already have an agentic conv.
        // If agenticConvId is set, sendMessage should use it — don't overwrite.
        if (!agenticConvId) {
          setSessionId(sessions[0]!.id);
        }

        const allMessages = sessions
          .flatMap((s) => s.messages)
          .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

        if (allMessages.length === 0) return;

        setMessages(
          allMessages.map((m): Message => {
            if (m.role === 'assistant' && isCampaignResultMessage(m.toolData)) {
              return {
                id: m.id,
                role: 'campaign',
                url: m.toolData.url,
                agents: INITIAL_AGENTS.map((a) => ({ ...a, status: 'complete' as const })),
                mediaPlan: m.toolData.mediaPlan,
                done: true
              } satisfies CampaignMessageData;
            }
            return {
              id: m.id,
              role: m.role as 'user' | 'assistant',
              parts: buildPartsFromPersistedMessage(m.content, m.toolData)
            };
          })
        );
      } catch {
        // non-fatal — start fresh
      } finally {
        setHistoryLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  // Auto-scroll to bottom on new messages
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Legacy inline campaign creation — kept behind NEXT_PUBLIC_USE_LEGACY_CAMPAIGN flag.
  // In Phase 3+ the agentic service detects URLs and runs create_media_plan automatically.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _URL_REGEX_LEGACY = URL_REGEX; // suppress unused-var warning while keeping URL_REGEX for reference

  // Inline campaign creation — triggered when user pastes a URL (legacy path only)
  const startInlineCampaign = React.useCallback(
    async (url: string, userText: string) => {
      if (process.env.NEXT_PUBLIC_USE_LEGACY_CAMPAIGN !== 'true') return;
      if (loading) return;
      setLoading(true);
      setActiveCampaign({ agents: INITIAL_AGENTS.map((a) => ({ ...a })), mediaPlan: null, phase: 'analyzing', editScope: null });

      const campaignMsgId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'user', parts: [{ type: 'text', text: userText }] } as ChatMessage,
        { id: campaignMsgId, role: 'campaign', url, agents: INITIAL_AGENTS.map((a) => ({ ...a })), mediaPlan: null, done: false } as CampaignMessageData
      ]);
      setInput('');

      const updateCampaignMsg = (updater: (prev: CampaignMessageData) => CampaignMessageData) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === campaignMsgId && m.role === 'campaign' ? updater(m as CampaignMessageData) : m))
        );
      };
      const updateAgent = (name: AgentName, update: Partial<AgentState>) => {
        updateCampaignMsg((prev) => ({
          ...prev,
          agents: prev.agents.map((a) => (a.name === name ? { ...a, ...update } : a))
        }));
        setActiveCampaign((prev) => prev ? { ...prev, agents: prev.agents.map((a) => (a.name === name ? { ...a, ...update } : a)) } : prev);
      };

      try {
        const connectedPlatforms = [
          ...new Set(connectedAccounts.map((a) => a.platform))
        ];

        // ── Submit job (returns jobId immediately) ─────────────────────────────
        const createRes = await fetch('/api/campaign/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url,
            organizationId,
            userPreferences: {
              notes: userText,
              ...(orgCurrency ? { currency: orgCurrency } : {}),
              ...(connectedPlatforms.length > 0
                ? {
                    platforms: connectedPlatforms,
                    primaryPlatform: connectedPlatforms[0]
                  }
                : {})
            }
          })
        });

        if (!createRes.ok) {
          const errData = (await createRes.json().catch(() => ({}))) as {
            message?: string;
            error?: string;
          };
          throw new Error(
            errData.message ?? errData.error ?? 'Failed to start campaign analysis'
          );
        }

        const { jobId } = (await createRes.json()) as { jobId: string };

        // ── Process event (same logic for both polling and SSE) ────────────────
        const processEvent = (event: SSEEvent): boolean => {
          // Returns true when pipeline is fully done
          switch (event.type) {
            case 'agent_start':
              updateAgent(event.agent, {
                status: 'running',
                currentMessage: event.message
              });
              break;
            case 'agent_progress':
              updateAgent(event.agent, { currentMessage: event.message });
              break;
            case 'agent_complete':
              updateAgent(event.agent, {
                status: 'complete',
                currentMessage: event.message,
                output: event.output,
                timeTaken: event.timeTaken,
                confidence: event.confidence
              });
              break;
            case 'media_plan': {
              const planWithId = event.plan as MediaPlan & {
                _campaignId?: string;
              };
              const extractedCampaignId = planWithId._campaignId;
              const cleanPlan = { ...event.plan } as MediaPlan & {
                _campaignId?: string;
              };
              delete cleanPlan._campaignId;
              updateCampaignMsg((prev) => ({
                ...prev,
                mediaPlan: mergeMediaPlan(prev.mediaPlan, cleanPlan),
                done: true
              }));
              setActiveCampaign((prev) =>
                prev
                  ? {
                      ...prev,
                      mediaPlan: mergeMediaPlan(prev.mediaPlan, cleanPlan),
                      phase: 'preview',
                      ...(extractedCampaignId
                        ? { campaignId: extractedCampaignId }
                        : {})
                    }
                  : prev
              );
              // Persist session
              void (async () => {
                try {
                  const currentSessionId = sessionIdRef.current;
                  const resp = await fetch('/api/chat/sessions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      organizationId,
                      sessionId: currentSessionId ?? undefined,
                      title: event.plan.campaignName ?? 'Campaign',
                      messages: [
                        { role: 'user', content: userText },
                        {
                          role: 'assistant',
                          content: `Campaign created: ${event.plan.campaignName}`,
                          toolData: {
                            type: 'campaign_result',
                            url,
                            mediaPlan: event.plan
                          }
                        }
                      ]
                    })
                  });
                  if (resp.ok) {
                    const data = (await resp.json()) as { sessionId: string };
                    if (!currentSessionId) setSessionId(data.sessionId);
                  }
                } catch {
                  /* non-fatal */
                }
              })();
              return true;
            }
            case 'image_update': {
              const [platformKey, adTypeKey] =
                event.platformAdTypeKey.split(':');
              const applyImageUpdate = (plan: MediaPlan): MediaPlan => ({
                ...plan,
                platforms: plan.platforms.map((p) =>
                  (p.platform as string) !== platformKey
                    ? p
                    : {
                        ...p,
                        adTypes: p.adTypes.map((at) =>
                          at.adType !== adTypeKey
                            ? at
                            : {
                                ...at,
                                ads: at.ads.map((ad, i) =>
                                  event.imageUrls[i]
                                    ? { ...ad, imageUrls: [event.imageUrls[i]!] }
                                    : ad
                                )
                              }
                        )
                      }
                )
              });
              setActiveCampaign((prev) =>
                prev?.mediaPlan
                  ? { ...prev, mediaPlan: applyImageUpdate(prev.mediaPlan) }
                  : prev
              );
              updateCampaignMsg((prev) =>
                prev.mediaPlan
                  ? { ...prev, mediaPlan: applyImageUpdate(prev.mediaPlan) }
                  : prev
              );
              break;
            }
            case 'error':
              updateCampaignMsg((prev) => ({ ...prev, done: true }));
              setActiveCampaign((prev) =>
                prev ? { ...prev, phase: 'preview' } : prev
              );
              setMessages((m) => [
                ...m,
                {
                  id: crypto.randomUUID(),
                  role: 'assistant',
                  parts: [
                    {
                      type: 'text',
                      text: `Campaign analysis failed: ${event.message}`
                    }
                  ]
                } as ChatMessage
              ]);
              return true;
          }
          return false;
        };

        // ── Poll /api/campaign/status/:jobId every 2s ─────────────────────────
        let lastEventIndex = 0;
        const POLL_MS = 2000;
        const MAX_POLLS = 200; // 400s max (well past any timeout)
        let polls = 0;

        await new Promise<void>((resolve) => {
          const interval = setInterval(async () => {
            polls++;
            if (polls > MAX_POLLS) {
              clearInterval(interval);
              updateCampaignMsg((prev) => ({ ...prev, done: true }));
              resolve();
              return;
            }

            try {
              const statusRes = await fetch(
                `/api/campaign/status/${jobId}`
              );
              if (!statusRes.ok) return;

              const job = (await statusRes.json()) as {
                status: string;
                events: SSEEvent[];
                error?: string;
              };

              // Process any new events since last poll
              const newEvents = job.events.slice(lastEventIndex);
              lastEventIndex = job.events.length;
              for (const event of newEvents) {
                processEvent(event);
              }

              // Stop polling when terminal state reached
              if (
                job.status === 'completed' ||
                job.status === 'failed' ||
                // Safety: if media_plan was already processed, we're done
                (job.status === 'completed' && lastEventIndex > 0)
              ) {
                clearInterval(interval);
                resolve();
              }
            } catch {
              // transient error — keep polling
            }
          }, POLL_MS);

          // Store interval ID so abort can clear it
          campaignAbortRef.current = {
            abort: () => {
              clearInterval(interval);
              resolve();
            }
          } as unknown as AbortController;
        });
      } catch (err) {
        const isAbort =
          (err as Error).name === 'AbortError' ||
          (err as { message?: string }).message === 'aborted';
        if (!isAbort) {
          updateCampaignMsg((prev) => ({ ...prev, done: true }));
          setMessages((m) => [
            ...m,
            {
              id: crypto.randomUUID(),
              role: 'assistant',
              parts: [
                {
                  type: 'text',
                  text: `Campaign analysis failed: ${(err as Error).message ?? 'Unknown error'}`
                }
              ]
            } as ChatMessage
          ]);
        }
      } finally {
        setLoading(false);
        campaignAbortRef.current = null;
        inputRef.current?.focus();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loading, organizationId, connectedAccounts]
  );

  const sendMessage = React.useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const userMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        parts: [{ type: 'text', text: trimmed }]
      };
      const assistantId = crypto.randomUUID();
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        parts: [],
        streaming: true
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput('');
      setLoading(true);

      // Build history for the API (text only — tools and campaign messages are not re-sent)
      const wasInterrupted = interruptedContextRef.current !== null;
      const capturedContext = interruptedContextRef.current;
      interruptedContextRef.current = null; // clear after reading

      const history = [
        ...messages.filter((m): m is ChatMessage => m.role !== 'campaign'),
        { role: 'user' as const, parts: [{ type: 'text' as const, text: trimmed }] }
      ].map((m) => ({
        role: m.role,
        // Strip the interruption marker from the history so the AI doesn't repeat it
        content: m.parts
          .filter((p) => p.type === 'text')
          .map((p) => (p as { type: 'text'; text: string }).text)
          .join('')
          .replace(/\n\n\*The process is interrupted\. Reply to continue\.\*/g, '')
          .replace(/\*The process is interrupted\. Reply to continue\.\*/g, '')
      }));

      // If the user is resuming an interrupted response, append a continuation
      // note to their message in the API payload (not shown in UI) so the AI
      // knows to pick up exactly from where it left off.
      if (wasInterrupted && history.length > 0) {
        const lastEntry = history[history.length - 1]!;
        const resumeNote = capturedContext
          ? `[Continuing an interrupted response. My previous partial answer was: "${capturedContext.slice(0, 300)}..." — please complete it based on the user's reply below]\n\n`
          : '[Continuing an interrupted response — please resume from where you left off based on the user\'s reply below]\n\n';
        history[history.length - 1] = { ...lastEntry, content: resumeNote + lastEntry.content };
      }

      try {
        const controller = new AbortController();
        abortRef.current = controller;

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: history,
            organizationId,
            sessionId
          }),
          signal: controller.signal
        });

        if (!response.ok || !response.body) {
          throw new Error('Failed to connect to Accelera AI');
        }

        // Capture session id from response header
        const respSessionId = response.headers.get('X-Session-Id');
        if (respSessionId && !sessionId) setSessionId(respSessionId);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? ''; // keep incomplete line in buffer

          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const chunk = JSON.parse(line) as
                | { type: 'text'; text: string }
                | { type: 'tool'; name: string; input: unknown }
                | { type: 'hitl'; name: string; input: unknown; step_id: string }
                | { type: 'error'; message: string }
                | { type: string };

              if (chunk.type === 'text') {
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id !== assistantId || m.role === 'campaign') return m;
                    const cm = m as ChatMessage;
                    const parts = [...cm.parts];
                    const lastPart = parts[parts.length - 1];
                    if (lastPart?.type === 'text') {
                      parts[parts.length - 1] = {
                        type: 'text',
                        text: lastPart.text + (chunk as { type: 'text'; text: string }).text
                      };
                    } else {
                      parts.push({ type: 'text', text: (chunk as { type: 'text'; text: string }).text });
                    }
                    return { ...cm, parts };
                  })
                );
              } else if (chunk.type === 'tool') {
                const c = chunk as { type: 'tool'; name: string; input: unknown };
                const resolvedName = resolveBlockType(c.name);
                if (resolvedName === 'workflow_progress') {
                  setMessages((prev) =>
                    prev.map((m) => {
                      if (m.id !== assistantId || m.role === 'campaign') return m;
                      const cm = m as ChatMessage;
                      // Replace any existing workflow_progress part instead of appending
                      const filtered = cm.parts.filter((p) => p.type !== 'workflow_progress');
                      return { ...cm, parts: [...filtered, { type: 'workflow_progress' as const, data: c.input } as WorkflowProgressPart] };
                    })
                  );
                } else if (resolvedName === 'hitl_request') {
                  // Store as a typed hitl_request part so MessageBubble can pass onHITLAction
                  setMessages((prev) =>
                    prev.map((m) => {
                      if (m.id !== assistantId || m.role === 'campaign') return m;
                      const cm = m as ChatMessage;
                      return {
                        ...cm,
                        parts: [
                          ...cm.parts,
                          {
                            type: 'hitl_request' as const,
                            data: c.input as Record<string, unknown>,
                          } as HITLRequestPart,
                        ],
                      };
                    })
                  );
                } else if (resolvedName === 'media_plan') {
                  // media_plan block: add as a tool part AND open a plan summary in the sidebar
                  const planData = c.input as Record<string, unknown>;
                  setMessages((prev) =>
                    prev.map((m) => {
                      if (m.id !== assistantId || m.role === 'campaign') return m;
                      const cm = m as ChatMessage;
                      return {
                        ...cm,
                        parts: [
                          ...cm.parts,
                          { type: 'tool' as const, tool: { name: 'media_plan', input: planData } as ToolBlock }
                        ]
                      };
                    })
                  );
                  // Open a plan summary panel in the sidebar
                  openSidebar(
                    <AgenticSidebarPanel blockType="media_plan" data={planData} onClose={closePanel} />
                  );
                } else if (resolvedName === 'generated_image') {
                  const imgData = c.input as { url: string; alt?: string };
                  setMessages((prev) =>
                    prev.map((m) => {
                      if (m.id !== assistantId || m.role === 'campaign') return m;
                      const cm = m as ChatMessage;
                      return {
                        ...cm,
                        parts: [
                          ...cm.parts,
                          {
                            type: 'generated_image' as const,
                            url: imgData.url,
                            alt: imgData.alt,
                          } as GeneratedImagePart,
                        ],
                      };
                    })
                  );
                } else {
                  // Check if this is a sidebar/modal block from __agui_meta
                  const blockValue = c.input as Record<string, unknown>;
                  const agMeta = (blockValue.__agui_meta ?? {}) as Record<string, unknown>;
                  const display = agMeta.display as string | undefined;
                  const inlineTrigger = (agMeta.inline_trigger ?? blockValue) as Record<string, unknown>;
                  // Strip __agui_meta from the data passed to components
                  const { __agui_meta: _meta, ...blockData } = blockValue;

                  if (display === 'sidebar') {
                    // Open sidebar immediately with the block data
                    openSidebar(
                      <AgenticSidebarPanel
                        blockType={resolvedName}
                        data={blockData}
                        onClose={closePanel}
                      />
                    );
                  } else if (display === 'modal') {
                    openModal(
                      <AgenticSidebarPanel
                        blockType={resolvedName}
                        data={blockData}
                        onClose={closeModal}
                      />
                    );
                  }

                  // Always add an inline trigger card (for sidebar/modal blocks) or inline block
                  setMessages((prev) =>
                    prev.map((m) => {
                      if (m.id !== assistantId || m.role === 'campaign') return m;
                      const cm = m as ChatMessage;
                      return {
                        ...cm,
                        parts: [
                          ...cm.parts,
                          {
                            type: 'tool' as const,
                            tool: {
                              name: resolvedName,
                              input: display === 'sidebar' || display === 'modal'
                                ? { ...inlineTrigger, __display: display }
                                : blockData
                            } as ToolBlock
                          }
                        ]
                      };
                    })
                  );
                }
              } else if (chunk.type === 'hitl') {
                const c = chunk as { type: 'hitl'; name: string; input: Record<string, unknown>; step_id: string };
                const hitlData = c.input as { fields?: HITLFormPart['fields']; actions?: HITLFormPart['actions']; title?: string };
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id !== assistantId || m.role === 'campaign') return m;
                    const cm = m as ChatMessage;
                    return {
                      ...cm,
                      parts: [
                        ...cm.parts,
                        {
                          type: 'hitl' as const,
                          step_id: c.step_id,
                          fields: hitlData.fields ?? [],
                          actions: hitlData.actions ?? [],
                          title: hitlData.title,
                        } as HITLFormPart
                      ]
                    };
                  })
                );
              } else if (chunk.type === 'error') {
                throw new Error((chunk as { type: 'error'; message: string }).message);
              }
            } catch {
              // skip malformed lines
            }
          }
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId && m.role !== 'campaign' ? { ...(m as ChatMessage), streaming: false } : m
          )
        );
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== assistantId || m.role === 'campaign') return m;
              const cm = m as ChatMessage;
              // Capture any partial text so the next message can resume from it
              const partialText = cm.parts
                .filter((p) => p.type === 'text')
                .map((p) => (p as { type: 'text'; text: string }).text)
                .join('');
              interruptedContextRef.current = partialText || null;
              return {
                ...cm,
                parts: [
                  ...cm.parts,
                  { type: 'text', text: cm.parts.length > 0 ? '\n\n*The process is interrupted. Reply to continue.*' : '*The process is interrupted. Reply to continue.*' }
                ],
                streaming: false
              };
            })
          );
        } else {
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== assistantId || m.role === 'campaign') return m;
              const cm = m as ChatMessage;
              return {
                ...cm,
                parts: [
                  ...cm.parts,
                  { type: 'text', text: '\n\n_Something went wrong. Please try again._' }
                ],
                streaming: false
              };
            })
          );
        }
      } finally {
        setLoading(false);
        abortRef.current = null;
        inputRef.current?.focus();
      }
    },
    [messages, loading, organizationId, sessionId, openSidebar, orgSlug]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    files.forEach((file) => {
      const url = URL.createObjectURL(file);
      const type = file.type.startsWith('video') ? 'video' : 'image';
      setAttachments((prev) => [...prev, { name: file.name, url, type }]);
    });
    // Reset so same file can be picked again
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => {
      const next = [...prev];
      URL.revokeObjectURL(next[index]!.url);
      next.splice(index, 1);
      return next;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const attachmentNote = attachments.length > 0
      ? `\n\n[Attached: ${attachments.map((a) => a.name).join(', ')}]`
      : '';
    void sendMessage(input + attachmentNote);
    setAttachments([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const attachmentNote = attachments.length > 0
        ? `\n\n[Attached: ${attachments.map((a) => a.name).join(', ')}]`
        : '';
      void sendMessage(input + attachmentNote);
      setAttachments([]);
    }
  };

  const isEmpty = messages.length === 0 && !historyLoading;

  // Campaign edit panel overlays everything
  if (activeCampaign?.phase === 'editing' && activeCampaign.mediaPlan) {
    return (
      <CampaignEditPanel
        mediaPlan={activeCampaign.mediaPlan}
        initialScope={activeCampaign.editScope ?? undefined}
        onSave={(updated) => {
          setActiveCampaign((prev) => prev ? { ...prev, mediaPlan: updated, phase: 'preview', editScope: null } : prev);
        }}
        onClose={() => setActiveCampaign((prev) => prev ? { ...prev, phase: 'preview', editScope: null } : prev)}
      />
    );
  }

  const showRHS = activeCampaign !== null;

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: chat */}
      <div className={cn('flex flex-col transition-all duration-300', showRHS ? 'flex-1 min-w-0' : 'flex-1')}>
        {/* Message thread */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {historyLoading ? (
            <div className="flex flex-col gap-4 px-4 py-6 max-w-3xl mx-auto w-full">
              {[1, 2, 3].map((i) => (
                <div key={i} className={`flex gap-3 ${i % 2 === 0 ? 'justify-end' : 'justify-start'}`}>
                  <div className={`h-12 rounded-xl animate-pulse bg-muted ${i % 2 === 0 ? 'w-48' : 'w-64'}`} />
                </div>
              ))}
            </div>
          ) : isEmpty ? (
            <EmptyState
              firstName={firstName}
              onQuickAction={(prompt) => void sendMessage(prompt)}
            />
          ) : (
            <div className="flex flex-col gap-6 px-4 py-6 max-w-3xl mx-auto w-full">
              {messages.map((message) =>
                message.role === 'campaign' ? (
                  <CampaignInlineBubble
                    key={message.id}
                    message={message as CampaignMessageData}
                    onOpenPreview={() => {
                      const cm = message as CampaignMessageData;
                      if (cm.mediaPlan) {
                        setActiveCampaign((prev) =>
                          prev
                            ? { ...prev, mediaPlan: cm.mediaPlan!, phase: 'preview', editScope: null }
                            : { agents: INITIAL_AGENTS.map((a) => ({ ...a })), mediaPlan: cm.mediaPlan!, phase: 'preview', editScope: null }
                        );
                      }
                    }}
                  />
                ) : (
                  <MessageBubble
                    key={message.id}
                    message={message as ChatMessage}
                    orgSlug={orgSlug}
                    onHITLAction={handleHITLAction}
                    sessionId={sessionId}
                  />
                )
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Input bar */}
        <div className="shrink-0 border-t border-border bg-background px-4 py-4">
          <div className="max-w-3xl mx-auto space-y-2">
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 px-1">
                {attachments.map((att, i) => (
                  <div key={i} className="relative flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 text-xs text-foreground">
                    {att.type === 'image' ? (
                      <img src={att.url} alt={att.name} className="size-6 rounded object-cover" />
                    ) : (
                      <ImageIcon className="size-4 text-muted-foreground" />
                    )}
                    <span className="max-w-[120px] truncate">{att.name}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(i)}
                      className="ml-0.5 rounded-sm text-muted-foreground hover:text-foreground"
                    >
                      <XIcon className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                multiple
                className="hidden"
                onChange={handleFileChange}
              />

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
                className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-40"
                aria-label="Attach image or video"
              >
                <PaperclipIcon className="size-4" />
              </button>

              <SparklesIcon className="size-4 text-muted-foreground shrink-0" />

              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask Accelera AI anything about your campaigns..."
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none min-w-0"
                disabled={loading}
              />

              {loading ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="gap-2 shrink-0 text-muted-foreground"
                  onClick={() => { abortRef.current?.abort(); campaignAbortRef.current?.abort(); }}
                >
                  Stop
                </Button>
              ) : (
                <Button
                  type="submit"
                  size="sm"
                  className="gap-2 shrink-0"
                  disabled={!input.trim() && attachments.length === 0}
                >
                  <SendIcon className="size-4" />
                  Send
                </Button>
              )}
            </form>

            {connectedAccounts.length > 0 && !isEmpty && (
              <p className="text-center text-xs text-muted-foreground">
                Connected:{' '}
                {[...new Set(connectedAccounts.map((a) => a.platform))].join(', ')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Right: campaign RHS panel */}
      {showRHS && (
        <div className="w-[420px] shrink-0 flex flex-col h-full border-l border-border overflow-hidden">
          {activeCampaign.phase === 'analyzing' && (
            <AgentProgressPanel
              agents={activeCampaign.agents}
              onClose={() => setActiveCampaign(null)}
            />
          )}
          {activeCampaign.phase === 'preview' && activeCampaign.mediaPlan && (
            <CampaignPreviewPanel
              mediaPlan={activeCampaign.mediaPlan}
              onClose={() => setActiveCampaign(null)}
              onEdit={(scope) => setActiveCampaign((prev) => prev ? { ...prev, phase: 'editing', editScope: scope ?? null } : prev)}
              onPublish={async () => {
                if (!activeCampaign.campaignId) return;
                setPublishing(true);
                try {
                  const res = await fetch(`/api/campaign/${activeCampaign.campaignId}/publish`, { method: 'POST' });
                  if (res.ok) {
                    setActiveCampaign(null);
                    window.location.href = `/organizations/${orgSlug}/campaigns`;
                  }
                } catch {
                  // non-fatal
                } finally {
                  setPublishing(false);
                }
              }}
              publishing={publishing}
              onMediaPlanChange={(updated) => setActiveCampaign((prev) => prev ? { ...prev, mediaPlan: updated } : prev)}
              orgSlug={orgSlug}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EmptyState({
  firstName,
  onQuickAction
}: {
  firstName: string;
  onQuickAction: (prompt: string) => void;
}) {
  return (
    <div className="flex flex-col items-center px-4 py-16">
      <div className="w-full max-w-2xl space-y-12">
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            <SparklesIcon className="size-6 text-primary" />
            <span className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
              accelera ai
            </span>
          </div>
          <h1 className="text-3xl font-bold text-foreground">
            Good to see you, {firstName}.
          </h1>
          <p className="text-muted-foreground">
            What would you like to work on today?
          </p>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider text-center">
            Quick actions
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {QUICK_ACTIONS.map((action) => (
              <button
                key={action.id}
                type="button"
                onClick={() => onQuickAction(action.prompt)}
                className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-5 text-center transition-all hover:bg-accent hover:border-primary/20"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  {action.icon}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {action.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {action.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CampaignInlineBubble({ message, onOpenPreview }: { message: CampaignMessageData; onOpenPreview: () => void }) {
  if (message.done && message.mediaPlan) {
    return (
      <div className="flex justify-start">
        <button
          type="button"
          onClick={onOpenPreview}
          className="rounded-xl px-4 py-3 text-sm bg-card border border-border text-foreground max-w-[80%] text-left hover:bg-accent transition-colors"
        >
          Campaign plan for <span className="font-medium">{message.mediaPlan.summary?.brandName ?? new URL(message.url).hostname}</span> is ready.{' '}
          <span className="text-primary underline underline-offset-2">Click to view preview.</span>
        </button>
      </div>
    );
  }
  return null;
}

function MessageBubble({
  message,
  orgSlug,
  onHITLAction,
  sessionId,
}: {
  message: ChatMessage;
  orgSlug: string;
  onHITLAction?: (decision: HITLDecision) => void;
  sessionId?: string | null;
}) {
  if (message.role === 'user') {
    const text = message.parts
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map((p) => p.text)
      .join('');
    return (
      <div className="flex justify-end">
        <div className="rounded-xl px-4 py-3 max-w-[80%] text-sm bg-primary text-primary-foreground">
          <p className="whitespace-pre-wrap">{text}</p>
        </div>
      </div>
    );
  }

  // Assistant message: may contain text + tool blocks
  // Only show the cursor dot while waiting for first content — no empty container
  const hasContent = message.parts.some((p) => p.type !== 'text' || (p as { type: 'text'; text: string }).text.length > 0);
  const isWaiting = message.streaming && !hasContent;

  return (
    <div className="flex justify-start">
      <div className="flex-1 min-w-0 space-y-1 max-w-[80%]">
        {isWaiting && (
          <div className="flex items-center gap-1.5 h-8 px-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse" />
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse [animation-delay:200ms]" />
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground animate-pulse [animation-delay:400ms]" />
          </div>
        )}
        {message.parts.map((part, i) => {
          if (part.type === 'text') {
            const isLast = i === message.parts.length - 1;
            if (!part.text) return null;
            return (
              <div
                key={i}
                className="rounded-xl px-4 py-3 text-sm bg-card border border-border text-foreground"
              >
                <MarkdownContent
                  content={part.text}
                  streaming={message.streaming && isLast}
                />
              </div>
            );
          }

          if (part.type === 'tool') {
            return (
              <ToolRenderer
                key={i}
                tool={part.tool}
                orgSlug={orgSlug}
              />
            );
          }

          if (part.type === 'hitl') {
            return (
              <HITLFormCard
                key={i}
                step_id={part.step_id}
                fields={part.fields}
                actions={part.actions}
                title={part.title}
                convId={sessionId ?? ''}
              />
            );
          }

          if (part.type === 'workflow_progress') {
            return (
              <WorkflowProgressBlock
                key={i}
                data={part.data}
              />
            );
          }

          if (part.type === 'hitl_request') {
            return (
              <HITLCard
                key={i}
                // HITLRequest shape is validated at runtime by the agentic service;
                // cast through unknown since the registry payload is Record<string, unknown>
                data={part.data as unknown as import('./HITLCard').HITLRequest}
                onAction={onHITLAction}
              />
            );
          }

          if (part.type === 'generated_image') {
            return (
              <div key={i} className="rounded-xl overflow-hidden border border-border max-w-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={part.url}
                  alt={part.alt ?? 'Generated image'}
                  className="w-full h-auto object-cover"
                />
              </div>
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}

function ToolRenderer({
  tool,
  orgSlug
}: {
  tool: ToolBlock;
  orgSlug: string;
}) {
  const { openSidebar, closePanel } = usePanel();
  switch (tool.name) {
    case 'show_metrics':
      return (
        <ChatMetricCard
          title={tool.input.title}
          metrics={tool.input.metrics}
        />
      );
    case 'show_campaigns':
      return (
        <ChatCampaignTable
          title={tool.input.title}
          campaigns={tool.input.campaigns}
        />
      );
    case 'show_chart':
      return (
        <ChatPerformanceChart
          title={tool.input.title}
          metric={tool.input.metric}
          data={tool.input.data}
        />
      );
    case 'navigate_to':
      return (
        <ChatNavSuggestion
          label={tool.input.label}
          description={tool.input.description}
          path={tool.input.path}
          orgSlug={orgSlug}
        />
      );
    case 'connect_accounts_prompt':
      return (
        <ChatConnectPrompt
          message={tool.input.message}
          orgSlug={orgSlug}
        />
      );
    case 'show_products':
      return (
        <ChatProductLeaderboard
          title={tool.input.title}
          products={tool.input.products as Parameters<typeof ChatProductLeaderboard>[0]['products']}
        />
      );
    case 'show_inventory':
      return (
        <ChatInventoryCard
          title={tool.input.title}
          summary={tool.input.summary}
          items={tool.input.items}
        />
      );
    case 'show_health_scores':
      return (
        <ChatHealthScoreCard
          period={tool.input.period ?? '30d'}
          currency={tool.input.currency ?? 'USD'}
          summary={tool.input.summary}
          campaigns={tool.input.campaigns.map((c) => ({
            ...c,
            platform: c.platform ?? 'unknown',
            status: c.status ?? 'unknown',
            budget: c.budget ?? '0',
            spend: c.spend ?? '0',
            roas: c.roas ?? 0,
            score: c.score ?? 0,
          }))}
        />
      );
    case 'show_executive_summary':
      return (
        <ChatExecutiveSummaryCard
          period={tool.input.period ?? '30d'}
          currency={tool.input.currency ?? 'USD'}
          blended_roas={tool.input.blended_roas}
          mer={tool.input.mer ?? '0'}
          total_spend={tool.input.total_spend}
          total_revenue={tool.input.total_revenue}
          total_orders={tool.input.total_orders ?? 0}
          total_impressions={tool.input.total_impressions ?? 0}
          total_clicks={tool.input.total_clicks ?? 0}
          total_conversions={tool.input.total_conversions ?? 0}
          spend_change_pct={tool.input.spend_change_pct ?? '0'}
          revenue_change_pct={tool.input.revenue_change_pct ?? '0'}
          top_platform={tool.input.top_platform ?? 'N/A'}
        />
      );
    case 'show_funnel':
      return (
        <ChatFunnelChartCard
          period={tool.input.period ?? '30d'}
          stages={tool.input.stages.map((s) => ({ ...s, drop_off_pct: s.drop_off_pct ?? null }))}
          overall_conversion_rate={tool.input.overall_conversion_rate ?? 'N/A'}
          biggest_opportunity={tool.input.biggest_opportunity ?? null}
          note={tool.input.note}
        />
      );
    case 'show_revenue_breakdown':
      return (
        <ChatRevenueBreakdownCard
          period={tool.input.period ?? '30d'}
          currency={tool.input.currency ?? 'USD'}
          total_revenue={tool.input.total_revenue}
          ad_attributed={tool.input.ad_attributed}
          organic={tool.input.organic}
          ad_share_pct={tool.input.ad_share_pct ?? '0'}
          organic_share_pct={tool.input.organic_share_pct ?? '0'}
          by_platform={tool.input.by_platform ?? []}
        />
      );
    case 'show_wasted_spend':
      return (
        <ChatWastedSpendCard
          period={tool.input.period ?? '30d'}
          currency={tool.input.currency ?? 'USD'}
          total_wasted={tool.input.total_wasted}
          items_count={tool.input.items_count}
          items={tool.input.items}
          summary={tool.input.summary}
        />
      );
    case 'show_platform_comparison':
      return (
        <ChatPlatformComparisonCard
          period={tool.input.period ?? '30d'}
          currency={tool.input.currency ?? 'USD'}
          platforms={tool.input.platforms.map((p) => ({
            platform: p.platform,
            spend: p.spend,
            impressions: p.impressions ?? 0,
            clicks: p.clicks ?? 0,
            ctr: p.ctr ?? '0%',
            cpc: p.cpc ?? '0',
            conversions: p.conversions ?? 0,
            roas: p.roas ?? '0',
            cpa: p.cpa ?? '0',
          }))}
        />
      );
    case 'show_audience':
      return (
        <ChatAudienceCard
          total={tool.input.total}
          audiences={tool.input.audiences.map((a) => ({
            ...a,
            platforms: a.platforms ?? [],
            estimated_size: a.estimated_size ?? null,
            sync_status: a.sync_status ?? 'pending',
            created_at: a.created_at ?? '',
          }))}
        />
      );
    case 'show_feed_health':
      return (
        <ChatFeedHealthCard
          total={tool.input.total}
          message={tool.input.message}
          feeds={tool.input.feeds.map((f) => ({
            ...f,
            connector: f.connector ?? '',
            health_score: f.health_score ?? null,
            last_pushed_at: f.last_pushed_at ?? null,
            active_rules: f.active_rules ?? 0,
          }))}
        />
      );
    case 'show_strategy':
      return (
        <ChatStrategyCard
          title={tool.input.title}
          total_campaigns={tool.input.total_campaigns}
          total_daily_budget={tool.input.total_daily_budget}
          total_monthly_estimate={tool.input.total_monthly_estimate}
          currency={tool.input.currency}
          campaigns={tool.input.campaigns}
        />
      );
    case 'show_demographics':
      return (
        <ChatDemographicsCard
          period={tool.input.period}
          currency={tool.input.currency}
          best_roas_segment={tool.input.best_roas_segment}
          highest_spend_segment={tool.input.highest_spend_segment}
          note={tool.input.note}
          data={tool.input.data}
        />
      );
    case 'show_placements':
      return (
        <ChatPlacementsCard
          period={tool.input.period}
          currency={tool.input.currency}
          best_placement={tool.input.best_placement}
          note={tool.input.note}
          data={tool.input.data}
        />
      );
    case 'show_auto_setup':
      return (
        <ChatAutoSetupCard
          products_configured={tool.input.products_configured}
          total_daily_budget={tool.input.total_daily_budget}
          total_monthly_estimate={tool.input.total_monthly_estimate}
          message={tool.input.message}
          next_step={tool.input.next_step}
          results={tool.input.results}
        />
      );
    case 'json_render_spec':
      return <JsonRenderBlock spec={tool.input.spec ?? tool.input} />;

    // ── Phase 2: agentic workflow blocks ──────────────────────────────
    case 'workflow_progress':
      return <WorkflowProgressBlock data={tool.input} />;

    case 'hitl_request':
      // Rendered inline — onHITLAction is not available here (ToolRenderer doesn't
      // receive it). HITL blocks from the streaming path are emitted as 'hitl_request'
      // MessageParts and rendered by MessageBubble directly (which does have it).
      // This fallback handles the case where a hitl_request appears as a plain tool block.
      return (
        <HITLCard
          data={tool.input as unknown as import('./HITLCard').HITLRequest}
        />
      );

    case 'generated_image': {
      const imgInput = tool.input as { url: string; alt?: string };
      return (
        <div className="rounded-xl overflow-hidden border border-border max-w-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imgInput.url}
            alt={imgInput.alt ?? 'Generated image'}
            className="w-full h-auto object-cover"
          />
        </div>
      );
    }

    case 'campaign_overview':
      // Render a simple data table for now; can be upgraded to a richer component later
      return (
        <div className="rounded-xl border border-border bg-card px-4 py-3 max-w-lg">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Campaign Overview
          </p>
          <pre className="text-xs text-foreground overflow-x-auto whitespace-pre-wrap break-all">
            {JSON.stringify(tool.input, null, 2)}
          </pre>
        </div>
      );

    case 'media_plan': {
      const planInput = tool.input as Record<string, unknown>;
      const planId = planInput['plan_id'] as string | undefined;
      const planName = planInput['plan_name'] as string | undefined;
      return (
        <div
          role="button"
          tabIndex={0}
          onClick={() => openSidebar(
            <AgenticSidebarPanel blockType="media_plan" data={planInput} onClose={closePanel} />
          )}
          onKeyDown={(e) => e.key === 'Enter' && openSidebar(
            <AgenticSidebarPanel blockType="media_plan" data={planInput} onClose={closePanel} />
          )}
          className="rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/10 px-4 py-3 max-w-sm cursor-pointer hover:bg-primary/10 transition-colors"
        >
          <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">
            Media Plan Ready
          </p>
          <p className="text-sm text-foreground">
            {String(planName ?? planInput['campaignName'] ?? 'View campaign plan')}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Click to open preview</p>
        </div>
      );
    }

    case 'campaign_details': {
      const input = tool.input as Record<string, unknown>;
      const isDisplayTrigger = input.__display === 'sidebar' || input.__display === 'modal';
      const label = String(input.campaign_name ?? input.name ?? 'Campaign Details');
      const platform = input.platform ? String(input.platform) : undefined;
      if (isDisplayTrigger) {
        return (
          <div className="rounded-xl border border-border bg-card px-4 py-3 max-w-sm cursor-pointer hover:bg-accent transition-colors">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
              Campaign Details {platform ? `· ${platform}` : ''}
            </p>
            <p className="text-sm text-foreground font-medium">{label}</p>
            <p className="text-xs text-muted-foreground mt-1">Opened in panel</p>
          </div>
        );
      }
      return (
        <div className="rounded-xl border border-border bg-card px-4 py-3 max-w-lg">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Campaign Details
          </p>
          <pre className="text-xs text-foreground overflow-x-auto whitespace-pre-wrap break-all">
            {JSON.stringify(tool.input, null, 2)}
          </pre>
        </div>
      );
    }

    case 'budget_approval': {
      const input = tool.input as Record<string, unknown>;
      const isDisplayTrigger = input.__display === 'sidebar' || input.__display === 'modal';
      const total = input.total_budget ?? input.budget;
      if (isDisplayTrigger) {
        return (
          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 px-4 py-3 max-w-sm cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-950/40 transition-colors">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-1">
              Budget Approval
            </p>
            {total !== undefined && (
              <p className="text-sm font-medium text-foreground">
                {typeof total === 'number' ? total.toLocaleString() : String(total)}
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-1">Opened in panel</p>
          </div>
        );
      }
      return (
        <div className="rounded-xl border border-border bg-card px-4 py-3 max-w-lg">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            Budget Approval
          </p>
          <pre className="text-xs text-foreground overflow-x-auto whitespace-pre-wrap break-all">
            {JSON.stringify(tool.input, null, 2)}
          </pre>
        </div>
      );
    }

    default:
      return null;
  }
}

// ── HITL Form ────────────────────────────────────────────────────────────────

function HITLFormCard({
  step_id,
  fields,
  actions,
  title,
  convId
}: {
  step_id: string;
  fields: HITLFormPart['fields'];
  actions: HITLFormPart['actions'];
  title?: string;
  convId: string;
}) {
  const [values, setValues] = React.useState<Record<string, unknown>>(() => {
    const init: Record<string, unknown> = {};
    for (const f of fields) init[f.name] = f.default ?? '';
    return init;
  });
  const [submitted, setSubmitted] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  const submit = async (action: string) => {
    setSubmitting(true);
    try {
      await fetch('/api/chat/hitl', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step_id,
          action: action === 'reject' ? 'reject' : 'submit',
          user_input: action !== 'reject' ? values : {},
          conv_id: convId,
        }),
      });
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground">
        Response submitted — campaign creation continuing...
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-card px-4 py-4 space-y-4 max-w-md">
      {title && <p className="text-sm font-semibold text-foreground">{title}</p>}
      <div className="space-y-3">
        {fields.map((field) => (
          <div key={field.name} className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">{field.label}</label>
            {field.type === 'select' || field.type === 'multiselect' ? (
              <select
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                value={String(values[field.name] ?? '')}
                onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.value }))}
                disabled={submitting}
              >
                {(field.options ?? []).map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : (
              <input
                type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
                className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                value={String(values[field.name] ?? '')}
                onChange={(e) => setValues((v) => ({ ...v, [field.name]: field.type === 'number' ? Number(e.target.value) : e.target.value }))}
                disabled={submitting}
              />
            )}
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        {actions.map((act) => (
          <button
            key={act.action}
            type="button"
            onClick={() => void submit(act.action)}
            disabled={submitting}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
              act.style === 'primary'
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'border border-border bg-background text-foreground hover:bg-accent'
            }`}
          >
            {act.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Markdown ──────────────────────────────────────────────────────────────────

function MarkdownContent({
  content,
  streaming
}: {
  content: string;
  streaming?: boolean;
}): React.JSX.Element {
  const html = React.useMemo(() => parseMarkdown(content), [content]);

  return (
    <div className="flex items-end gap-1">
      <div
        className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      {streaming && (
        <span className="inline-block h-4 w-0.5 bg-current animate-pulse shrink-0 mb-0.5" />
      )}
    </div>
  );
}

function parseMarkdown(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let inList = false;
  let listType = 'ul';

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      if (!inList || listType !== 'ul') {
        if (inList) result.push(`</${listType}>`);
        result.push('<ul class="list-disc pl-4 my-1 space-y-0.5">');
        inList = true;
        listType = 'ul';
      }
      result.push(`<li>${formatInline(trimmed.slice(2))}</li>`);
    } else if (/^\d+\.\s/.test(trimmed)) {
      if (!inList || listType !== 'ol') {
        if (inList) result.push(`</${listType}>`);
        result.push('<ol class="list-decimal pl-4 my-1 space-y-0.5">');
        inList = true;
        listType = 'ol';
      }
      result.push(`<li>${formatInline(trimmed.replace(/^\d+\.\s/, ''))}</li>`);
    } else {
      if (inList) {
        result.push(`</${listType}>`);
        inList = false;
      }
      if (trimmed === '') {
        result.push('<br/>');
      } else if (trimmed.startsWith('### ')) {
        result.push(
          `<h3 class="font-semibold text-sm mt-2">${formatInline(trimmed.slice(4))}</h3>`
        );
      } else if (trimmed.startsWith('## ')) {
        result.push(
          `<h2 class="font-semibold text-sm mt-2">${formatInline(trimmed.slice(3))}</h2>`
        );
      } else if (trimmed.startsWith('# ')) {
        result.push(
          `<h1 class="font-semibold text-base mt-2">${formatInline(trimmed.slice(2))}</h1>`
        );
      } else {
        result.push(`<p>${formatInline(trimmed)}</p>`);
      }
    }
  }

  if (inList) result.push(`</${listType}>`);
  return result.join('');
}

function formatInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(
      /`(.+?)`/g,
      '<code class="bg-muted px-1 rounded text-xs font-mono">$1</code>'
    );
}

// ── MediaPlanSidebarPanel ─────────────────────────────────────────────────────
// Shown in the SidebarPanel when the agentic service emits a media_plan block.
// Displays a summary and a link to the full campaign in the campaigns page.

function MediaPlanSidebarPanel({
  planId,
  planName,
  planData,
  orgSlug,
}: {
  planId: string;
  planName?: string;
  planData: Record<string, unknown>;
  orgSlug: string;
}) {
  const { closePanel } = usePanel();
  const campaignCount = (planData['campaign_count'] ?? planData['count']) as number | undefined;
  const platforms = planData['platforms'] as string[] | undefined;
  const currencyTotals = planData['currency_totals'] as Record<string, number> | undefined;
  const totalDailyBudget = planData['total_daily_budget'] as number | undefined;
  const currency = planData['currency'] as string | undefined;
  const displayName = planName ?? String(planData['plan_name'] ?? 'Media Plan');

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <p className="text-sm font-semibold text-foreground">Media Plan Ready</p>
        <button
          type="button"
          onClick={closePanel}
          className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          <span className="sr-only">Close</span>
          <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <div className="rounded-xl border border-primary/20 bg-primary/5 dark:bg-primary/10 px-4 py-4 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Campaign Plan</p>
          <p className="text-base font-medium text-foreground">{displayName}</p>
          {campaignCount !== undefined && (
            <p className="text-sm text-muted-foreground">{campaignCount} campaign{campaignCount !== 1 ? 's' : ''}</p>
          )}
          {/* Budget summary */}
          {currencyTotals && Object.entries(currencyTotals).map(([cur, total]) => (
            <div key={cur} className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Daily Budget</span>
              <span className="text-sm font-semibold text-foreground">{cur} {Number(total).toLocaleString()}</span>
            </div>
          ))}
          {!currencyTotals && totalDailyBudget !== undefined && currency && (
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Daily Budget</span>
              <span className="text-sm font-semibold text-foreground">{currency} {Number(totalDailyBudget).toLocaleString()}</span>
            </div>
          )}
          {platforms && platforms.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {platforms.map((p) => (
                <span key={p} className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">{p}</span>
              ))}
            </div>
          )}
        </div>
        {planId && (
          <a
            href={`/organizations/${orgSlug}/campaigns`}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            View in Campaign Manager
          </a>
        )}
        {!planId && (
          <p className="text-xs text-muted-foreground text-center">Campaign plan generated — connect your ad accounts to publish</p>
        )}
      </div>
    </div>
  );
}
