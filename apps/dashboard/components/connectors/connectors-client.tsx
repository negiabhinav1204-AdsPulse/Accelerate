'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangleIcon,
  CheckCircle2Icon,
  ClockIcon,
  Loader2Icon,
  RefreshCwIcon,
  ZapIcon
} from 'lucide-react';

import { Button } from '@workspace/ui/components/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@workspace/ui/components/dialog';
import { toast } from '@workspace/ui/components/sonner';
import { cn } from '@workspace/ui/lib/utils';

// ── Platform brand icons ──────────────────────────────────────────────────────

function GoogleIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 48 48" className="size-10">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
      <path fill="none" d="M0 0h48v48H0z"/>
    </svg>
  );
}

function MetaIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" className="size-10">
      <rect width="40" height="40" rx="8" fill="#0866FF"/>
      <path d="M8 22.5c0 3.5 1.8 6 4.5 6 1.4 0 2.6-.6 3.8-2.2l.2-.3.2.3c1.2 1.6 2.4 2.2 3.8 2.2 1.4 0 2.6-.6 3.5-1.9.3-.4.5-.9.7-1.4.4-1.1.6-2.4.6-3.8 0-1.7-.3-3.2-.9-4.3C23.7 15.9 22.5 15 21 15c-1.4 0-2.7.8-3.9 2.5l-.6.9-.6-.9C14.7 15.8 13.4 15 12 15c-1.5 0-2.7.9-3.4 2.4-.6 1.1-.9 2.6-.9 4.3v.8z" fill="white"/>
    </svg>
  );
}

function MicrosoftIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" className="size-10">
      <rect x="2" y="2" width="17" height="17" fill="#F25022"/>
      <rect x="21" y="2" width="17" height="17" fill="#7FBA00"/>
      <rect x="2" y="21" width="17" height="17" fill="#00A4EF"/>
      <rect x="21" y="21" width="17" height="17" fill="#FFB900"/>
    </svg>
  );
}

function ShopifyIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" className="size-10">
      <rect width="40" height="40" rx="8" fill="#95BF47"/>
      <path d="M29.2 12.1c0-.1-.1-.2-.3-.2-.1 0-2.4-.2-2.4-.2s-1.6-1.6-1.8-1.8c-.2-.2-.5-.1-.6-.1l-.8.2c-.5-1.4-1.4-2.7-2.9-2.7h-.2C19.7 6.4 19 5.5 18 5.5c-2.8 0-4.1 3.5-4.5 5.2l-2.7.8c-.8.3-.8.3-.9 1.1L8 26.5l13.6 2.6 7.4-1.6c0 0-1.4-14.9-1.4-15.1c-.1-.1-.2-.3-.4-.3zM23.1 10c0 .1-1.8.5-3.9 1.2.3-1.3.9-2.5 1.6-3.4.3.5.5 1.2.5 2 0 .1.1.1.1.1s-.2.1-.3.1zm-3.1-4c.3 0 .5.1.7.3-1 .9-2.1 2.2-2.5 4.4l-2.9.9c.6-2.3 2-5.6 4.7-5.6z" fill="white"/>
    </svg>
  );
}

function TikTokIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" className="size-10">
      <rect width="40" height="40" rx="8" fill="#000000"/>
      <path d="M28 13.5c-1.5-.5-2.8-1.5-3.5-3H21v14.2c0 1.5-1.2 2.8-2.8 2.8s-2.8-1.2-2.8-2.8 1.2-2.8 2.8-2.8c.3 0 .6 0 .8.1V19c-.3 0-.5-.1-.8-.1-3.2 0-5.8 2.6-5.8 5.8s2.6 5.8 5.8 5.8 5.8-2.6 5.8-5.8V19c1.3.9 2.8 1.5 4.5 1.5v-3c-.9 0-1.7-.2-2.3-.5V13.5z" fill="white"/>
    </svg>
  );
}

function RedditIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" className="size-10">
      <rect width="40" height="40" rx="20" fill="#FF4500"/>
      <path d="M33 20c0-1.7-1.4-3-3-3-.8 0-1.5.3-2 .8-2-1.4-4.7-2.3-7.7-2.4l1.3-6.1 4.2.9c0 1.2 1 2.2 2.2 2.2s2.2-1 2.2-2.2-1-2.2-2.2-2.2c-.9 0-1.7.5-2 1.3l-4.7-1c-.2 0-.4.1-.4.3L20 16.4c-3.1.1-5.8 1-7.8 2.4-.5-.5-1.2-.8-2-.8-1.7 0-3 1.3-3 3 0 1.2.7 2.3 1.8 2.7 0 .3-.1.5-.1.8 0 4 4.7 7.3 10.5 7.3S30 29.5 30 25.5c0-.3 0-.5-.1-.8C31 24.3 33 22.3 33 20zM14.5 22c0-.8.7-1.5 1.5-1.5s1.5.7 1.5 1.5-.7 1.5-1.5 1.5-1.5-.7-1.5-1.5zm8.3 4.3c-1 1-3.6 1-4.6 0-.2-.2-.2-.5 0-.7s.5-.2.7 0c.7.7 2.5.7 3.2 0 .2-.2.5-.2.7 0s.2.5 0 .7zm-.3-2.8c-.8 0-1.5-.7-1.5-1.5s.7-1.5 1.5-1.5 1.5.7 1.5 1.5-.7 1.5-1.5 1.5z" fill="white"/>
    </svg>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type ConnectedPlatformData = {
  platform: string;
  defaultAccount: { accountId: string; accountName: string; lastSyncAt: Date | null; status: string } | null;
  accountCount: number;
};

export type ConnectorsClientProps = {
  connected: ConnectedPlatformData[];
  orgSlug: string;
  orgId: string;
  isAdmin: boolean;
  initialConnected?: string;
  initialError?: string;
  initialErrorPlatform?: string;
  initialSelectPlatform?: string;
};

type AdAccount = {
  id: string;
  accountId: string;
  accountName: string;
  isDefault: boolean;
  status: string;
  lastSyncAt: Date | null;
};

// ── Platform config ───────────────────────────────────────────────────────────

type PlatformConfig = {
  label: string;
  description: string;
  icon: () => React.JSX.Element;
  createUrl: string;
};

const MAIN_PLATFORMS: Record<string, PlatformConfig> = {
  google: {
    label: 'Google Ads',
    description: 'Reach customers on Google Search and across the web.',
    icon: GoogleIcon,
    createUrl: 'https://ads.google.com/home/'
  },
  meta: {
    label: 'Meta Ads',
    description: 'Reach engaged audiences across Facebook & Instagram.',
    icon: MetaIcon,
    createUrl: 'https://www.facebook.com/business/ads'
  },
  bing: {
    label: 'Microsoft Ads',
    description: 'Access professional audiences with lower competition.',
    icon: MicrosoftIcon,
    createUrl: 'https://ads.microsoft.com/'
  }
};

const MORE_PLATFORMS = [
  { key: 'tiktok', label: 'TikTok Ads', description: 'Engage Gen Z & millennials with authentic video content.', icon: TikTokIcon },
  { key: 'reddit', label: 'Reddit Ads', description: 'Connect with passionate communities and niche audiences.', icon: RedditIcon }
];

const PLATFORM_LABELS: Record<string, string> = {
  google: 'Google Ads',
  meta: 'Meta Ads',
  bing: 'Microsoft Ads'
};

const ERROR_MESSAGES: Record<string, string> = {
  credentials_missing: 'Platform credentials are not configured. Contact your administrator.',
  oauth_missing_params: 'OAuth authorisation was incomplete. Please try again.',
  oauth_state_mismatch: 'Security check failed. Please try again.',
  no_accounts_found: 'No ad accounts were found on this connection. Make sure the account you connected has active ad accounts.',
  oauth_token_error: 'Could not retrieve access token. Check your platform credentials.',
  oauth_invalid_state: 'Invalid OAuth state. Please try again.',
  oauth_user_mismatch: 'Session mismatch. Please sign in again.',
  org_not_found: 'Organisation not found.',
  not_member: 'You are not a member of this organisation.'
};

// ── Account Picker Dialog ─────────────────────────────────────────────────────

