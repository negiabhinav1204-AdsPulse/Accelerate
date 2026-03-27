'use client';

import * as React from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  Loader2Icon,
  SearchIcon,
  ShieldCheckIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  UsersIcon
} from 'lucide-react';

import { Badge } from '@workspace/ui/components/badge';
import { Button } from '@workspace/ui/components/button';
import { Input } from '@workspace/ui/components/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@workspace/ui/components/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@workspace/ui/components/table';

// ── Types ────────────────────────────────────────────────────────────────────

type Profile = {
  id: string;
  email: string | null;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  totalSpend: string | null;
  orderCount: number;
  lastOrderAt: string | null;
  firstOrderAt: string | null;
  isVip: boolean;
  isLapsed: boolean;
  tags: string[];
};

type Segment = {
  id: string;
  name: string;
  type: string;
  member_count: number;
};

type Overview = {
  total_profiles: number;
  vip_count: number;
  lapsed_count: number;
  avg_order_count: number;
  total_revenue: number;
};

type Props = {
  orgId: string;
  orgCurrency: string;
};

// ── Component ────────────────────────────────────────────────────────────────

export function CdpProfilesClient({ orgId, orgCurrency }: Props): React.JSX.Element {
  const [profiles, setProfiles] = React.useState<Profile[]>([]);
  const [segments, setSegments] = React.useState<Segment[]>([]);
  const [overview, setOverview] = React.useState<Overview | null>(null);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pages, setPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [segmentId, setSegmentId] = React.useState('');
  const [sort, setSort] = React.useState('total_spend_desc');
  const [note, setNote] = React.useState('');

  const searchRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  React.useEffect(() => {
    void fetchSegments();
    void fetchProfiles();
  }, []);

  React.useEffect(() => {
    void fetchProfiles();
  }, [page, segmentId, sort]);

  React.useEffect(() => {
    clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => {
      setPage(1);
      void fetchProfiles();
    }, 350);
  }, [search]);

  async function fetchSegments(): Promise<void> {
    try {
      const res = await fetch('/api/cdp/segments');
      if (res.ok) {
        const data = await res.json();
        setSegments(data.segments ?? []);
      }
    } catch { /* ignore */ }
  }

  async function fetchProfiles(): Promise<void> {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '50',
        sort,
        ...(search && { search }),
        ...(segmentId && { segment_id: segmentId }),
      });
      const res = await fetch(`/api/cdp/profiles?${params}`);
      if (res.ok) {
        const data = await res.json();
        setProfiles(data.profiles ?? []);
        setTotal(data.total ?? 0);
        setPages(data.pages ?? 1);
        if (data.overview) setOverview(data.overview);
        if (data.note) setNote(data.note);
      }
    } finally {
      setLoading(false);
    }
  }

  const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: orgCurrency, minimumFractionDigits: 0 });

  return (
    <div className="flex gap-6">
      {/* Segment sidebar */}
      <aside className="w-60 shrink-0 space-y-1">
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground px-2">
          Segments
        </p>
        <SegmentFilterItem
          label="All Customers"
          count={total}
          active={segmentId === ''}
          onClick={() => { setSegmentId(''); setPage(1); }}
        />
        {segments.map((seg) => (
          <SegmentFilterItem
            key={seg.id}
            label={seg.name}
            count={seg.member_count}
            active={segmentId === seg.id}
            onClick={() => { setSegmentId(seg.id); setPage(1); }}
          />
        ))}
        <div className="pt-3">
          <a
            href="segments"
            className="block rounded-lg border border-dashed px-3 py-2 text-center text-xs text-muted-foreground hover:border-foreground/20 hover:text-foreground transition-colors"
          >
            + Manage Segments
          </a>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-4">
        {note && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/30 dark:bg-amber-900/20 dark:text-amber-400">
            {note} — CDP service not yet deployed.
          </div>
        )}

        {/* Overview cards */}
        {overview && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total Profiles" value={overview.total_profiles.toLocaleString()} icon={<UsersIcon className="size-4" />} />
            <StatCard label="VIP" value={overview.vip_count.toLocaleString()} icon={<ShieldCheckIcon className="size-4 text-amber-500" />} />
            <StatCard label="Lapsed" value={overview.lapsed_count.toLocaleString()} icon={<TrendingDownIcon className="size-4 text-red-500" />} />
            <StatCard label="Total Revenue" value={fmt.format(overview.total_revenue)} icon={<TrendingUpIcon className="size-4 text-green-500" />} />
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-48">
            <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by email, name..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={sort} onValueChange={(v) => { setSort(v); setPage(1); }}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="total_spend_desc">Top spenders</SelectItem>
              <SelectItem value="order_count_desc">Most orders</SelectItem>
              <SelectItem value="last_order_desc">Most recent</SelectItem>
              <SelectItem value="created_desc">Newest profiles</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground ml-auto">
            {total.toLocaleString()} profiles
          </span>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : profiles.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="rounded-xl border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Orders</TableHead>
                    <TableHead className="text-right">Total Spend</TableHead>
                    <TableHead>Last Order</TableHead>
                    <TableHead>Tags</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((p) => (
                    <ProfileRow key={p.id} profile={p} fmt={fmt} />
                  ))}
                </TableBody>
              </Table>
            </div>

            {pages > 1 && (
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((n) => Math.max(1, n - 1))}
                >
                  <ArrowUpIcon className="size-4" />
                  Prev
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {page} of {pages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pages}
                  onClick={() => setPage((n) => n + 1)}
                >
                  Next
                  <ArrowDownIcon className="size-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function SegmentFilterItem({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
        active
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      <span className="truncate">{label}</span>
      <span className="ml-2 shrink-0 tabular-nums text-xs">{count.toLocaleString()}</span>
    </button>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function ProfileRow({
  profile: p,
  fmt,
}: {
  profile: Profile;
  fmt: Intl.NumberFormat;
}): React.JSX.Element {
  const name = [p.firstName, p.lastName].filter(Boolean).join(' ') || null;
  const initials = name
    ? name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : (p.email?.[0]?.toUpperCase() ?? '?');

  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
            {initials}
          </div>
          <div>
            {name && <p className="text-sm font-medium">{name}</p>}
            <p className="text-xs text-muted-foreground">{p.email ?? p.phone ?? 'Unknown'}</p>
          </div>
          {p.isVip && (
            <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600 text-xs ml-1">
              VIP
            </Badge>
          )}
          {p.isLapsed && (
            <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-600 text-xs ml-1">
              Lapsed
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-right text-sm tabular-nums">
        {p.orderCount}
      </TableCell>
      <TableCell className="text-right text-sm tabular-nums font-medium">
        {p.totalSpend ? fmt.format(parseFloat(p.totalSpend)) : '—'}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {p.lastOrderAt
          ? formatDistanceToNow(new Date(p.lastOrderAt), { addSuffix: true })
          : '—'}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {p.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      </TableCell>
    </TableRow>
  );
}

function EmptyState(): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center">
      <UsersIcon className="mb-4 size-12 text-muted-foreground/40" />
      <h3 className="mb-1 text-sm font-medium">No customer profiles yet</h3>
      <p className="text-sm text-muted-foreground">
        Connect a commerce store or ingest events to build your customer database.
      </p>
    </div>
  );
}
