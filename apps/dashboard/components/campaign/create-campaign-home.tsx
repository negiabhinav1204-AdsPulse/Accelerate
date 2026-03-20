'use client';

import * as React from 'react';
import {
  ArrowUpIcon,
  CheckIcon,
  PaperclipIcon,
  SparklesIcon,
  XIcon,
  ZapIcon
} from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import { cn } from '@workspace/ui/lib/utils';

import { AgentProgressPanel } from './agent-progress-panel';
import { CampaignEditPanel } from './campaign-edit-panel';
import { CampaignPreviewPanel } from './campaign-preview-panel';
import { MediaPlanCard } from './media-plan-card';
import type { AgentName, AgentState, MediaPlan, SSEEvent } from './types';

// ── Constants ──────────────────────────────────────────────────────────────────

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

const PREFERENCE_QUESTIONS = [
  {
    id: 'platforms',
    question: 'Which platforms would you like to run ads on?',
    options: ['Google Ads', 'Meta Ads', 'Microsoft Ads'],
    type: 'checkbox' as const
  },
  {
    id: 'budget',
    question: 'Do you have a budget in mind?',
    options: ['Under $500/mo', '$500–$2,000/mo', '$2,000–$10,000/mo', '$10,000+/mo', 'Let AI decide'],
    type: 'radio' as const
  },
  {
    id: 'duration',
    question: 'How long would you like to run this campaign?',
    options: ['7 days', '14 days', '30 days', '90 days', 'Ongoing'],
    type: 'radio' as const
  }
];

// ── Types ──────────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'analyzing' | 'plan_ready' | 'preview' | 'editing';

type ChatMessage =
  | { id: string; role: 'user'; text: string; files?: string[] }
  | { id: string; role: 'ai'; text: string }
  | { id: string; role: 'progress' }
  | { id: string; role: 'question'; questionId: string; question: string; options: string[]; questionType: 'checkbox' | 'radio'; answered: boolean; selected: string[] }
  | { id: string; role: 'media_plan'; plan: MediaPlan };

export type ConnectedAccountInfo = {
  id: string;
  platform: string;
  accountName: string;
  currency?: string;
};

type CreateCampaignHomeProps = {
  orgSlug: string;
  organizationId: string;
  connectedAccounts: ConnectedAccountInfo[];
};

// ── Component ──────────────────────────────────────────────────────────────────