function AccountPickerDialog({
  platform,
  orgSlug,
  open,
  onClose
}: {
  platform: string;
  orgSlug: string;
  open: boolean;
  onClose: () => void;
}): React.JSX.Element {
  const router = useRouter();
  const [accounts, setAccounts] = React.useState<AdAccount[]>([]);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [fetching, setFetching] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const platformLabel = PLATFORM_LABELS[platform] ?? platform;
  const config = MAIN_PLATFORMS[platform];

  React.useEffect(() => {
    if (!open) return;
    setFetching(true);
    void fetch(`/api/connectors/${platform}/accounts?org=${orgSlug}`)
      .then((r) => r.json())
      .then((data) => {
        const list = data as AdAccount[];
        setAccounts(list);
        const defaultAcc = list.find((a) => a.isDefault);
        setSelectedId(defaultAcc?.accountId ?? list[0]?.accountId ?? null);
      })
      .catch(() => toast.error('Could not load accounts. Please try again.'))
      .finally(() => setFetching(false));
  }, [open, platform]);

  async function handleConfirm(): Promise<void> {
    if (!selectedId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/connectors/${platform}/accounts`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: selectedId, org: orgSlug })
      });
      if (!res.ok) throw new Error();
      toast.success(`${platformLabel} connected successfully`);
      onClose();
      router.replace(`/organizations/${orgSlug}/connectors`);
      router.refresh();
    } catch {
      toast.error('Failed to save selection. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !saving) onClose(); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            {config && <config.icon />}
            <DialogTitle>Select a {platformLabel} account</DialogTitle>
          </div>
          <DialogDescription>
            We found multiple ad accounts linked to your {platformLabel} login. Choose the one you want to use with Accelerate.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 max-h-72 overflow-y-auto rounded-lg border border-border divide-y divide-border">
          {fetching ? (
            <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground text-sm">
              <Loader2Icon className="size-4 animate-spin" />
              Loading accounts…
            </div>
          ) : accounts.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No ad accounts found on this connection.
            </p>
          ) : (
            accounts.map((account) => {
              const isSelected = account.accountId === selectedId;
              return (
                <button
                  key={account.accountId}
                  type="button"
                  onClick={() => setSelectedId(account.accountId)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors',
                    isSelected ? 'bg-primary/5' : 'hover:bg-muted/50'
                  )}
                >
                  <span className={cn(
                    'flex size-4 shrink-0 rounded-full border-2 items-center justify-center',
                    isSelected ? 'border-primary' : 'border-muted-foreground/40'
                  )}>
                    {isSelected && <span className="size-2 rounded-full bg-primary" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{account.accountName}</p>
                    <p className="text-xs text-muted-foreground font-mono">{account.accountId}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button
            onClick={() => void handleConfirm()}
            disabled={!selectedId || fetching || saving}
            className="gap-2"
          >
            {saving && <Loader2Icon className="size-4 animate-spin" />}
            Connect account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Connected tile ────────────────────────────────────────────────────────────

function ConnectedTile({
  platform,
  config,
  data,
  orgSlug,
  orgId,
  isAdmin
}: {
  platform: string;
  config: PlatformConfig;
  data: ConnectedPlatformData;
  orgSlug: string;
  orgId: string;
  isAdmin: boolean;
}): React.JSX.Element {
  const router = useRouter();
  const [disconnectState, setDisconnectState] = React.useState<'idle' | 'confirming' | 'loading'>('idle');
  const [syncing, setSyncing] = React.useState(false);

  const isTokenExpired = data.defaultAccount?.status === 'token_expired';

  const lastSync = data.defaultAccount?.lastSyncAt
    ? new Date(data.defaultAccount.lastSyncAt).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      })
    : null;

  async function handleDisconnect(): Promise<void> {
    setDisconnectState('loading');
    try {
      const res = await fetch(`/api/connectors/${platform}/disconnect`, { method: 'POST' });
      if (!res.ok) throw new Error();
      toast.success(`${config.label} disconnected`);
      router.refresh();
    } catch {
      toast.error(`Failed to disconnect ${config.label}`);
      setDisconnectState('idle');
    }
  }

  async function handleSync(): Promise<void> {
    setSyncing(true);
    try {
      const res = await fetch('/api/sync/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId })
      });
      if (!res.ok) throw new Error();
      toast.success(`${config.label} sync complete`);
      router.refresh();
    } catch {
      toast.error(`Failed to sync ${config.label}`);
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-6 gap-4 shadow-sm">
      <config.icon />
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-base font-bold text-foreground">{config.label}</h3>
          {isTokenExpired ? (
            <span className="flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded-full shrink-0">
              <AlertTriangleIcon className="size-3" />
              Reconnect required
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full shrink-0">
              <CheckCircle2Icon className="size-3" />
              Connected
            </span>
          )}
        </div>
        <p className="text-sm font-medium text-foreground truncate">
          {data.defaultAccount?.accountName ?? '—'}
        </p>
        <p className="text-xs text-muted-foreground font-mono">
          {data.defaultAccount?.accountId ?? '—'}
        </p>
        {lastSync && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground pt-0.5">
            <ClockIcon className="size-3 shrink-0" />
            Last sync: {lastSync}
          </p>
        )}
      </div>

      {isAdmin && (
        <div className="space-y-2">
          {isTokenExpired ? (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 border-amber-400 text-amber-700 hover:bg-amber-50 hover:text-amber-800 dark:border-amber-600 dark:text-amber-400 dark:hover:bg-amber-900/20 font-semibold"
              onClick={() => {
                window.location.href = `/api/connectors/${platform}/authorize?return=/organizations/${orgSlug}/connectors&org=${orgSlug}`;
              }}
            >
              <ZapIcon className="size-3.5" />
              Reconnect
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => void handleSync()}
              disabled={syncing || disconnectState === 'loading'}
            >
              <RefreshCwIcon className={`size-3.5 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : 'Sync now'}
            </Button>
          )}
          {disconnectState === 'idle' && (
            <Button
              variant="outline"
              size="sm"
              className="w-full text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/20 border-red-200 dark:border-red-800"
              onClick={() => setDisconnectState('confirming')}
            >
              Disconnect
            </Button>
          )}
          {disconnectState === 'confirming' && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground text-center">
                This will stop syncing data from {config.label}.
              </p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="flex-1" onClick={() => setDisconnectState('idle')}>
                  Cancel
                </Button>
                <Button size="sm" variant="destructive" className="flex-1" onClick={() => void handleDisconnect()}>
                  Disconnect
                </Button>
              </div>
            </div>
          )}
          {disconnectState === 'loading' && (
            <div className="flex items-center justify-center gap-2 py-1 text-xs text-muted-foreground">
              <Loader2Icon className="size-3.5 animate-spin" />
              Disconnecting…
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Unconnected tile ──────────────────────────────────────────────────────────

function UnconnectedTile({
  platform,
  config,
  orgSlug,
  isAdmin
}: {
  platform: string;
  config: PlatformConfig;
  orgSlug: string;
  isAdmin: boolean;
}): React.JSX.Element {
  return (
    <div className="flex flex-col rounded-2xl border border-border bg-card p-6 gap-4 shadow-sm">
      <config.icon />
      <div className="flex-1 space-y-1">
        <h3 className="text-base font-bold text-foreground">{config.label}</h3>
        <p className="text-sm text-muted-foreground">{config.description}</p>
      </div>
      <div className="space-y-2">
        {isAdmin ? (
          <Button
            variant="outline"
            className="w-full border-blue-500 text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-900/20 font-semibold"
            onClick={() => {
              window.location.href = `/api/connectors/${platform}/authorize?return=/organizations/${orgSlug}/connectors&org=${orgSlug}`;
            }}
          >
            <ZapIcon className="size-4 mr-1.5" />
            Connect now
          </Button>
        ) : (
          <Button variant="outline" className="w-full" disabled>
            Not connected
          </Button>
        )}
        <p className="text-center text-xs text-muted-foreground">
          Don&apos;t have an account?{' '}
          <a href={config.createUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">
            Create one
          </a>
        </p>
      </div>
    </div>
  );
}

// ── Shopify connect dialog ────────────────────────────────────────────────────

function ShopifyConnectDialog({
  open,
  onClose,
  orgSlug
}: {
  open: boolean;
  onClose: () => void;
  orgSlug: string;
}): React.JSX.Element {
  const [shopDomain, setShopDomain] = React.useState('');
  const [connecting, setConnecting] = React.useState(false);

  const isValid = shopDomain.trim().length > 2;

  async function handleConnect(): Promise<void> {
    if (!isValid) return;
    setConnecting(true);
    const domain = shopDomain.includes('.myshopify.com')
      ? shopDomain.trim()
      : `${shopDomain.trim()}.myshopify.com`;
    window.location.href = `/api/connectors/shopify/authorize?shop=${encodeURIComponent(domain)}&return=/organizations/${orgSlug}/connectors&org=${orgSlug}`;
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !connecting) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-1">
            <ShopifyIcon />
            <DialogTitle>Connect Shopify Store</DialogTitle>
          </div>
          <DialogDescription>
            Enter your Shopify store domain to connect and sync your product catalog to ad channels.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-2 space-y-3">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Store domain</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="your-store"
                value={shopDomain}
                onChange={(e) => setShopDomain(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                onKeyDown={(e) => { if (e.key === 'Enter') void handleConnect(); }}
              />
              <span className="text-sm text-muted-foreground shrink-0">.myshopify.com</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Find this in your Shopify admin URL or store settings.
            </p>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose} disabled={connecting}>Cancel</Button>
          <Button
            onClick={() => void handleConnect()}
            disabled={!isValid || connecting}
            className="gap-2 bg-[#95BF47] hover:bg-[#7ea83a] text-white border-none"
          >
            {connecting && <Loader2Icon className="size-4 animate-spin" />}
            Connect Store
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Shopify store tile ────────────────────────────────────────────────────────

function ShopifyStoreTile({ orgSlug, isAdmin }: { orgSlug: string; isAdmin: boolean }): React.JSX.Element {
  const [dialogOpen, setDialogOpen] = React.useState(false);

  return (
    <>
      <ShopifyConnectDialog open={dialogOpen} onClose={() => setDialogOpen(false)} orgSlug={orgSlug} />
      <div className="flex flex-col rounded-2xl border border-border bg-card p-6 gap-4 shadow-sm">
        <ShopifyIcon />
        <div className="flex-1 space-y-1">
          <h3 className="text-base font-bold text-foreground">Shopify</h3>
          <p className="text-sm text-muted-foreground">
            Sync your Shopify product catalog to submit feeds to Google Shopping, Meta Catalog, and Microsoft Shopping.
          </p>
        </div>
        <div className="space-y-2">
          {isAdmin ? (
            <Button
              variant="outline"
              className="w-full border-[#95BF47] text-[#5e8e3e] hover:bg-[#95BF47]/10 hover:text-[#5e8e3e] font-semibold"
              onClick={() => setDialogOpen(true)}
            >
              <ZapIcon className="size-4 mr-1.5" />
              Connect store
            </Button>
          ) : (
            <Button variant="outline" className="w-full" disabled>Not connected</Button>
          )}
          <p className="text-center text-xs text-muted-foreground">
            Connect once — Accelerate handles the rest
          </p>
        </div>
      </div>
    </>
  );
}

// ── Coming soon tile ──────────────────────────────────────────────────────────

function ComingSoonTile({ label, description, icon: Icon }: { label: string; description: string; icon: () => React.JSX.Element }): React.JSX.Element {
  return (
    <div className="flex flex-col rounded-2xl border border-dashed border-border bg-card/50 p-6 gap-4 opacity-60">
      <Icon />
      <div className="flex-1 space-y-1">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-foreground">{label}</h3>
          <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">Coming soon</span>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function ConnectorsClient({
  connected,
  orgSlug,
  orgId,
  isAdmin,
  initialConnected,
  initialError,
  initialErrorPlatform,
  initialSelectPlatform
}: ConnectorsClientProps): React.JSX.Element {
  const router = useRouter();
  const [pickerPlatform, setPickerPlatform] = React.useState<string | null>(
    initialSelectPlatform ?? null
  );

  // Show toast once on mount for OAuth callback result
  React.useEffect(() => {
    if (initialConnected) {
      const label = PLATFORM_LABELS[initialConnected] ?? initialConnected;
      toast.success(`${label} connected successfully`);
      router.replace(`/organizations/${orgSlug}/connectors`, { scroll: false });
    } else if (initialError) {
      const platformLabel = initialErrorPlatform
        ? (PLATFORM_LABELS[initialErrorPlatform] ?? initialErrorPlatform)
        : 'Platform';
      const message = ERROR_MESSAGES[initialError] ?? 'Something went wrong. Please try again.';
      toast.error(`${platformLabel}: ${message}`);
      router.replace(`/organizations/${orgSlug}/connectors`, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const connectedByPlatform = Object.fromEntries(connected.map((c) => [c.platform, c]));

  return (
    <>
      {pickerPlatform && MAIN_PLATFORMS[pickerPlatform] && (
        <AccountPickerDialog
          platform={pickerPlatform}
          orgSlug={orgSlug}
          open={!!pickerPlatform}
          onClose={() => {
            setPickerPlatform(null);
            router.replace(`/organizations/${orgSlug}/connectors`, { scroll: false });
            router.refresh();
          }}
        />
      )}

      <div className="space-y-10 max-w-5xl">
        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Connect Your Platforms</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect the platforms where you want to run campaigns. One account per platform.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(MAIN_PLATFORMS).map(([platform, config]) => {
              const data = connectedByPlatform[platform] ?? null;
              return data ? (
                <ConnectedTile key={platform} platform={platform} config={config} data={data} orgSlug={orgSlug} orgId={orgId} isAdmin={isAdmin} />
              ) : (
                <UnconnectedTile key={platform} platform={platform} config={config} orgSlug={orgSlug} isAdmin={isAdmin} />
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h2 className="text-2xl font-bold text-foreground">Store Connections</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Connect your eCommerce store to sync product catalogs and manage Shopping feed submissions.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <ShopifyStoreTile orgSlug={orgSlug} isAdmin={isAdmin} />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">More platforms</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">Additional integrations — coming soon</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MORE_PLATFORMS.map((p) => (
              <ComingSoonTile key={p.key} label={p.label} description={p.description} icon={p.icon} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
