'use client';

import * as React from 'react';
import { formatDistanceToNow } from 'date-fns';
import {
  ChevronDownIcon,
  Loader2Icon,
  PlusIcon,
  Trash2Icon,
  UsersIcon,
  ZapIcon
} from 'lucide-react';

import { Badge } from '@workspace/ui/components/badge';
import { Button } from '@workspace/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@workspace/ui/components/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@workspace/ui/components/dialog';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@workspace/ui/components/select';
import { toast } from '@workspace/ui/components/sonner';

// ── Rule field / operator config ─────────────────────────────────────────────

const RULE_FIELDS = [
  { value: 'total_spend', label: 'Total Spend', type: 'number' },
  { value: 'order_count', label: 'Order Count', type: 'number' },
  { value: 'aov', label: 'Avg Order Value', type: 'number' },
  { value: 'last_order_days_ago', label: 'Last Order (days ago)', type: 'number' },
  { value: 'first_order_days_ago', label: 'First Order (days ago)', type: 'number' },
  { value: 'is_vip', label: 'Is VIP', type: 'boolean' },
  { value: 'is_lapsed', label: 'Is Lapsed', type: 'boolean' },
  { value: 'email_domain', label: 'Email Domain', type: 'string' },
  { value: 'tags_contains', label: 'Has Tag', type: 'string' },
];

const OPERATORS_BY_TYPE: Record<string, { value: string; label: string }[]> = {
  number: [
    { value: 'gte', label: '>=' },
    { value: 'lte', label: '<=' },
    { value: 'gt', label: '>' },
    { value: 'lt', label: '<' },
    { value: 'eq', label: '=' },
  ],
  boolean: [{ value: 'eq', label: 'is' }],
  string: [
    { value: 'eq', label: 'equals' },
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: "doesn't contain" },
  ],
};

// ── Types ────────────────────────────────────────────────────────────────────

type SegmentRule = {
  field: string;
  operator: string;
  value: string | number | boolean;
};

type Segment = {
  id: string;
  name: string;
  description: string | null;
  type: string;
  rules: SegmentRule[];
  ruleLogic: string;
  estimatedSize: number | null;
  syncStatus: string;
  syncedPlatforms: string[];
  lastSyncAt: string | null;
  member_count: number;
};

type Props = {
  orgId: string;
};

// ── Component ────────────────────────────────────────────────────────────────

