'use client';

import * as React from 'react';
import {
  ChevronRightIcon,
  CodeIcon,
  ExternalLinkIcon,
  FlaskConicalIcon,
  PlusIcon,
  SparklesIcon,
  Trash2Icon,
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
import { Slider } from '@workspace/ui/components/slider';
import { Textarea } from '@workspace/ui/components/textarea';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Variant {
  id: string;
  name: string;
  html: string;
  isControl: boolean;
}

interface Zone {
  id: string;
  name: string;
  selector: string;
  defaultHtml: string;
  variants: Variant[];
}

// ---------------------------------------------------------------------------
// Mock data — TODO: replace with real API call to /api/personalization/pages/{pageId}/zones
// ---------------------------------------------------------------------------

const MOCK_ZONES: Zone[] = [
  {
    id: 'z1',
    name: 'Hero Headline',
    selector: '#hero h1',
    defaultHtml: '<h1>Welcome to our store</h1>',
    variants: [
      {
        id: 'v1',
        name: 'Control',
        html: '<h1>Welcome to our store</h1>',
        isControl: true,
      },
      {
        id: 'v2',
        name: 'Urgency variant',
        html: '<h1>Limited Time: Free Shipping Today</h1>',
        isControl: false,
      },
    ],
  },
  {
    id: 'z2',
    name: 'CTA Button',
    selector: '.hero-cta',
    defaultHtml: '<button>Shop Now</button>',
    variants: [
      {
        id: 'v3',
        name: 'Control',
        html: '<button>Shop Now</button>',
        isControl: true,
      },
    ],
  },
];

const AI_GENERATED_VARIANTS: Record<string, string> = {
  z1: '<h1>Shop the Latest Trends — Free Returns</h1>',
  z2: '<button class="cta-urgent">Get Yours Today →</button>',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PersonalizationEditorClientProps {
  orgId: string;
  orgSlug: string;
  pageId?: string;
}

// ---------------------------------------------------------------------------
// Add Zone Dialog
// ---------------------------------------------------------------------------

function AddZoneDialog({ onAdd }: { onAdd: (zone: Omit<Zone, 'id' | 'variants'>) => void }) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [selector, setSelector] = React.useState('');
  const [defaultHtml, setDefaultHtml] = React.useState('');

  function handleSave() {
    if (!name.trim() || !selector.trim()) return;
    onAdd({ name: name.trim(), selector: selector.trim(), defaultHtml: defaultHtml.trim() });
    setName('');
    setSelector('');
    setDefaultHtml('');
    setOpen(false);
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="gap-1.5 w-full mt-3"
        onClick={() => setOpen(true)}
      >
        <PlusIcon className="h-3.5 w-3.5" />
        Add Zone
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Define a New Zone</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="zone-name">Zone Name</Label>
              <Input
                id="zone-name"
                placeholder="e.g. Hero Headline"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="zone-selector">CSS Selector</Label>
              <Input
                id="zone-selector"
                placeholder="e.g. #hero h1"
                value={selector}
                onChange={(e) => setSelector(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="zone-html">Default HTML</Label>
              <Textarea
                id="zone-html"
                placeholder="<h1>Your default content</h1>"
                value={defaultHtml}
                onChange={(e) => setDefaultHtml(e.target.value)}
                rows={4}
                className="font-mono text-sm resize-none"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-blue-500 hover:bg-blue-600 text-white"
              onClick={handleSave}
              disabled={!name.trim() || !selector.trim()}
            >
              Save Zone
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ---------------------------------------------------------------------------
// Create Experiment Dialog
// ---------------------------------------------------------------------------

function CreateExperimentDialog({
  zoneName,
  open,
  onOpenChange,
  onConfirm,
}: {
  zoneName: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: (name: string, split: number, mode: 'random' | 'bandit') => void;
}) {
  const [expName, setExpName] = React.useState(`${zoneName} Test`);
  const [split, setSplit] = React.useState(50);
  const [mode, setMode] = React.useState<'random' | 'bandit'>('random');

  function handleCreate() {
    if (!expName.trim()) return;
    onConfirm(expName.trim(), split, mode);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create Experiment from Zone</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-5 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="exp-name">Experiment Name</Label>
            <Input
              id="exp-name"
              value={expName}
              onChange={(e) => setExpName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Traffic Split — {split}% to variant</Label>
            <Slider
              min={10}
              max={90}
              step={5}
              value={[split]}
              onValueChange={([v]) => setSplit(v)}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Control {100 - split}%</span>
              <span>Variant {split}%</span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label>Allocation Mode</Label>
            <div className="flex gap-3">
              {(['random', 'bandit'] as const).map((m) => (
                <label
                  key={m}
                  className={`flex flex-1 cursor-pointer items-center justify-center rounded-lg border px-4 py-3 text-sm font-medium transition-colors ${
                    mode === m
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 text-muted-foreground hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    value={m}
                    checked={mode === m}
                    onChange={() => setMode(m)}
                  />
                  {m === 'random' ? 'Random Split' : 'Bandit (Thompson Sampling)'}
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-blue-500 hover:bg-blue-600 text-white"
            onClick={handleCreate}
            disabled={!expName.trim()}
          >
            Create & Start
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PersonalizationEditorClient({
  orgId,
  orgSlug,
  pageId,
}: PersonalizationEditorClientProps) {
  // TODO: fetch page + zones from /api/personalization/pages/${pageId}/zones
  const [zones, setZones] = React.useState<Zone[]>(MOCK_ZONES);
  const [selectedZoneId, setSelectedZoneId] = React.useState<string | null>(MOCK_ZONES[0]?.id ?? null);
  const [pageUrl, setPageUrl] = React.useState('https://example.com');
  const [aiLoadingZoneId, setAiLoadingZoneId] = React.useState<string | null>(null);
  const [createExpZone, setCreateExpZone] = React.useState<Zone | null>(null);
  const [expCreatedMessage, setExpCreatedMessage] = React.useState<string | null>(null);

  const selectedZone = zones.find((z) => z.id === selectedZoneId) ?? null;

  function handleAddZone(data: Omit<Zone, 'id' | 'variants'>) {
    const newZone: Zone = {
      ...data,
      id: `z${Date.now()}`,
      variants: [
        {
          id: `v${Date.now()}`,
          name: 'Control',
          html: data.defaultHtml,
          isControl: true,
        },
      ],
    };
    setZones((prev) => [...prev, newZone]);
    setSelectedZoneId(newZone.id);
  }

  function handleAddVariant(zoneId: string) {
    const variantHtml = '<p>New variant content</p>';
    const newVariant: Variant = {
      id: `v${Date.now()}`,
      name: `Variant ${Date.now().toString().slice(-4)}`,
      html: variantHtml,
      isControl: false,
    };
    setZones((prev) =>
      prev.map((z) =>
        z.id === zoneId ? { ...z, variants: [...z.variants, newVariant] } : z
      )
    );
  }

  async function handleGenerateAI(zone: Zone) {
    setAiLoadingZoneId(zone.id);
    // Simulate AI generation delay
    await new Promise((r) => setTimeout(r, 1500));
    const generatedHtml = AI_GENERATED_VARIANTS[zone.id] ?? `<p>AI-generated content for ${zone.name}</p>`;
    const aiVariant: Variant = {
      id: `v-ai-${Date.now()}`,
      name: 'AI Generated',
      html: generatedHtml,
      isControl: false,
    };
    setZones((prev) =>
      prev.map((z) =>
        z.id === zone.id ? { ...z, variants: [...z.variants, aiVariant] } : z
      )
    );
    setAiLoadingZoneId(null);
  }

  function handleCreateExperiment(name: string, split: number, mode: 'random' | 'bandit') {
    setExpCreatedMessage(`Experiment "${name}" created with ${split}% traffic using ${mode} allocation.`);
    setTimeout(() => setExpCreatedMessage(null), 4000);
  }

  function handleDeleteVariant(zoneId: string, variantId: string) {
    setZones((prev) =>
      prev.map((z) =>
        z.id === zoneId
          ? { ...z, variants: z.variants.filter((v) => v.id !== variantId) }
          : z
      )
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* URL Bar */}
      <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
        <Input
          value={pageUrl}
          onChange={(e) => setPageUrl(e.target.value)}
          className="flex-1 font-mono text-sm border-0 shadow-none focus-visible:ring-0 bg-transparent"
          placeholder="https://example.com"
        />
        <a href={pageUrl} target="_blank" rel="noopener noreferrer">
          <Button size="sm" variant="outline" className="gap-1.5 shrink-0">
            <ExternalLinkIcon className="h-3.5 w-3.5" />
            Preview
          </Button>
        </a>
      </div>

      {/* Success message */}
      {expCreatedMessage && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          {expCreatedMessage}
        </div>
      )}

      {/* Two-column layout */}
      <div className="flex gap-4 min-h-[560px]">
        {/* Left panel — Zone list (40%) */}
        <div className="w-[40%] flex flex-col gap-2">
          <Card className="flex-1 rounded-xl shadow-sm overflow-hidden">
            <div className="border-b border-gray-100 bg-gray-50 px-4 py-3">
              <p className="text-sm font-medium text-foreground">Zones</p>
              <p className="text-xs text-muted-foreground mt-0.5">Click a zone to edit variants</p>
            </div>
            <div className="flex flex-col divide-y divide-gray-100">
              {zones.map((zone) => (
                <button
                  key={zone.id}
                  className={`flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                    selectedZoneId === zone.id ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                  }`}
                  onClick={() => setSelectedZoneId(zone.id)}
                >
                  <div className="flex flex-1 flex-col gap-0.5 min-w-0">
                    <span
                      className={`text-sm font-medium truncate ${
                        selectedZoneId === zone.id ? 'text-blue-700' : 'text-foreground'
                      }`}
                    >
                      {zone.name}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground truncate">
                      {zone.selector}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary" className="text-xs">
                      {zone.variants.length}v
                    </Badge>
                    <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
            <div className="px-4 pb-4">
              <AddZoneDialog onAdd={handleAddZone} />
            </div>
          </Card>
        </div>

        {/* Right panel — Zone detail / Variant editor (60%) */}
        <div className="flex-1 flex flex-col gap-3">
          {selectedZone ? (
            <>
              {/* Zone header */}
              <Card className="rounded-xl shadow-sm">
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex flex-col gap-0.5">
                    <p className="font-semibold text-foreground">{selectedZone.name}</p>
                    <p className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                      <CodeIcon className="h-3.5 w-3.5" />
                      {selectedZone.selector}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      disabled={aiLoadingZoneId === selectedZone.id}
                      onClick={() => handleGenerateAI(selectedZone)}
                    >
                      <SparklesIcon className="h-3.5 w-3.5 text-purple-500" />
                      {aiLoadingZoneId === selectedZone.id ? 'Generating…' : 'Generate with AI'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => handleAddVariant(selectedZone.id)}
                    >
                      <PlusIcon className="h-3.5 w-3.5" />
                      Add Variant
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Variants */}
              <div className="flex flex-col gap-2">
                {selectedZone.variants.map((variant) => (
                  <Card key={variant.id} className="rounded-xl shadow-sm">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-col gap-2 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground">{variant.name}</span>
                            {variant.isControl && (
                              <Badge
                                variant="outline"
                                className="text-xs border-gray-300 text-muted-foreground"
                              >
                                Control
                              </Badge>
                            )}
                          </div>
                          <pre className="rounded-md bg-gray-900 p-3 text-xs text-gray-100 overflow-x-auto whitespace-pre-wrap break-all">
                            {variant.html.length > 120 ? variant.html.slice(0, 120) + '…' : variant.html}
                          </pre>
                        </div>
                        {!variant.isControl && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-400 hover:text-red-600 hover:bg-red-50 px-2 shrink-0 mt-0.5"
                            onClick={() => handleDeleteVariant(selectedZone.id, variant.id)}
                          >
                            <Trash2Icon className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Create Experiment CTA */}
              <div className="mt-auto pt-2">
                <Button
                  className="w-full gap-2 bg-blue-500 hover:bg-blue-600 text-white"
                  onClick={() => setCreateExpZone(selectedZone)}
                >
                  <FlaskConicalIcon className="h-4 w-4" />
                  Create Experiment from Zone
                </Button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50">
              <p className="text-sm text-muted-foreground">Select a zone to edit variants</p>
            </div>
          )}
        </div>
      </div>

      {/* Create experiment dialog */}
      {createExpZone && (
        <CreateExperimentDialog
          zoneName={createExpZone.name}
          open={Boolean(createExpZone)}
          onOpenChange={(v) => { if (!v) setCreateExpZone(null); }}
          onConfirm={handleCreateExperiment}
        />
      )}
    </div>
  );
}
