'use client';

import * as React from 'react';
import {
  ExternalLinkIcon,
  FlaskConicalIcon,
  GlobeIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  TrendingUpIcon,
  ZapIcon,
} from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@workspace/ui/components/badge';
import { Button } from '@workspace/ui/components/button';
import { Card, CardContent } from '@workspace/ui/components/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@workspace/ui/components/dialog';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TrackedPage {
  id: string;
  name: string;
  url: string;
  zone_count: number;
  active_experiments: number;
  best_lift: number;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Mock data — TODO: replace with real API call to /api/personalization/pages?orgId=
// ---------------------------------------------------------------------------

const MOCK_PAGES: TrackedPage[] = [
  {
    id: '1',
    name: 'Homepage',
    url: 'https://example.com',
    zone_count: 3,
    active_experiments: 2,
    best_lift: 14.2,
    createdAt: '2026-03-20',
  },
  {
    id: '2',
    name: 'Product Page — Running Shoes',
    url: 'https://example.com/products/shoes',
    zone_count: 2,
    active_experiments: 1,
    best_lift: 8.7,
    createdAt: '2026-03-22',
  },
  {
    id: '3',
    name: 'Checkout Page',
    url: 'https://example.com/checkout',
    zone_count: 1,
    active_experiments: 0,
    best_lift: 0,
    createdAt: '2026-03-25',
  },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PersonalizationClientProps {
  orgId: string;
  orgSlug: string;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  icon,
  label,
  value,
  color = 'blue',
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  color?: 'blue' | 'green' | 'purple';
}) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <Card className="rounded-xl shadow-sm">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${colorMap[color]}`}>
          {icon}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold text-foreground">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Add Page Dialog
// ---------------------------------------------------------------------------

function AddPageDialog({ onAdd }: { onAdd: (name: string, url: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [url, setUrl] = React.useState('');

  function handleSave() {
    if (!name.trim() || !url.trim()) return;
    onAdd(name.trim(), url.trim());
    setName('');
    setUrl('');
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-blue-500 hover:bg-blue-600 text-white">
          <PlusIcon className="h-4 w-4" />
          Add Page
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Track a New Page</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="page-name">Page Name</Label>
            <Input
              id="page-name"
              placeholder="e.g. Homepage"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="page-url">Page URL</Label>
            <Input
              id="page-url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
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
            disabled={!name.trim() || !url.trim()}
          >
            Save Page
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PersonalizationClient({ orgId, orgSlug }: PersonalizationClientProps) {
  // TODO: replace mock data with real API call:
  // useEffect(() => { fetch(`/api/personalization/pages?orgId=${orgId}`).then(...) }, [orgId])
  const [pages, setPages] = React.useState<TrackedPage[]>(MOCK_PAGES);

  const totalZones = pages.reduce((sum, p) => sum + p.zone_count, 0);
  const totalActiveExperiments = pages.reduce((sum, p) => sum + p.active_experiments, 0);
  const avgLift =
    pages.length > 0
      ? pages.reduce((sum, p) => sum + p.best_lift, 0) / pages.length
      : 0;

  function handleAddPage(name: string, url: string) {
    const newPage: TrackedPage = {
      id: String(Date.now()),
      name,
      url,
      zone_count: 0,
      active_experiments: 0,
      best_lift: 0,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setPages((prev) => [...prev, newPage]);
  }

  function handleDeletePage(id: string) {
    setPages((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Web Personalization</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Track pages, define zones, and run A/B experiments.
          </p>
        </div>
        <AddPageDialog onAdd={handleAddPage} />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          icon={<GlobeIcon className="h-5 w-5" />}
          label="Total Pages Tracked"
          value={pages.length}
          color="blue"
        />
        <StatCard
          icon={<FlaskConicalIcon className="h-5 w-5" />}
          label="Active Experiments"
          value={totalActiveExperiments}
          color="purple"
        />
        <StatCard
          icon={<TrendingUpIcon className="h-5 w-5" />}
          label="Avg Lift"
          value={avgLift > 0 ? `+${avgLift.toFixed(1)}%` : '—'}
          color="green"
        />
      </div>

      {/* Page list or empty state */}
      {pages.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 py-16 gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
            <GlobeIcon className="h-7 w-7 text-blue-500" />
          </div>
          <div className="text-center">
            <p className="text-base font-medium text-foreground">No pages tracked yet.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Add your first page to start personalizing.
            </p>
          </div>
          <AddPageDialog onAdd={handleAddPage} />
        </div>
      ) : (
        <Card className="rounded-xl shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50">
                <TableHead className="font-medium text-muted-foreground">Page</TableHead>
                <TableHead className="font-medium text-muted-foreground text-center">Zones</TableHead>
                <TableHead className="font-medium text-muted-foreground text-center">
                  Active Experiments
                </TableHead>
                <TableHead className="font-medium text-muted-foreground text-center">Best Lift</TableHead>
                <TableHead className="font-medium text-muted-foreground text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pages.map((page) => (
                <TableRow key={page.id} className="hover:bg-gray-50/50">
                  {/* Page name + URL */}
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium text-foreground">{page.name}</span>
                      <a
                        href={page.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-500 hover:underline"
                      >
                        {page.url.replace(/^https?:\/\//, '')}
                        <ExternalLinkIcon className="h-3 w-3" />
                      </a>
                    </div>
                  </TableCell>

                  {/* Zone count */}
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="tabular-nums">
                      {page.zone_count} {page.zone_count === 1 ? 'zone' : 'zones'}
                    </Badge>
                  </TableCell>

                  {/* Active experiments */}
                  <TableCell className="text-center">
                    {page.active_experiments > 0 ? (
                      <Badge className="bg-purple-100 text-purple-700 border-purple-200 tabular-nums">
                        {page.active_experiments} running
                      </Badge>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Best lift */}
                  <TableCell className="text-center">
                    {page.best_lift > 0 ? (
                      <span className="flex items-center justify-center gap-1 text-sm font-medium text-green-600">
                        <TrendingUpIcon className="h-3.5 w-3.5" />+{page.best_lift.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>

                  {/* Actions */}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/organizations/${orgSlug}/personalization/editor?pageId=${page.id}`}
                      >
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                          <PencilIcon className="h-3.5 w-3.5" />
                          Edit Zones
                        </Button>
                      </Link>
                      <Link href={`/organizations/${orgSlug}/experiments?pageId=${page.id}`}>
                        <Button size="sm" variant="outline" className="gap-1.5 text-xs">
                          <ZapIcon className="h-3.5 w-3.5" />
                          View Experiments
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-400 hover:text-red-600 hover:bg-red-50 px-2"
                        onClick={() => handleDeletePage(page.id)}
                      >
                        <Trash2Icon className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