export function CreateCampaignHome({
  orgSlug,
  organizationId,
  connectedAccounts
}: CreateCampaignHomeProps): React.JSX.Element {
  const [phase, setPhase] = React.useState<Phase>('idle');
  const [agents, setAgents] = React.useState<AgentState[]>(INITIAL_AGENTS);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [mediaPlan, setMediaPlan] = React.useState<MediaPlan | null>(null);
  const [input, setInput] = React.useState('');
  const [attachedFiles, setAttachedFiles] = React.useState<File[]>([]);
  const [publishing, setPublishing] = React.useState(false);
  const [charCount, setCharCount] = React.useState(0);

  const bottomRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const updateAgent = React.useCallback(
    (name: AgentName, update: Partial<AgentState>) => {
      setAgents((prev) =>
        prev.map((a) => (a.name === name ? { ...a, ...update } : a))
      );
    },
    []
  );

  const showPreferenceQuestions = React.useCallback(() => {
    PREFERENCE_QUESTIONS.forEach((q, i) => {
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'question',
            questionId: q.id,
            question: q.question,
            options: q.options,
            questionType: q.type,
            answered: false,
            selected: []
          }
        ]);
      }, 600 * (i + 1));
    });
  }, []);

  const startAnalysis = React.useCallback(
    async (url: string) => {
      setPhase('analyzing');
      setAgents(INITIAL_AGENTS.map((a) => ({ ...a, status: 'idle' })));

      const progressMsgId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        { id: progressMsgId, role: 'progress' }
      ]);

      showPreferenceQuestions();

      try {
        const controller = new AbortController();
        abortRef.current = controller;

        const response = await fetch('/api/campaign/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, organizationId }),
          signal: controller.signal
        });

        if (!response.ok || !response.body) {
          throw new Error('Failed to start campaign analysis');
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
            if (!line.trim() || !line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') break;
            try {
              const event = JSON.parse(jsonStr) as SSEEvent;
              handleSSEEvent(event);
            } catch {
              // skip malformed
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: 'ai',
              text: 'Something went wrong while analysing your campaign. Please try again.'
            }
          ]);
          setPhase('idle');
        }
      } finally {
        abortRef.current = null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [organizationId, showPreferenceQuestions]
  );

  const handleSSEEvent = React.useCallback(
    (event: SSEEvent) => {
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
            completedMessage: event.message,
            output: event.output,
            timeTaken: event.timeTaken,
            confidence: event.confidence
          });
          break;

        case 'preference_question':
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: 'question',
              questionId: event.questionId,
              question: event.question,
              options: event.options ?? [],
              questionType: 'radio',
              answered: false,
              selected: []
            }
          ]);
          break;

        case 'media_plan': {
          setMediaPlan(event.plan);
          setPhase('plan_ready');
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: 'ai',
              text: `Great news! All agents have completed their analysis. Here's your personalised campaign plan for **${event.plan.summary.brandName}**:`
            },
            {
              id: crypto.randomUUID(),
              role: 'media_plan',
              plan: event.plan
            }
          ]);
          break;
        }

        case 'error':
          setMessages((prev) => [
            ...prev,
            {
              id: crypto.randomUUID(),
              role: 'ai',
              text: `An error occurred: ${event.message}`
            }
          ]);
          setPhase('idle');
          break;
      }
    },
    [updateAgent]
  );

  const handleSend = React.useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed && attachedFiles.length === 0) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text: trimmed,
      files: attachedFiles.map((f) => URL.createObjectURL(f))
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setCharCount(0);
    setAttachedFiles([]);

    // Detect if it's a URL for analysis
    const urlPattern = /https?:\/\/[^\s]+/i;
    if (urlPattern.test(trimmed) && phase === 'idle') {
      void startAnalysis(trimmed);
    } else if (phase === 'idle') {
      // Echo an AI response for non-URL messages in idle state
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'ai',
            text: 'To create a campaign, please paste your landing page URL or website address and I\'ll analyse it to build your campaign plan.'
          }
        ]);
      }, 400);
    }
  }, [input, attachedFiles, phase, startAnalysis]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileAttach = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    setAttachedFiles((prev) => [...prev, ...files]);
    e.target.value = '';
  };

  const handleRemoveFile = (index: number) => {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePublish = async (plan: MediaPlan) => {
    setPublishing(true);
    try {
      await fetch('/api/campaign/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, organizationId })
      });
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'ai',
          text: `Your campaign **${plan.campaignName}** has been published successfully! It will go live on ${plan.startDate}.`
        }
      ]);
      setPhase('idle');
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'ai',
          text: 'Failed to publish campaign. Please try again.'
        }
      ]);
    } finally {
      setPublishing(false);
    }
  };

  const handleAnswerQuestion = (msgId: string, selected: string[]) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === msgId && m.role === 'question'
          ? { ...m, answered: true, selected }
          : m
      )
    );
    // Add a user message showing the selection
    const answer = selected.join(', ');
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', text: answer }
    ]);
  };

  const completedAgents = agents.filter((a) => a.status === 'complete').length;
  const showRHS = phase === 'analyzing' || phase === 'plan_ready' || phase === 'preview';
  const isEditing = phase === 'editing';

  return (
    <div className="flex h-full overflow-hidden">
      {/* Edit panel covers full screen */}
      {isEditing && mediaPlan && (
        <CampaignEditPanel
          mediaPlan={mediaPlan}
          onSave={(updated) => {
            setMediaPlan(updated);
            setPhase('preview');
          }}
          onClose={() => setPhase('preview')}
        />
      )}

      {/* Left: Chat panel */}
      {!isEditing && (
        <div
          className={cn(
            'flex flex-col transition-all duration-300',
            showRHS ? 'flex-1 min-w-0' : 'flex-1'
          )}
        >
          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto">
            {messages.length === 0 ? (
              <EmptyState onSendUrl={(url) => {
                setInput(url);
                setTimeout(() => handleSend(), 0);
              }} />
            ) : (
              <div className="flex flex-col gap-4 px-4 py-6 max-w-2xl mx-auto w-full">
                {messages.map((msg) => (
                  <ChatMessageItem
                    key={msg.id}
                    msg={msg}
                    agents={agents}
                    completedAgents={completedAgents}
                    onPreview={() => setPhase('preview')}
                    onAnswerQuestion={handleAnswerQuestion}
                  />
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* Chat input */}
          <div className="shrink-0 border-t border-border bg-background px-4 py-3">
            <div className="max-w-2xl mx-auto space-y-2">
              {/* File previews */}
              {attachedFiles.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                  {attachedFiles.map((file, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1.5 rounded-lg border border-border bg-muted px-2.5 py-1.5 text-xs text-foreground"
                    >
                      <span className="max-w-[120px] truncate">{file.name}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(i)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <XIcon className="size-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Input row */}
              <div className="flex items-end gap-2 rounded-xl border border-border bg-card px-3 py-2.5 shadow-sm focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                {/* Attach button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors mb-0.5"
                >
                  <PaperclipIcon className="size-4" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={handleFileAttach}
                />

                {/* Text area */}
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => {
                    const val = e.target.value.slice(0, 1000);
                    setInput(val);
                    setCharCount(val.length);
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    phase === 'idle'
                      ? 'Paste your website URL to create a campaign...'
                      : 'Ask a follow-up question...'
                  }
                  rows={1}
                  className="flex-1 resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none leading-relaxed max-h-32 overflow-y-auto"
                  style={{ minHeight: '24px' }}
                />

                {/* Char count + send */}
                <div className="flex items-center gap-2 shrink-0 mb-0.5">
                  {charCount > 800 && (
                    <span className={cn(
                      'text-[10px] font-medium',
                      charCount >= 1000 ? 'text-destructive' : 'text-muted-foreground'
                    )}>
                      {charCount}/1000
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!input.trim() && attachedFiles.length === 0}
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
                      input.trim() || attachedFiles.length > 0
                        ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                        : 'bg-muted text-muted-foreground cursor-not-allowed'
                    )}
                  >
                    <ArrowUpIcon className="size-4" />
                  </button>
                </div>
              </div>

              {/* Disclaimer */}
              <p className="text-center text-[11px] text-muted-foreground">
                AI generated content may make mistakes. Review before publishing.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Right: Agent progress or Campaign preview */}
      {!isEditing && showRHS && (
        <div className="w-[420px] shrink-0 flex flex-col h-full border-l border-border overflow-hidden">
          {(phase === 'analyzing' || phase === 'plan_ready') && (
            <AgentProgressPanel
              agents={agents}
              onClose={() => setPhase('idle')}
            />
          )}
          {phase === 'preview' && mediaPlan && (
            <CampaignPreviewPanel
              mediaPlan={mediaPlan}
              onClose={() => setPhase('plan_ready')}
              onEdit={() => setPhase('editing')}
              onPublish={handlePublish}
              publishing={publishing}
              orgSlug={orgSlug}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────────────────────────

function EmptyState({ onSendUrl }: { onSendUrl: (url: string) => void }): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center">
      <div className="max-w-md space-y-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mx-auto">
          <ZapIcon className="size-8 text-primary" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-foreground">Create your campaign with AI</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Paste your website or landing page URL below. Accelera AI will analyse your brand and create a complete multi-platform campaign plan in seconds.
          </p>
        </div>
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            What happens next
          </p>
          <div className="text-left space-y-2">
            {[
              '8 AI agents analyse your brand, audience, and competition',
              'You answer a few quick questions about budget and goals',
              'Get a complete campaign plan across Google, Meta & Microsoft',
              'Review, edit, and publish with one click'
            ].map((step, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold mt-0.5">
                  {i + 1}
                </span>
                {step}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Chat Message Item ─────────────────────────────────────────────────────────

function ChatMessageItem({
  msg,
  agents,
  completedAgents,
  onPreview,
  onAnswerQuestion
}: {
  msg: ChatMessage;
  agents: AgentState[];
  completedAgents: number;
  onPreview: () => void;
  onAnswerQuestion: (msgId: string, selected: string[]) => void;
}): React.JSX.Element | null {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] space-y-1">
          <div className="rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
            <p className="whitespace-pre-wrap break-words">{msg.text}</p>
          </div>
          {msg.files && msg.files.length > 0 && (
            <div className="flex gap-1 flex-wrap justify-end">
              {msg.files.map((f, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={f}
                  alt="attachment"
                  className="h-16 w-16 rounded-lg object-cover border border-border"
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (msg.role === 'ai') {
    return (
      <div className="flex items-start gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary mt-0.5">
          <SparklesIcon className="size-3.5" />
        </div>
        <p className="text-sm text-foreground leading-relaxed flex-1 pt-0.5">
          {msg.text}
        </p>
      </div>
    );
  }

  if (msg.role === 'progress') {
    return (
      <div className="flex items-start gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary mt-0.5">
          <SparklesIcon className="size-3.5" />
        </div>
        <AgentProgressCard
          agents={agents}
          completedAgents={completedAgents}
        />
      </div>
    );
  }

  if (msg.role === 'question') {
    return (
      <div className="flex items-start gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary mt-0.5">
          <SparklesIcon className="size-3.5" />
        </div>
        <QuestionBubble
          msg={msg}
          onAnswer={(selected) => onAnswerQuestion(msg.id, selected)}
        />
      </div>
    );
  }

  if (msg.role === 'media_plan') {
    return (
      <div className="flex items-start gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary mt-0.5">
          <SparklesIcon className="size-3.5" />
        </div>
        <MediaPlanCardInline plan={msg.plan} onPreview={onPreview} />
      </div>
    );
  }

  return null;
}

// ── Agent Progress Card (in chat) ─────────────────────────────────────────────

function AgentProgressCard({
  agents,
  completedAgents
}: {
  agents: AgentState[];
  completedAgents: number;
}): React.JSX.Element {
  const total = agents.length;
  const progressPercent = total > 0 ? (completedAgents / total) * 100 : 0;

  return (
    <div className="rounded-xl border border-border bg-card p-3 w-full max-w-xs space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground">Agents Working</p>
        <span className="text-xs text-muted-foreground">
          {completedAgents} of {total} completed
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-1">
        {agents.map((a) => (
          <span
            key={a.name}
            className={cn(
              'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
              a.status === 'complete' && 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
              a.status === 'running' && 'bg-primary/10 text-primary',
              a.status === 'idle' && 'bg-muted text-muted-foreground',
              a.status === 'error' && 'bg-destructive/10 text-destructive'
            )}
          >
            {a.icon}
            {a.status === 'complete' && <CheckIcon className="size-2.5" />}
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Question Bubble ───────────────────────────────────────────────────────────

function QuestionBubble({
  msg,
  onAnswer
}: {
  msg: Extract<ChatMessage, { role: 'question' }>;
  onAnswer: (selected: string[]) => void;
}): React.JSX.Element {
  const [localSelected, setLocalSelected] = React.useState<string[]>(msg.selected);

  const toggle = (option: string) => {
    if (msg.answered) return;
    if (msg.questionType === 'checkbox') {
      setLocalSelected((prev) =>
        prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option]
      );
    } else {
      setLocalSelected([option]);
      // For radio, submit immediately
      onAnswer([option]);
    }
  };

  const handleSubmit = () => {
    if (localSelected.length === 0) return;
    onAnswer(localSelected);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-3 space-y-2.5 max-w-xs w-full">
      <p className="text-sm text-foreground font-medium">{msg.question}</p>
      <div className="flex flex-wrap gap-1.5">
        {msg.options.map((opt) => (
          <button
            key={opt}
            type="button"
            disabled={msg.answered}
            onClick={() => toggle(opt)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              localSelected.includes(opt)
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground',
              msg.answered && 'cursor-not-allowed opacity-70'
            )}
          >
            {localSelected.includes(opt) && <CheckIcon className="size-2.5 inline mr-1" />}
            {opt}
          </button>
        ))}
      </div>
      {msg.questionType === 'checkbox' && !msg.answered && localSelected.length > 0 && (
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={handleSubmit}
        >
          Confirm
        </Button>
      )}
      {msg.answered && (
        <p className="text-xs text-muted-foreground">
          Selected: {msg.selected.join(', ')}
        </p>
      )}
    </div>
  );
}

// ── Media Plan Card (inline in chat) ─────────────────────────────────────────

function MediaPlanCardInline({
  plan,
  onPreview
}: {
  plan: MediaPlan;
  onPreview: () => void;
}): React.JSX.Element {
  return <MediaPlanCard plan={plan} onPreview={onPreview} />;
}
