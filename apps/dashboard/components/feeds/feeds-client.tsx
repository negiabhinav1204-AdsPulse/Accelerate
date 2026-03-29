'use client';

import * as React from 'react';
import {
  AlertTriangleIcon,
  GlobeIcon,
  Loader2Icon,
  PlusIcon,
  SettingsIcon,
  ShoppingBagIcon,
  TagIcon,
  UploadIcon,
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
} from '@workspace/ui/components/dialog';
import { Input } from '@workspace/ui/components/input';
import { Label } from '@workspace/ui/components/label';
import { Progress } from '@workspace/ui/components/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@workspace/ui/components/select';
import { toast } from '@workspace/ui/components/sonner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type FeedChannel = 'GOOGLE_MC' | 'META_CATALOG' | 'BING_MC' | 'TIKTOK' | 'PINTEREST';
type FeedStatus = 'active' | 'needs_attention' | 'inactive';

interface Feed {
  id: string;
  name: string;
  channel: FeedChannel;
  health_score: number;
  product_count: number;
  last_pushed: string;
  status: FeedStatus;
}

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_FEEDS: Feed[] = [
  {
    id: 'feed-1',
    name: 'Google Shopping Feed',
    channel: 'GOOGLE_MC',
    health_score: 87,
    product_count: 523,
    last_pushed: '2 hours ago',
    status: 'active',
  },
  {
    id: 'feed-2',
    name: 'Meta Product Catalog',
    channel: 'META_CATALOG',
    health_score: 72,
    product_count: 523,
    last_pushed: '1 day ago',
    status: 'active',
  },
  {
    id: 'feed-3',
    name: 'Bing Merchant Center',
    channel: 'BING_MC',
    health_score: 45,
    product_count: 312,
    last_pushed: '5 days ago',
    status: 'needs_attention',
  },
];

const CHANNEL_LABELS: Record<FeedChannel, string> = {
  GOOGLE_MC: 'Google MC',
  META_CATALOG: 'Meta Catalog',
  BING_MC: 'Bing MC',
  TIKTOK: 'TikTok',
  PINTEREST: 'Pinterest',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function ChannelIcon({ channel }: { channel: FeedChannel }): React.JSX.Element {
  if (channel === 'GOOGLE_MC') return <ShoppingBagIcon className="size-5 text-blue-600" />;
  if (channel === 'META_CATALOG') return <TagIcon className="size-5 text-indigo-600" />;
  return <GlobeIcon className="size-5 text-gray-500" />;
}

function HealthBar({ score }: { score: number }): React.JSX.Element {
  const color =
    score >= 80 ? 'bg-green-500' : score >= 60 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-sm font-medium tabular-nums">{score}%</span>
    </div>
  );
}

function StatusBadge({ status }: { status: FeedStatus }): React.JSX.Element {
  if (status === 'active') {
    return <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Active</Badge>;
  }
  if (status === 'needs_attention') {
    return (
      <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100">
        Needs Attention
      </Badge>
    );
  }
  return <Badge variant="secondary">Inactive</Badge>;
}

// ---------------------------------------------------------------------------
// Add Feed Dialog
// ---------------------------------------------------------------------------

interface AddFeedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (feed: Feed) => void;
}