export function SegmentsClient({ orgId }: Props): React.JSX.Element {
  const [segments, setSegments] = React.useState<Segment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showCreate, setShowCreate] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [computingId, setComputingId] = React.useState<string | null>(null);
  const [note, setNote] = React.useState('');

  React.useEffect(() => {
    void fetchSegments();
  }, []);

  async function fetchSegments(): Promise<void> {
    setLoading(true);
    try {
      const res = await fetch('/api/cdp/segments');
      if (res.ok) {
        const data = await res.json();
        setSegments(data.segments ?? []);
        if (data.note) setNote(data.note);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string): Promise<void> {
    setDeletingId(id);
    try {
      const res = await fetch('/api/cdp/segments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setSegments((prev) => prev.filter((s) => s.id !== id));
        toast.success('Segment deleted');
      } else {
        toast.error('Failed to delete segment');
      }
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCompute(segmentId: string): Promise<void> {
    setComputingId(segmentId);
    try {
      const res = await fetch(`/api/cdp/segments/${segmentId}/compute`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Computed ${data.members_computed ?? 0} members`);
        void fetchSegments();
      } else {
        toast.error('Failed to compute segment');
      }
    } finally {
      setComputingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {note && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/30 dark:bg-amber-900/20 dark:text-amber-400">
          {note} — CDP service not yet deployed.
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Build audience segments using rule chains. Sync to Meta, Google, or Bing audiences.
        </p>
        <Button onClick={() => setShowCreate(true)}>
          <PlusIcon className="mr-2 size-4" />
          New Segment
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : segments.length === 0 ? (
        <EmptyState onAdd={() => setShowCreate(true)} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {segments.map((seg) => (
            <SegmentCard
              key={seg.id}
              segment={seg}
              onDelete={handleDelete}
              onCompute={handleCompute}
              isDeleting={deletingId === seg.id}
              isComputing={computingId === seg.id}
            />
          ))}
        </div>
      )}

      <CreateSegmentDialog
        open={showCreate}
        orgId={orgId}
        onClose={() => setShowCreate(false)}
        onCreated={() => { setShowCreate(false); void fetchSegments(); }}
      />
    </div>
  );
}

// ── Segment card ─────────────────────────────────────────────────────────────

function SegmentCard({
  segment: seg,
  onDelete,
  onCompute,
  isDeleting,
  isComputing,
}: {
  segment: Segment;
  onDelete: (id: string) => Promise<void>;
  onCompute: (id: string) => Promise<void>;
  isDeleting: boolean;
  isComputing: boolean;
}): React.JSX.Element {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-medium leading-snug truncate">
              {seg.name}
            </CardTitle>
            {seg.description && (
              <CardDescription className="text-xs mt-0.5 line-clamp-2">
                {seg.description}
              </CardDescription>
            )}
          </div>
          <TypeBadge type={seg.type} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Member count */}
        <div className="flex items-center gap-2 text-sm">
          <UsersIcon className="size-4 text-muted-foreground" />
          <span className="tabular-nums font-medium">{seg.member_count.toLocaleString()}</span>
          <span className="text-muted-foreground">members</span>
          {seg.estimatedSize !== null && seg.estimatedSize !== seg.member_count && (
            <span className="text-xs text-muted-foreground ml-auto">
              ~{seg.estimatedSize.toLocaleString()} estimated
            </span>
          )}
        </div>

        {/* Rules preview */}
        {seg.rules.length > 0 && (
          <div className="rounded-lg bg-muted/50 p-2 space-y-1">
            {seg.rules.slice(0, 3).map((rule, i) => (
              <div key={i} className="text-xs text-muted-foreground font-mono">
                {i > 0 && (
                  <span className="mr-1 text-primary font-medium">{seg.ruleLogic}</span>
                )}
                {rule.field} {rule.operator} {String(rule.value)}
              </div>
            ))}
            {seg.rules.length > 3 && (
              <p className="text-xs text-muted-foreground">+{seg.rules.length - 3} more rules</p>
            )}
          </div>
        )}

        {/* Synced platforms */}
        {seg.syncedPlatforms.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {seg.syncedPlatforms.map((p) => (
              <Badge key={p} variant="outline" className="text-xs capitalize">
                {p}
              </Badge>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted-foreground">
            {seg.lastSyncAt
              ? `Synced ${formatDistanceToNow(new Date(seg.lastSyncAt), { addSuffix: true })}`
              : 'Never computed'}
          </span>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void onCompute(seg.id)}
              disabled={isComputing}
              title="Re-compute membership"
            >
              {isComputing ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <ZapIcon className="size-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => void onDelete(seg.id)}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <Trash2Icon className="size-4" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TypeBadge({ type }: { type: string }): React.JSX.Element {
  const map: Record<string, string> = {
    retarget: 'border-blue-500/30 bg-blue-500/10 text-blue-600',
    lookalike: 'border-purple-500/30 bg-purple-500/10 text-purple-600',
    suppression: 'border-red-500/30 bg-red-500/10 text-red-600',
    custom: 'text-muted-foreground',
  };
  return (
    <Badge variant="outline" className={`text-xs capitalize ${map[type] ?? ''}`}>
      {type}
    </Badge>
  );
}

// ── Create segment dialog / rule builder ─────────────────────────────────────

function CreateSegmentDialog({
  open,
  orgId,
  onClose,
  onCreated,
}: {
  open: boolean;
  orgId: string;
  onClose: () => void;
  onCreated: () => void;
}): React.JSX.Element {
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [type, setType] = React.useState('custom');
  const [ruleLogic, setRuleLogic] = React.useState('AND');
  const [rules, setRules] = React.useState<SegmentRule[]>([
    { field: 'order_count', operator: 'gte', value: '1' },
  ]);
  const [saving, setSaving] = React.useState(false);

  function addRule(): void {
    setRules((prev) => [...prev, { field: 'total_spend', operator: 'gte', value: '0' }]);
  }

  function removeRule(i: number): void {
    setRules((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updateRule(i: number, patch: Partial<SegmentRule>): void {
    setRules((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function handleSave(): Promise<void> {
    if (!name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/cdp/segments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, type, rule_logic: ruleLogic, rules }),
      });
      if (res.ok) {
        toast.success('Segment created');
        setName(''); setDescription(''); setRules([{ field: 'order_count', operator: 'gte', value: '1' }]);
        onCreated();
      } else {
        const err = await res.json();
        toast.error(err.error ?? 'Failed to create segment');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Segment</DialogTitle>
          <DialogDescription>
            Define audience rules to build a targeted segment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name & description */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input placeholder="e.g. High-value VIPs" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom</SelectItem>
                  <SelectItem value="retarget">Retarget</SelectItem>
                  <SelectItem value="lookalike">Lookalike</SelectItem>
                  <SelectItem value="suppression">Suppression</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Input placeholder="Describe this segment" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          {/* Rules */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Rules</Label>
              <Select value={ruleLogic} onValueChange={setRuleLogic}>
                <SelectTrigger className="w-24 h-7 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AND">Match ALL</SelectItem>
                  <SelectItem value="OR">Match ANY</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              {rules.map((rule, i) => (
                <RuleRow
                  key={i}
                  rule={rule}
                  index={i}
                  ruleLogic={ruleLogic}
                  total={rules.length}
                  onChange={(patch) => updateRule(i, patch)}
                  onRemove={() => removeRule(i)}
                />
              ))}
            </div>

            <Button variant="outline" size="sm" onClick={addRule}>
              <PlusIcon className="mr-1.5 size-3.5" />
              Add Rule
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => void handleSave()} disabled={saving}>
            {saving && <Loader2Icon className="mr-2 size-4 animate-spin" />}
            Create Segment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RuleRow({
  rule,
  index,
  ruleLogic,
  total,
  onChange,
  onRemove,
}: {
  rule: SegmentRule;
  index: number;
  ruleLogic: string;
  total: number;
  onChange: (patch: Partial<SegmentRule>) => void;
  onRemove: () => void;
}): React.JSX.Element {
  const fieldDef = RULE_FIELDS.find((f) => f.value === rule.field);
  const operators = OPERATORS_BY_TYPE[fieldDef?.type ?? 'number'] ?? OPERATORS_BY_TYPE.number;

  return (
    <div className="flex items-center gap-2">
      {index > 0 && (
        <span className="w-10 shrink-0 text-center text-xs font-medium text-primary">{ruleLogic}</span>
      )}
      {index === 0 && <span className="w-10 shrink-0 text-center text-xs text-muted-foreground">IF</span>}

      {/* Field */}
      <Select value={rule.field} onValueChange={(v) => {
        const newField = RULE_FIELDS.find((f) => f.value === v);
        const newOps = OPERATORS_BY_TYPE[newField?.type ?? 'number'] ?? OPERATORS_BY_TYPE.number;
        onChange({ field: v, operator: newOps[0]?.value ?? 'eq', value: newField?.type === 'boolean' ? 'true' : '' });
      }}>
        <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
        <SelectContent>
          {RULE_FIELDS.map((f) => (
            <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Operator */}
      <Select value={rule.operator} onValueChange={(v) => onChange({ operator: v })}>
        <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
        <SelectContent>
          {operators.map((op) => (
            <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Value */}
      {fieldDef?.type === 'boolean' ? (
        <Select value={String(rule.value)} onValueChange={(v) => onChange({ value: v })}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Yes</SelectItem>
            <SelectItem value="false">No</SelectItem>
          </SelectContent>
        </Select>
      ) : (
        <Input
          className="w-32"
          placeholder="Value"
          value={String(rule.value)}
          onChange={(e) => onChange({ value: e.target.value })}
        />
      )}

      {total > 1 && (
        <Button variant="ghost" size="icon" className="shrink-0 size-8 text-muted-foreground hover:text-destructive" onClick={onRemove}>
          <Trash2Icon className="size-3.5" />
        </Button>
      )}
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center">
      <UsersIcon className="mb-4 size-12 text-muted-foreground/40" />
      <h3 className="mb-1 text-sm font-medium">No segments yet</h3>
      <p className="mb-6 max-w-xs text-sm text-muted-foreground">
        Create a segment with rule chains to target specific audiences.
      </p>
      <Button onClick={onAdd}>
        <PlusIcon className="mr-2 size-4" />
        New Segment
      </Button>
    </div>
  );
}
