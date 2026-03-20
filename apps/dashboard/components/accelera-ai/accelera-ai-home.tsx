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

import { ChatCampaignTable } from './chat-campaign-table';
import { ChatConnectPrompt } from './chat-connect-prompt';
import { ChatMetricCard } from './chat-metric-card';
import { ChatNavSuggestion } from './chat-nav-suggestion';
import { ChatPerformanceChart } from './chat-performance-chart';

// ── Types ────────────────────────────────────────────────────────────────────

type ToolBlock =
  | { name: 'show_metrics'; input: { title: string; metrics: { label: string; value: string; change?: string; trend?: 'up' | 'down' | 'neutral' }[] } }
  | { name: 'show_campaigns'; input: { title: string; campaigns: { name: string; status: 'active' | 'paused' | 'ended'; budget?: string; spend?: string; impressions?: string; clicks?: string; ctr?: string; conversions?: string }[] } }
  | { name: 'show_chart'; input: { title: string; metric: string; data: { date: string; value: number }[] } }
  | { name: 'navigate_to'; input: { label: string; description: string; path: 'campaign-manager' | 'analytics' | 'connectors' | 'settings' | 'accelera-ai' } }
  | { name: 'connect_accounts_prompt'; input: { message: string } };

type MessagePart =
  | { type: 'text'; text: string }
  | { type: 'tool'; tool: ToolBlock };

type Message = {
  id: string;
  role: 'user' | 'assistant';
  parts: MessagePart[];
  streaming?: boolean;
};

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
};

// ── Component ─────────────────────────────────────────────────────────────────

export function AcceleraAiHome({
  firstName,
  organizationId,
  orgSlug,
  connectedAccounts
}: AcceleraAiHomeProps): React.JSX.Element {
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

  // Load most recent session on mount
  React.useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`/api/chat/sessions?organizationId=${organizationId}`);
        if (!res.ok) return;
        const sessions = (await res.json()) as Array<{
          id: string;
          messages: Array<{ id: string; role: string; content: string; toolData: unknown; createdAt: string }>;
        }>;
        const latest = sessions[0];
        if (!latest || latest.messages.length === 0) return;

        setSessionId(latest.id);
        setMessages(
          latest.messages.map((m) => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            parts: buildPartsFromPersistedMessage(m.content, m.toolData)
          }))
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

  const sendMessage = React.useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: 'user',
        parts: [{ type: 'text', text: trimmed }]
      };
      const assistantId = crypto.randomUUID();
      const assistantMsg: Message = {
        id: assistantId,
        role: 'assistant',
        parts: [],
        streaming: true
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput('');
      setLoading(true);

      // Build history for the API (text only — tools are not re-sent)
      const history = [
        ...messages,
        { role: 'user' as const, parts: [{ type: 'text' as const, text: trimmed }] }
      ].map((m) => ({
        role: m.role,
        content: m.parts
          .filter((p) => p.type === 'text')
          .map((p) => (p as { type: 'text'; text: string }).text)
          .join('')
      }));

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
                | { type: 'error'; message: string };

              if (chunk.type === 'text') {
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id !== assistantId) return m;
                    const parts = [...m.parts];
                    const lastPart = parts[parts.length - 1];
                    if (lastPart?.type === 'text') {
                      parts[parts.length - 1] = {
                        type: 'text',
                        text: lastPart.text + chunk.text
                      };
                    } else {
                      parts.push({ type: 'text', text: chunk.text });
                    }
                    return { ...m, parts };
                  })
                );
              } else if (chunk.type === 'tool') {
                setMessages((prev) =>
                  prev.map((m) => {
                    if (m.id !== assistantId) return m;
                    return {
                      ...m,
                      parts: [
                        ...m.parts,
                        {
                          type: 'tool' as const,
                          tool: {
                            name: chunk.name,
                            input: chunk.input
                          } as ToolBlock
                        }
                      ]
                    };
                  })
                );
              } else if (chunk.type === 'error') {
                throw new Error(chunk.message);
              }
            } catch {
              // skip malformed lines
            }
          }
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, streaming: false } : m
          )
        );
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    parts:
                      m.parts.length > 0
                        ? m.parts
                        : [{ type: 'text', text: '_Stopped._' }],
                    streaming: false
                  }
                : m
            )
          );
        } else {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    parts: [
                      ...m.parts,
                      {
                        type: 'text',
                        text: '\n\n_Something went wrong. Please try again._'
                      }
                    ],
                    streaming: false
                  }
                : m
            )
          );
        }
      } finally {
        setLoading(false);
        abortRef.current = null;
        inputRef.current?.focus();
      }
    },
    [messages, loading, organizationId, sessionId]
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

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Message thread — min-h-0 required so flex item can shrink below content height */}
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
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                orgSlug={orgSlug}
              />
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div className="shrink-0 border-t border-border bg-background px-4 py-4">
        <div className="max-w-3xl mx-auto space-y-2">
          {/* Attachment previews */}
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
            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Attach button */}
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
                onClick={() => abortRef.current?.abort()}
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
              {connectedAccounts.map((a) => a.platform).join(', ')}
            </p>
          )}
        </div>
      </div>
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

function MessageBubble({
  message,
  orgSlug
}: {
  message: Message;
  orgSlug: string;
}) {
  if (message.role === 'user') {
    const text = message.parts
      .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
      .map((p) => p.text)
      .join('');
    return (
      <div className="flex gap-3 justify-end">
        <div className="rounded-xl px-4 py-3 max-w-[80%] text-sm bg-primary text-primary-foreground">
          <p className="whitespace-pre-wrap">{text}</p>
        </div>
      </div>
    );
  }

  // Assistant message: may contain text + tool blocks
  const hasContent = message.parts.length > 0;
  const isOnlyStreaming = message.streaming && !hasContent;

  return (
    <div className="flex gap-3 justify-start">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary mt-0.5">
        <SparklesIcon className="size-4" />
      </div>
      <div className="flex-1 min-w-0 space-y-1">
        {isOnlyStreaming && (
          <div className="rounded-xl px-4 py-3 max-w-[80%] text-sm bg-card border border-border text-foreground">
            <span className="inline-block h-4 w-0.5 bg-current animate-pulse" />
          </div>
        )}
        {message.parts.map((part, i) => {
          if (part.type === 'text') {
            const isLast = i === message.parts.length - 1;
            if (!part.text) return null;
            return (
              <div
                key={i}
                className="rounded-xl px-4 py-3 max-w-[80%] text-sm bg-card border border-border text-foreground"
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
    default:
      return null;
  }
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