function AddFeedDialog({ open, onOpenChange, onCreated }: AddFeedDialogProps): React.JSX.Element {
  const [name, setName] = React.useState('');
  const [channel, setChannel] = React.useState<FeedChannel | ''>('');
  const [connector, setConnector] = React.useState('');

  function handleCreate(): void {
    if (!name || !channel) return;
    const newFeed: Feed = {
      id: `feed-${Date.now()}`,
      name,
      channel: channel as FeedChannel,
      health_score: 0,
      product_count: 0,
      last_pushed: 'Never',
      status: 'inactive',
    };
    onCreated(newFeed);
    setName('');
    setChannel('');
    setConnector('');
    onOpenChange(false);
    toast.success('Feed created', { description: `"${name}" has been added.` });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Feed</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="feed-name">Feed name</Label>
            <Input
              id="feed-name"
              placeholder="e.g. Google Shopping Feed"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="feed-channel">Channel</Label>
            <Select value={channel} onValueChange={(v) => setChannel(v as FeedChannel)}>
              <SelectTrigger id="feed-channel">
                <SelectValue placeholder="Select channel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GOOGLE_MC">Google Merchant Center</SelectItem>
                <SelectItem value="META_CATALOG">Meta Catalog</SelectItem>
                <SelectItem value="BING_MC">Bing Merchant Center</SelectItem>
                <SelectItem value="TIKTOK">TikTok</SelectItem>
                <SelectItem value="PINTEREST">Pinterest</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="feed-connector">Connector</Label>
            <Select value={connector} onValueChange={setConnector}>
              <SelectTrigger id="feed-connector">
                <SelectValue placeholder="Select connector" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="shopify-1">My Shopify Store</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name || !channel}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Feed Card
// ---------------------------------------------------------------------------

interface FeedCardProps {
  feed: Feed;
  orgSlug: string;
}

function FeedCard({ feed, orgSlug }: FeedCardProps): React.JSX.Element {
  const [pushing, setPushing] = React.useState(false);
  const [generating, setGenerating] = React.useState(false);

  function handlePush(): void {
    setPushing(true);
    toast.loading('Pushing feed…', { id: `push-${feed.id}` });
    setTimeout(() => {
      setPushing(false);
      toast.success('Feed pushed successfully', {
        id: `push-${feed.id}`,
        description: `${feed.product_count} products synced to ${CHANNEL_LABELS[feed.channel]}.`,
      });
    }, 1500);
  }

  function handleGenerateTitles(): void {
    setGenerating(true);
    toast.loading('Generating AI titles…', { id: `gen-${feed.id}` });
    setTimeout(() => {
      setGenerating(false);
      toast.success('AI titles generated', {
        id: `gen-${feed.id}`,
        description: 'Product titles have been optimised with AI.',
      });
    }, 2000);
  }

  return (
    <Card className="border bg-white">
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: icon + name + badges */}
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/40">
              <ChannelIcon channel={feed.channel} />
            </div>
            <div className="space-y-1">
              <p className="font-semibold leading-none">{feed.name}</p>
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <Badge variant="outline" className="text-xs">
                  {CHANNEL_LABELS[feed.channel]}
                </Badge>
                <StatusBadge status={feed.status} />
              </div>
            </div>
          </div>

          {/* Right: metrics */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-xs">Health</span>
              <HealthBar score={feed.health_score} />
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-xs">Products</span>
              <span className="font-medium text-foreground">{feed.product_count.toLocaleString()}</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-xs">Last push</span>
              <span className="font-medium text-foreground">{feed.last_pushed}</span>
            </div>
          </div>
        </div>

        {/* Action row */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-4">
          <Button size="sm" onClick={handlePush} disabled={pushing}>
            {pushing ? (
              <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <UploadIcon className="mr-1.5 size-3.5" />
            )}
            Push Now
          </Button>

          <Button size="sm" variant="outline" asChild>
            <Link href={`/organizations/${orgSlug}/feeds/${feed.id}/rules`}>Rules</Link>
          </Button>

          <Button size="sm" variant="outline">
            <SettingsIcon className="mr-1.5 size-3.5" />
            Settings
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={handleGenerateTitles}
            disabled={generating}
            className="ml-auto"
          >
            {generating ? (
              <Loader2Icon className="mr-1.5 size-3.5 animate-spin" />
            ) : (
              <ZapIcon className="mr-1.5 size-3.5 text-violet-500" />
            )}
            Generate AI Titles
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

interface FeedsClientProps {
  orgId: string;
  orgSlug: string;
}

export function FeedsClient({ orgId, orgSlug }: FeedsClientProps): React.JSX.Element {
  const [feeds, setFeeds] = React.useState<Feed[]>(MOCK_FEEDS);
  const [addOpen, setAddOpen] = React.useState(false);
  const gmcConnected = true; // mock

  const stats = [
    { label: 'Total Feeds', value: feeds.length },
    { label: 'Active Channels', value: feeds.filter((f) => f.status === 'active').length },
    { label: 'Products Synced', value: '847' },
    { label: 'Last Push', value: '2 hours ago' },
  ];

  return (
    <div className="space-y-6">
      {/* GMC connection banner */}
      {!gmcConnected && (
        <div className="flex items-center gap-3 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3">
          <AlertTriangleIcon className="size-4 shrink-0 text-yellow-600" />
          <p className="flex-1 text-sm text-yellow-800">
            Connect Google Merchant Center to start pushing product feeds.
          </p>
          <Button size="sm" variant="outline" asChild>
            <Link href={`/organizations/${orgSlug}/feeds/merchant-center`}>
              Connect Google Merchant Center
            </Link>
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Commerce Feeds</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage product feeds for Google Merchant Center, Meta Catalog, and other channels
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <PlusIcon className="mr-1.5 size-4" />
          Add Feed
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label} className="border bg-white">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className="mt-1 text-2xl font-semibold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Feed list */}
      <div className="space-y-3">
        {feeds.map((feed) => (
          <FeedCard key={feed.id} feed={feed} orgSlug={orgSlug} />
        ))}
      </div>

      <AddFeedDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={(feed) => setFeeds((prev) => [...prev, feed])}
      />
    </div>
  );
}
