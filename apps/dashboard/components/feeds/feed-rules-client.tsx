'use client';

import * as React from 'react';
import {
  PlusIcon,
  SaveIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react';

import { Badge } from '@workspace/ui/components/badge';
import { Button } from '@workspace/ui/components/button';
import { Card, CardContent } from '@workspace/ui/components/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@workspace/ui/components/dialog';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import { Switch } from '@workspace/ui/components/switch';
import { toast } from '@workspace/ui/components/sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Condition {
  field: string;
  operator: string;
  value: string;
}

interface Action {
  type: string;
  field: string;
  value: string;
}

interface FeedRule {
  id: string;
  name: string;
  priority: number;
  conditions: Condition[];
  actions: Action[];
  is_active: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AVAILABLE_FIELDS = [
  'title',
  'description',
  'price',
  'brand',
  'google_category',
  'custom_labels.best_seller',
  'custom_labels.trending',
  'inventory_qty',
];

const AVAILABLE_OPERATORS = [
  'equals',
  'contains',
  'starts_with',
  'length_lt',
  'length_gt',
  'greater_than',
  'less_than',
];

const AVAILABLE_ACTION_TYPES = [
  'set_label',
  'prepend',
  'append',
  'replace',
  'set_category',
];

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_RULES: FeedRule[] = [
  {
    id: 'rule-1',
    name: 'Best Sellers Label',
    priority: 1,
    conditions: [
      { field: 'custom_labels.best_seller', operator: 'equals', value: 'true' },
    ],
    actions: [
      { type: 'set_label', field: 'label_0', value: 'best_seller' },
    ],
    is_active: true,
  },
  {
    id: 'rule-2',
    name: 'Optimize Short Titles',
    priority: 2,
    conditions: [
      { field: 'title', operator: 'length_lt', value: '30' },
    ],
    actions: [
      { type: 'append', field: 'title', value: ' — Buy Now' },
    ],
    is_active: true,
  },
];

const FEED_NAMES: Record<string, string> = {
  'feed-1': 'Google Shopping Feed',
  'feed-2': 'Meta Product Catalog',
  'feed-3': 'Bing Merchant Center',
};

// ---------------------------------------------------------------------------
// Add Rule Dialog
// ---------------------------------------------------------------------------

interface AddRuleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nextPriority: number;
  onSaved: (rule: FeedRule) => void;
}

