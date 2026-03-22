'use client';

import * as React from 'react';
import {
  BrainIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  EditIcon,
  SaveIcon,
  ShieldCheckIcon,
  Trash2Icon,
  XIcon
} from 'lucide-react';
import { Button } from '@workspace/ui/components/button';
import { cn } from '@workspace/ui/lib/utils';

type MemoryNode = {
  id: string;
  orgId: string;
  userId: string | null;
  type: string;
  key: string;
  summary: string;
  content: Record<string, unknown>;
  confidence: number;
  accessCount: number;
  sourceUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

const TYPE_LABELS: Record<string, string> = {
  brand_profile: 'Brand Profile',
  lpu_profile: 'Landing Page Profile',
  campaign_preference: 'Campaign Preferences',
  competitor_snapshot: 'Competitor Intelligence',
  trend_snapshot: 'Trend Signals',
  media_plan_feedback: 'Media Plan Feedback',
  seasonal_intent: 'Seasonal Campaigns',
  creative_preference: 'Creative Preferences'
};

const TYPE_DESCRIPTIONS: Record<string, string> = {
  brand_profile: 'Brand colors, tone, industry, and country detected from your website',
  lpu_profile: 'Landing page quality signals, pixel status, and trust indicators',
  campaign_preference: 'Your typical campaign settings — platform, budget, duration',
  competitor_snapshot: 'Competitive landscape and market positioning data',
  trend_snapshot: 'Current industry trends and seasonal signals (refreshed monthly)',
  media_plan_feedback: 'How you typically modify AI-generated media plans',
  seasonal_intent: 'Seasonal campaigns you\'ve created (Diwali, Holi, etc.)',
  creative_preference: 'Which creative styles and messaging you prefer'
};

const CONFIDENCE_COLOR = (confidence: number) => {
  if (confidence >= 0.8) return 'text-green-600 bg-green-50';
  if (confidence >= 0.5) return 'text-yellow-600 bg-yellow-50';
  return 'text-red-600 bg-red-50';
};

export function MemoryProfile({
  orgId,
  orgName
}: {
  orgId: string;
  orgName: string;
}): React.JSX.Element {
  const [nodes, setNodes] = React.useState<MemoryNode[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [expandedTypes, setExpandedTypes] = React.useState<Set<string>>(new Set(['brand_profile', 'campaign_preference']));
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [editContent, setEditContent] = React.useState('');

  React.useEffect(() => {
    void loadNodes();
  }, [orgId]);

  async function loadNodes() {
    setLoading(true);
    try {
      const res = await fetch(`/api/memory/nodes?orgId=${orgId}`);
      if (res.ok) {
        const data = await res.json() as { nodes: MemoryNode[] };
        setNodes(data.nodes);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(node: MemoryNode) {
    if (!confirm(`Delete "${node.summary.slice(0, 60)}..."? This cannot be undone.`)) return;
    await fetch(`/api/memory/nodes?id=${node.id}&orgId=${orgId}`, { method: 'DELETE' });
    setNodes((prev) => prev.filter((n) => n.id !== node.id));
  }

  async function handleSaveEdit(node: MemoryNode) {
    try {
      const parsed = JSON.parse(editContent) as Record<string, unknown>;
      await fetch('/api/memory/nodes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: node.id, orgId, content: parsed, summary: node.summary })
      });
      setNodes((prev) => prev.map((n) => n.id === node.id ? { ...n, content: parsed } : n));
      setEditingId(null);
    } catch {
      alert('Invalid JSON — please fix the content before saving.');
    }
  }

  const grouped = nodes.reduce<Record<string, MemoryNode[]>>((acc, node) => {
    (acc[node.type] ??= []).push(node);
    return acc;
  }, {});

  const toggleType = (type: string) => {
    setExpandedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">
          <BrainIcon className="size-5 text-primary" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">AI Memory</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            What Accelerate AI has learned about <strong>{orgName}</strong>. Edit or delete any node to correct the AI's understanding.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : nodes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <BrainIcon className="size-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No memory yet. Create a campaign to start building AI context.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(TYPE_LABELS).map(([type, label]) => {
            const typeNodes = grouped[type] ?? [];
            if (typeNodes.length === 0) return null;
            const isExpanded = expandedTypes.has(type);
            return (
              <div key={type} className="rounded-xl border border-border bg-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleType(type)}
                  className="flex w-full items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-accent transition-colors"
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronDownIcon className="size-4 text-muted-foreground" /> : <ChevronRightIcon className="size-4 text-muted-foreground" />}
                    <span>{label}</span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      {typeNodes.length}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">{TYPE_DESCRIPTIONS[type]}</span>
                </button>

                {isExpanded && (
                  <div className="border-t border-border divide-y divide-border">
                    {typeNodes.map((node) => (
                      <div key={node.id} className="px-4 py-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-foreground leading-relaxed">{node.summary}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-medium', CONFIDENCE_COLOR(node.confidence))}>
                                {Math.round(node.confidence * 100)}% confidence
                              </span>
                              {node.userId ? (
                                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">User-level</span>
                              ) : (
                                <span className="flex items-center gap-0.5 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] text-blue-600">
                                  <ShieldCheckIcon className="size-2.5" /> Org-level
                                </span>
                              )}
                              <span className="text-[10px] text-muted-foreground">
                                Updated {new Date(node.updatedAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(node.id);
                                setEditContent(JSON.stringify(node.content, null, 2));
                              }}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                            >
                              <EditIcon className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDelete(node)}
                              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                            >
                              <Trash2Icon className="size-3.5" />
                            </button>
                          </div>
                        </div>

                        {editingId === node.id && (
                          <div className="space-y-2">
                            <textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              rows={8}
                              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono text-foreground resize-y focus:outline-none focus:ring-2 focus:ring-primary/30"
                            />
                            <div className="flex gap-2">
                              <Button size="sm" className="gap-1.5 text-xs" onClick={() => void handleSaveEdit(node)}>
                                <SaveIcon className="size-3" /> Save
                              </Button>
                              <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setEditingId(null)}>
                                <XIcon className="size-3" /> Cancel
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
