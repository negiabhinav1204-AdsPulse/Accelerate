'use client';

import * as React from 'react';
import { format } from 'date-fns';
import {
  CheckCircle2Icon,
  ClockIcon,
  Loader2Icon,
  PlusIcon,
  StoreIcon,
  Trash2Icon,
  XCircleIcon
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
import { toast } from '@workspace/ui/components/sonner';

// ── Platform brand definitions ──────────────────────────────────────────────

const COMMERCE_PLATFORMS = [
  {
    id: 'shopify',
    name: 'Shopify',
    description: 'Connect your Shopify store to sync products and orders.',
    color: '#96BF48',
    icon: (
      <svg viewBox="0 0 40 40" className="size-10">
        <rect width="40" height="40" rx="8" fill="#95BF47" />
        <path
          d="M29.2 12.1c0-.1-.1-.2-.3-.2-.1 0-2.4-.2-2.4-.2s-1.6-1.6-1.8-1.8c-.2-.2-.5-.1-.6-.1l-.8.2c-.5-1.4-1.4-2.7-2.9-2.7h-.2C19.7 6.4 19 5.5 18 5.5c-2.8 0-4.1 3.5-4.5 5.2l-2.7.8c-.8.3-.8.3-.9 1.1L8 26.5l13.6 2.6 7.4-1.6c0 0-1.4-14.9-1.4-15.1c-.1-.1-.2-.3-.4-.3zM23.1 10c0 .1-1.8.5-3.9 1.2.3-1.3.9-2.5 1.6-3.4.3.5.5 1.2.5 2 0 .1.1.1.1.1s-.2.1-.3.1zm-3.1-4c.3 0 .5.1.7.3-1 .9-2.1 2.2-2.5 4.4l-2.9.9c.6-2.3 2-5.6 4.7-5.6z"
          fill="white"
        />
      </svg>
    ),
  },
  {
    id: 'woocommerce',
    name: 'WooCommerce',
    description: 'Connect your WooCommerce store to sync products and orders.',
    color: '#7F54B3',
    icon: (
      <svg viewBox="0 0 40 40" className="size-10">
        <rect width="40" height="40" rx="8" fill="#7F54B3" />
        <text x="20" y="26" textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">
          Woo
        </text>
      </svg>
    ),
  },
  {
    id: 'bigcommerce',
    name: 'BigCommerce',
    description: 'Connect your BigCommerce store to sync products and orders.',
    color: '#34313F',
    icon: (
      <svg viewBox="0 0 40 40" className="size-10">
        <rect width="40" height="40" rx="8" fill="#34313F" />
        <text x="20" y="26" textAnchor="middle" fill="white" fontSize="12" fontWeight="bold">
          BC
        </text>
      </svg>
    ),
  },
];

// ── Types ────────────────────────────────────────────────────────────────────

type CommerceConnector = {
  id: string;
  platform: string;
  name: string;
  status: string;
  lastSyncAt: string | null;
  createdAt: string;
};

type Props = {
  orgId: string;
  orgSlug: string;
};

// ── Component ────────────────────────────────────────────────────────────────

export function CommerceConnectorsClient({ orgId, orgSlug }: Props): React.JSX.Element {
  const [connectors, setConnectors] = React.useState<CommerceConnector[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [showAddDialog, setShowAddDialog] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    void fetchConnectors();
  }, []);

  async function fetchConnectors(): Promise<void> {
    setLoading(true);
    try {
      const res = await fetch('/api/commerce/connectors');
      if (res.ok) {
        const data = await res.json();
        setConnectors(data.connectors ?? []);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string): Promise<void> {
    setDeletingId(id);
    try {
      const res = await fetch('/api/commerce/connectors', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setConnectors((prev) => prev.filter((c) => c.id !== id));
        toast.success('Connector removed');
      } else {
        toast.error('Failed to remove connector');
      }
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Connect your online store to sync products, orders, and revenue data.
          </p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <PlusIcon className="mr-2 size-4" />
          Add Connector
        </Button>
      </div>

      {/* Connected stores */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : connectors.length === 0 ? (
        <EmptyState onAdd={() => setShowAddDialog(true)} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {connectors.map((connector) => (
            <ConnectorCard
              key={connector.id}
              connector={connector}
              onDelete={handleDelete}
              isDeleting={deletingId === connector.id}
            />
          ))}
        </div>
      )}

      {/* Add connector dialog */}
      <AddConnectorDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        orgSlug={orgSlug}
      />
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center">
      <StoreIcon className="mb-4 size-12 text-muted-foreground/40" />
      <h3 className="mb-1 text-sm font-medium">No stores connected</h3>
      <p className="mb-6 max-w-xs text-sm text-muted-foreground">
        Connect your first store to start syncing products, orders, and revenue.
      </p>
      <Button onClick={onAdd}>
        <PlusIcon className="mr-2 size-4" />
        Add Connector
      </Button>
    </div>
  );
}

function ConnectorCard({
  connector,
  onDelete,
  isDeleting,
}: {
  connector: CommerceConnector;
  onDelete: (id: string) => Promise<void>;
  isDeleting: boolean;
}): React.JSX.Element {
  const platform = COMMERCE_PLATFORMS.find((p) => p.id === connector.platform);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-2">
        <div className="shrink-0">
          {platform?.icon ?? <StoreIcon className="size-10 text-muted-foreground" />}
        </div>
        <div className="flex-1 min-w-0">
          <CardTitle className="text-sm font-medium truncate">{connector.name}</CardTitle>
          <CardDescription className="text-xs">{platform?.name ?? connector.platform}</CardDescription>
        </div>
        <StatusBadge status={connector.status} />
      </CardHeader>
      <CardContent className="pt-0">
        <p className="text-xs text-muted-foreground">
          {connector.lastSyncAt
            ? `Last synced ${format(new Date(connector.lastSyncAt), 'MMM d, h:mm a')}`
            : 'Never synced'}
        </p>
        <div className="mt-3 flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => void onDelete(connector.id)}
            disabled={isDeleting}
          >
            {isDeleting ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <Trash2Icon className="size-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }): React.JSX.Element {
  if (status === 'active') {
    return (
      <Badge variant="outline" className="border-green-500/30 bg-green-500/10 text-green-600">
        <CheckCircle2Icon className="mr-1 size-3" />
        Active
      </Badge>
    );
  }
  if (status === 'syncing') {
    return (
      <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-600">
        <Loader2Icon className="mr-1 size-3 animate-spin" />
        Syncing
      </Badge>
    );
  }
  if (status === 'error') {
    return (
      <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-600">
        <XCircleIcon className="mr-1 size-3" />
        Error
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      <ClockIcon className="mr-1 size-3" />
      Pending
    </Badge>
  );
}

function AddConnectorDialog({
  open,
  onClose,
  orgSlug,
}: {
  open: boolean;
  onClose: () => void;
  orgSlug: string;
}): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Connect a Store</DialogTitle>
          <DialogDescription>
            Choose your e-commerce platform to get started.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 py-2">
          {COMMERCE_PLATFORMS.map((platform) => (
            <button
              key={platform.id}
              className="flex items-center gap-4 rounded-lg border p-4 text-left transition-colors hover:bg-muted/50"
              onClick={() => {
                toast.info(`${platform.name} OAuth coming soon — set up via API key in Settings.`);
                onClose();
              }}
            >
              <div className="shrink-0">{platform.icon}</div>
              <div>
                <p className="text-sm font-medium">{platform.name}</p>
                <p className="text-xs text-muted-foreground">{platform.description}</p>
              </div>
            </button>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