function AddRuleDialog({
  open,
  onOpenChange,
  nextPriority,
  onSaved,
}: AddRuleDialogProps): React.JSX.Element {
  const [name, setName] = React.useState('');
  const [priority, setPriority] = React.useState(String(nextPriority));
  const [conditions, setConditions] = React.useState<Condition[]>([
    { field: '', operator: '', value: '' },
  ]);
  const [actions, setActions] = React.useState<Action[]>([
    { type: '', field: '', value: '' },
  ]);

  React.useEffect(() => {
    if (open) setPriority(String(nextPriority));
  }, [open, nextPriority]);

  function updateCondition(idx: number, key: keyof Condition, val: string): void {
    setConditions((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, [key]: val } : c))
    );
  }

  function addCondition(): void {
    setConditions((prev) => [...prev, { field: '', operator: '', value: '' }]);
  }

  function removeCondition(idx: number): void {
    setConditions((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateAction(idx: number, key: keyof Action, val: string): void {
    setActions((prev) =>
      prev.map((a, i) => (i === idx ? { ...a, [key]: val } : a))
    );
  }

  function addAction(): void {
    setActions((prev) => [...prev, { type: '', field: '', value: '' }]);
  }

  function removeAction(idx: number): void {
    setActions((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSave(): void {
    if (!name) return;
    const rule: FeedRule = {
      id: `rule-${Date.now()}`,
      name,
      priority: Number(priority) || nextPriority,
      conditions,
      actions,
      is_active: true,
    };
    onSaved(rule);
    setName('');
    setPriority(String(nextPriority));
    setConditions([{ field: '', operator: '', value: '' }]);
    setActions([{ type: '', field: '', value: '' }]);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Rule</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Name + priority */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label>Rule name</Label>
              <Input
                placeholder="e.g. Best Sellers Label"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Input
                type="number"
                min={1}
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              />
            </div>
          </div>

          {/* Conditions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Conditions</Label>
              <Button type="button" size="sm" variant="ghost" onClick={addCondition}>
                <PlusIcon className="mr-1 size-3.5" />
                Add Condition
              </Button>
            </div>
            {conditions.map((cond, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Select
                  value={cond.field}
                  onValueChange={(v) => updateCondition(idx, 'field', v)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Field" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_FIELDS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={cond.operator}
                  onValueChange={(v) => updateCondition(idx, 'operator', v)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Op" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_OPERATORS.map((op) => (
                      <SelectItem key={op} value={op}>
                        {op}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="w-24"
                  placeholder="Value"
                  value={cond.value}
                  onChange={(e) => updateCondition(idx, 'value', e.target.value)}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => removeCondition(idx)}
                  disabled={conditions.length === 1}
                >
                  <XIcon className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Actions</Label>
              <Button type="button" size="sm" variant="ghost" onClick={addAction}>
                <PlusIcon className="mr-1 size-3.5" />
                Add Action
              </Button>
            </div>
            {actions.map((act, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Select
                  value={act.type}
                  onValueChange={(v) => updateAction(idx, 'type', v)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Action" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_ACTION_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={act.field}
                  onValueChange={(v) => updateAction(idx, 'field', v)}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Field" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_FIELDS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="w-28"
                  placeholder="Value"
                  value={act.value}
                  onChange={(e) => updateAction(idx, 'value', e.target.value)}
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => removeAction(idx)}
                  disabled={actions.length === 1}
                >
                  <XIcon className="size-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name}>
            Save Rule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Rule card
// ---------------------------------------------------------------------------

interface RuleCardProps {
  rule: FeedRule;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

function RuleCard({ rule, onToggle, onDelete }: RuleCardProps): React.JSX.Element {
  return (
    <Card className="border bg-white">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2 flex-1 min-w-0">
            {/* Header */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">{rule.name}</span>
              <Badge variant="outline" className="text-xs">
                Priority {rule.priority}
              </Badge>
            </div>

            {/* Conditions chips */}
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Conditions
              </p>
              <div className="flex flex-wrap gap-1.5">
                {rule.conditions.map((c, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center rounded-full border bg-muted/50 px-2.5 py-0.5 text-xs"
                  >
                    {c.field} <span className="mx-1 text-muted-foreground">{c.operator}</span>{' '}
                    <strong>{c.value}</strong>
                  </span>
                ))}
              </div>
            </div>

            {/* Actions chips */}
            <div className="space-y-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Actions
              </p>
              <div className="flex flex-wrap gap-1.5">
                {rule.actions.map((a, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-xs text-violet-700"
                  >
                    {a.type}:{' '}
                    <span className="mx-1 font-medium">{a.field}</span> ={' '}
                    <strong className="ml-1">{a.value}</strong>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="flex shrink-0 items-center gap-2">
            <Switch
              checked={rule.is_active}
              onCheckedChange={() => onToggle(rule.id)}
              aria-label="Toggle rule"
            />
            <Button
              size="icon"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => onDelete(rule.id)}
            >
              <Trash2Icon className="size-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

interface FeedRulesClientProps {
  feedId: string;
  orgId: string;
  orgSlug: string;
}

export function FeedRulesClient({
  feedId,
  orgId,
  orgSlug,
}: FeedRulesClientProps): React.JSX.Element {
  const [rules, setRules] = React.useState<FeedRule[]>(MOCK_RULES);
  const [addOpen, setAddOpen] = React.useState(false);

  const feedName = FEED_NAMES[feedId] ?? 'Feed';

  function handleToggle(id: string): void {
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, is_active: !r.is_active } : r))
    );
  }

  function handleDelete(id: string): void {
    setRules((prev) => prev.filter((r) => r.id !== id));
    toast.success('Rule deleted');
  }

  function handleSaveChanges(): void {
    toast.success('Rules saved', { description: 'Your feed rules have been updated.' });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-xl font-semibold">Feed Rules</h2>
          <Badge variant="secondary">{feedName}</Badge>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <PlusIcon className="mr-1.5 size-4" />
          Add Rule
        </Button>
      </div>

      {/* Rule list */}
      {rules.length === 0 ? (
        <Card className="border bg-white">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-muted-foreground">
              No rules yet. Add a rule to start transforming your feed.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Save Changes */}
      <div className="flex justify-end border-t pt-4">
        <Button onClick={handleSaveChanges}>
          <SaveIcon className="mr-1.5 size-4" />
          Save Changes
        </Button>
      </div>

      <AddRuleDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        nextPriority={rules.length + 1}
        onSaved={(rule) => setRules((prev) => [...prev, rule])}
      />
    </div>
  );
}
