'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircleIcon,
  BellIcon,
  CheckCircle2Icon,
  CheckCheckIcon,
  InfoIcon,
  MegaphoneIcon,
  ScanSearchIcon,
  TrendingUpIcon,
  WifiOffIcon,
  XIcon,
  ZapIcon,
} from 'lucide-react';

import { cn } from '@workspace/ui/lib/utils';
import { Button } from '@workspace/ui/components/button';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NotificationType =
  | 'campaign_failed'
  | 'campaign_published'
  | 'audit_ready'
  | 'budget_alert'
  | 'sync_failed'
  | 'optimization'
  | 'info';

interface NotificationItem {
  id: string;
  type: NotificationType;
  subject: string | null;
  content: string;
  link: string | null;
  seenAt: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TYPE_META: Record<NotificationType, { icon: React.ElementType; color: string; bg: string }> = {
  campaign_failed:   { icon: AlertCircleIcon,  color: 'text-red-500',    bg: 'bg-red-50 dark:bg-red-950/30' },
  campaign_published:{ icon: MegaphoneIcon,    color: 'text-green-600',  bg: 'bg-green-50 dark:bg-green-950/30' },
  audit_ready:       { icon: ScanSearchIcon,   color: 'text-blue-600',   bg: 'bg-blue-50 dark:bg-blue-950/30' },
  budget_alert:      { icon: TrendingUpIcon,   color: 'text-amber-500',  bg: 'bg-amber-50 dark:bg-amber-950/30' },
  sync_failed:       { icon: WifiOffIcon,      color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-950/30' },
  optimization:      { icon: ZapIcon,          color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-950/30' },
  info:              { icon: InfoIcon,         color: 'text-muted-foreground', bg: 'bg-muted/40' },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ---------------------------------------------------------------------------
// NotificationBell
// ---------------------------------------------------------------------------

export function NotificationBell({ orgSlug }: { orgSlug: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const panelRef = React.useRef<HTMLDivElement>(null);

  // Poll unread count every 30s
  React.useEffect(() => {
    void fetchCount();
    const interval = setInterval(() => void fetchCount(), 30_000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  async function fetchCount() {
    try {
      const res = await fetch('/api/notifications?limit=1');
      if (!res.ok) return;
      const data = await res.json() as { unreadCount: number };
      setUnreadCount(data.unreadCount ?? 0);
    } catch { /* ignore */ }
  }

  async function fetchNotifications() {
    setLoading(true);
    try {
      const res = await fetch('/api/notifications?limit=20&includeRead=true');
      if (!res.ok) return;
      const data = await res.json() as { notifications: NotificationItem[]; unreadCount: number };
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unreadCount ?? 0);
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function markAllRead() {
    await fetch('/api/notifications', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, seenAt: new Date().toISOString() })));
  }

  async function dismiss(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await fetch(`/api/notifications?id=${id}`, { method: 'DELETE' });
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

  function handleOpen() {
    setOpen((v) => !v);
    if (!open) void fetchNotifications();
  }

  function handleClick(n: NotificationItem) {
    if (!n.seenAt) {
      void fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [n.id] }),
      });
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, seenAt: new Date().toISOString() } : x));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    if (n.link) {
      setOpen(false);
      router.push(n.link);
    }
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        type="button"
        onClick={handleOpen}
        aria-label="Notifications"
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
      >
        <BellIcon className="size-4.5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-11 z-50 w-[380px] rounded-xl border border-border bg-card shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <BellIcon className="size-4 text-foreground" />
              <p className="text-sm font-semibold text-foreground">Notifications</p>
              {unreadCount > 0 && (
                <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <CheckCheckIcon className="size-3.5" />
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-[420px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="size-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <CheckCircle2Icon className="size-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">All caught up</p>
              </div>
            ) : (
              notifications.map((n) => {
                const meta = TYPE_META[n.type] ?? TYPE_META.info;
                const Icon = meta.icon;
                const isUnread = !n.seenAt;
                return (
                  <div
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={cn(
                      'flex items-start gap-3 px-4 py-3 border-b border-border/50 last:border-0 transition-colors',
                      n.link ? 'cursor-pointer hover:bg-muted/40' : 'cursor-default',
                      isUnread && 'bg-primary/[0.03]',
                    )}
                  >
                    {/* Icon */}
                    <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', meta.bg)}>
                      <Icon className={cn('size-4', meta.color)} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {n.subject && (
                        <p className={cn('text-xs font-semibold text-foreground leading-snug', isUnread && 'font-bold')}>
                          {n.subject}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground leading-snug mt-0.5 line-clamp-2">{n.content}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {isUnread && (
                        <span className="size-1.5 rounded-full bg-primary" />
                      )}
                      <button
                        type="button"
                        onClick={(e) => void dismiss(n.id, e)}
                        className="p-1 rounded text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/60 transition-colors"
                        aria-label="Dismiss"
                      >
                        <XIcon className="size-3" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs text-muted-foreground"
                onClick={() => { setOpen(false); router.push(`/organizations/${orgSlug}/settings/account/notifications`); }}
              >
                Notification settings
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
