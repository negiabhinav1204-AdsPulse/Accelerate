'use client';

import * as React from 'react';
import {
  AlertCircleIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  CheckCircle2Icon,
  CheckIcon,
  ChevronsUpDownIcon,
  ChevronDownIcon,
  ClockIcon,
  ExternalLinkIcon,
  FilterIcon,
  Loader2Icon,
  PackageIcon,
  RefreshCwIcon,
  SearchIcon,
  ShoppingCartIcon,
  StarIcon,
  StoreIcon,
  TagIcon,
  TrendingUpIcon,
  UsersIcon,
  XCircleIcon,
  ZapIcon,
  GhostIcon,
  TrendingDownIcon,
  SaveIcon
} from 'lucide-react';

import { Badge } from '@workspace/ui/components/badge';
import { Button } from '@workspace/ui/components/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@workspace/ui/components/command';
import { Input } from '@workspace/ui/components/input';
import { Popover, PopoverContent, PopoverTrigger } from '@workspace/ui/components/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@workspace/ui/components/select';
import { toast } from '@workspace/ui/components/sonner';
import { cn } from '@workspace/ui/lib/utils';

import { GOOGLE_TAXONOMY } from '~/lib/google-taxonomy';
import type { ChannelStatus, MockProduct } from '~/lib/platforms/shopify-mock';
import { AdvancedSettingsTab } from '~/components/shopping-feeds/advanced-settings-tab';
import { GoogleSetupWizard } from '~/components/shopping-feeds/google-setup-wizard';
import { useRole } from '~/hooks/use-role';

// ── Platform icons ────────────────────────────────────────────────────────────

function GoogleIconSm(): React.JSX.Element {
  return (
    <svg viewBox="0 0 48 48" className="size-3.5 shrink-0">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.18 1.48-4.97 2.31-8.16 2.31-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

function MetaIconSm(): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" className="size-3.5 shrink-0">
      <rect width="40" height="40" rx="8" fill="#0866FF"/>
      <path d="M8 22.5c0 3.5 1.8 6 4.5 6 1.4 0 2.6-.6 3.8-2.2l.2-.3.2.3c1.2 1.6 2.4 2.2 3.8 2.2 1.4 0 2.6-.6 3.5-1.9.3-.4.5-.9.7-1.4.4-1.1.6-2.4.6-3.8 0-1.7-.3-3.2-.9-4.3C23.7 15.9 22.5 15 21 15c-1.4 0-2.7.8-3.9 2.5l-.6.9-.6-.9C14.7 15.8 13.4 15 12 15c-1.5 0-2.7.9-3.4 2.4-.6 1.1-.9 2.6-.9 4.3v.8z" fill="white"/>
    </svg>
  );
}

function MicrosoftIconSm(): React.JSX.Element {
  return (
    <svg viewBox="0 0 40 40" className="size-3.5 shrink-0">
      <rect x="2" y="2" width="17" height="17" fill="#F25022"/>
      <rect x="21" y="2" width="17" height="17" fill="#7FBA00"/>
      <rect x="2" y="21" width="17" height="17" fill="#00A4EF"/>
      <rect x="21" y="21" width="17" height="17" fill="#FFB900"/>
    </svg>
  );
}

function ShopifyIcon(): React.JSX.Element {
  return (
    <svg viewBox="0 0 109 124" className="size-5 shrink-0" fill="none">
      <path d="M74.7 14.8s-.3-.1-.8-.3c-.1-.8-.5-3-1.1-5.3C70.6 3 68 .3 63.6.3c-.3 0-.5 0-.8.1-.1-.2-.3-.3-.5-.5-2-2-4.6-2.9-7.7-2.8-5.9.2-11.8 4.5-16.5 12.1-3.4 5.4-5.9 12.2-6.6 17.5L21 30.3c-3.5 1.1-3.5 1.1-4 4.4L7.6 116.2l75.6 13.1 36-8.7L74.7 14.8z" fill="#95BF47"/>
      <path d="M63.6.3c-.3 0-.5 0-.8.1-.1-.2-.3-.3-.5-.5-2-2-4.6-2.9-7.7-2.8-5.9.2-11.8 4.5-16.5 12.1-3.4 5.4-5.9 12.2-6.6 17.5L21 30.3c-3.5 1.1-3.5 1.1-4 4.4L7.6 116.2l75.6 13.1V14.5c-.3.3-8.9-14.2-19.6-14.2z" fill="#5E8E3E"/>
      <path d="M63.5 16.7l-3 9.2s-2.9-1.4-6.3-1.2c-5 .3-5.1 3.5-5 4.4.4 6.7 18.1 8.2 19.1 22.4.8 11.6-6.1 19.5-16 20.1-11.9.7-18.4-6.3-18.4-6.3l2.5-10.7s6.6 5 11.8 4.7c3.4-.2 4.7-3 4.6-5.1-.6-8.7-14.9-8.2-15.8-21.1-.8-11.3 6.7-22.7 23-23.7 6.6-.3 10.5 1.3 10.5 1.3z" fill="#fff"/>
    </svg>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPrice(price: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    maximumFractionDigits: 2
  }).format(price);
}

function formatRelativeTime(isoString: string | undefined): string {
  if (!isoString) return 'Never';
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function ChannelBadge({ status, label, icon }: { status: ChannelStatus; label: string; icon: React.ReactNode }): React.JSX.Element {
  const colors: Record<ChannelStatus, string> = {
    approved: 'bg-green-50 border-green-200 text-green-700',
    active: 'bg-green-50 border-green-200 text-green-700',
    pending: 'bg-amber-50 border-amber-200 text-amber-700',
    disapproved: 'bg-red-50 border-red-200 text-red-700',
    not_submitted: 'bg-gray-50 border-gray-200 text-gray-400'
  };
  const labels: Record<ChannelStatus, string> = {
    approved: 'Approved',
    active: 'Active',
    pending: 'Pending',
    disapproved: 'Disapproved',
    not_submitted: '–'
  };

  return (
    <div className={cn('flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium', colors[status])}>
      {icon}
      <span>{labels[status]}</span>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StoreConnectedBanner({ store, onSync, syncing, canSync }: {
  store: { storeName: string; shopDomain: string; productCount: number; lastSyncAt: string; currency: string };
  onSync: () => void;
  syncing: boolean;
  canSync: boolean;
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 mb-6">
      <div className="flex size-8 items-center justify-center rounded-lg bg-green-100">
        <CheckCircle2Icon className="size-4 text-green-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-green-900">{store.storeName}</p>
        <p className="text-xs text-green-700">{store.shopDomain} · {store.productCount} products · Last synced {formatRelativeTime(store.lastSyncAt)}</p>
      </div>
      {canSync && (
        <Button
          size="sm"
          variant="outline"
          onClick={onSync}
          disabled={syncing}
          className="shrink-0 gap-1.5 border-green-300 text-green-700 hover:bg-green-100"
        >
          {syncing ? <Loader2Icon className="size-3.5 animate-spin" /> : <RefreshCwIcon className="size-3.5" />}
          Sync Now
        </Button>
      )}
    </div>
  );
}

function NoStoreState({ orgSlug }: { orgSlug: string }): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-[#95BF47]/10 mb-4">
        <ShopifyIcon />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">Connect your Shopify store</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        Connect your Shopify store to sync your product catalog and submit feeds to Google Shopping, Meta Catalog, and Microsoft Shopping.
      </p>
      <Button
        className="gap-2"
        onClick={() => window.location.href = `/organizations/${orgSlug}/connectors`}
      >
        <ShoppingCartIcon className="size-4" />
        Connect Shopify Store
      </Button>
      <p className="text-xs text-muted-foreground mt-3">Takes under 2 minutes — no coding required</p>
    </div>
  );
}

// ── Products Tab ──────────────────────────────────────────────────────────────

type ProductViewTab = 'all' | 'warnings' | 'excluded';
type StockFilter = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock';
type SortOption = 'velocity_desc' | 'velocity_asc' | 'price_desc' | 'price_asc' | 'inventory_asc' | 'inventory_desc';

function classifyBadge(p: MockProduct): 'best_seller' | 'trending' | 'high_value' | 'low_stock' | '' {
  if (p.velocity_30d > 20) return 'best_seller';
  if (p.velocity_30d > 8) return 'trending';
  if (p.price > 150 && p.velocity_30d > 0) return 'high_value';
  if (p.inventory > 0 && p.inventory < 10) return 'low_stock';
  return '';
}

const BADGE_CONFIG = {
  best_seller: { label: 'Best Seller', icon: StarIcon, className: 'bg-amber-50 text-amber-700 border-amber-200' },
  trending: { label: 'Trending', icon: TrendingUpIcon, className: 'bg-blue-50 text-blue-700 border-blue-200' },
  high_value: { label: 'High Value', icon: ArrowUpIcon, className: 'bg-purple-50 text-purple-700 border-purple-200' },
  low_stock: { label: 'Low Stock', icon: ArrowDownIcon, className: 'bg-red-50 text-red-600 border-red-200' },
};

function ProductsTab({ products, loading }: { products: MockProduct[]; loading: boolean }): React.JSX.Element {
  const [search, setSearch] = React.useState('');
  const [viewTab, setViewTab] = React.useState<ProductViewTab>('all');
  const [stockFilter, setStockFilter] = React.useState<StockFilter>('all');
  const [sortBy, setSortBy] = React.useState<SortOption>('velocity_desc');

  // Derive per-tab counts from full product list
  const counts = React.useMemo(() => {
    let warnings = 0, excluded = 0;
    for (const p of products) {
      const statuses = Object.values(p.channelStatus);
      const hasIssue = (p.issues?.length ?? 0) > 0 || statuses.some((s) => s === 'disapproved');
      const isExcluded = statuses.every((s) => s === 'not_submitted') && p.inventory === 0;
      if (hasIssue) warnings++;
      if (isExcluded) excluded++;
    }
    return { all: products.length, warnings, excluded };
  }, [products]);

  // Stats cards (derived from full list regardless of tab)
  const stats = React.useMemo(() => {
    let approved = 0, pending = 0, disapproved = 0, notSubmitted = 0;
    for (const p of products) {
      const statuses = Object.values(p.channelStatus);
      if (statuses.some((s) => s === 'disapproved')) disapproved++;
      else if (statuses.every((s) => s === 'approved' || s === 'active')) approved++;
      else if (statuses.some((s) => s === 'pending')) pending++;
      else notSubmitted++;
    }
    return { approved, pending, disapproved, notSubmitted };
  }, [products]);

  // Tab filter → stock filter → search filter → sort
  const tabFiltered = React.useMemo(() => {
    if (viewTab === 'warnings') {
      return products.filter((p) => {
        const statuses = Object.values(p.channelStatus);
        return (p.issues?.length ?? 0) > 0 || statuses.some((s) => s === 'disapproved');
      });
    }
    if (viewTab === 'excluded') {
      return products.filter((p) => {
        const statuses = Object.values(p.channelStatus);
        return statuses.every((s) => s === 'not_submitted') && p.inventory === 0;
      });
    }
    return products;
  }, [products, viewTab]);

  const stockFiltered = React.useMemo(() => {
    if (stockFilter === 'out_of_stock') return tabFiltered.filter((p) => p.inventory === 0);
    if (stockFilter === 'low_stock') return tabFiltered.filter((p) => p.inventory > 0 && p.inventory < 10);
    if (stockFilter === 'in_stock') return tabFiltered.filter((p) => p.inventory >= 10);
    return tabFiltered;
  }, [tabFiltered, stockFilter]);

  const searched = stockFiltered.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const filtered = React.useMemo(() => {
    const arr = [...searched];
    switch (sortBy) {
      case 'velocity_desc': return arr.sort((a, b) => b.velocity_30d - a.velocity_30d);
      case 'velocity_asc':  return arr.sort((a, b) => a.velocity_30d - b.velocity_30d);
      case 'price_desc':    return arr.sort((a, b) => b.price - a.price);
      case 'price_asc':     return arr.sort((a, b) => a.price - b.price);
      case 'inventory_asc': return arr.sort((a, b) => a.inventory - b.inventory);
      case 'inventory_desc':return arr.sort((a, b) => b.inventory - a.inventory);
      default: return arr;
    }
  }, [searched, sortBy]);

  const PRODUCT_TABS: { id: ProductViewTab; label: string; count: number }[] = [
    { id: 'all', label: 'All Products', count: counts.all },
    { id: 'warnings', label: 'Warnings', count: counts.warnings },
    { id: 'excluded', label: 'Excluded', count: counts.excluded }
  ];

  return (
    <div>
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Approved', value: stats.approved, color: 'text-green-600', bg: 'bg-green-50', icon: <CheckCircle2Icon className="size-4" /> },
          { label: 'Pending Review', value: stats.pending, color: 'text-amber-600', bg: 'bg-amber-50', icon: <ClockIcon className="size-4" /> },
          { label: 'Disapproved', value: stats.disapproved, color: 'text-red-600', bg: 'bg-red-50', icon: <XCircleIcon className="size-4" /> },
          { label: 'Not Submitted', value: stats.notSubmitted, color: 'text-gray-500', bg: 'bg-gray-50', icon: <PackageIcon className="size-4" /> }
        ].map((stat) => (
          <div key={stat.label} className={cn('rounded-xl border p-3', stat.bg)}>
            <div className={cn('flex items-center gap-1.5 mb-1', stat.color)}>
              {stat.icon}
              <span className="text-xs font-medium">{stat.label}</span>
            </div>
            <p className={cn('text-2xl font-bold', stat.color)}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Product view tabs */}
      <div className="flex items-center gap-1 border-b border-border mb-4">
        {PRODUCT_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => { setViewTab(tab.id); setSearch(''); }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
              viewTab === tab.id
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
            )}
          >
            {tab.label}
            <span className={cn(
              'rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
              viewTab === tab.id ? 'bg-blue-100 text-blue-700' : 'bg-muted text-muted-foreground'
            )}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tab description for non-All tabs */}
      {viewTab === 'warnings' && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 mb-4">
          <AlertCircleIcon className="size-4 text-amber-600 shrink-0" />
          <p className="text-xs text-amber-800">Products with disapproved status or feed issues that need attention.</p>
        </div>
      )}
      {viewTab === 'excluded' && (
        <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 mb-4">
          <XCircleIcon className="size-4 text-gray-500 shrink-0" />
          <p className="text-xs text-gray-600">Products excluded from all channels — out of stock and not submitted anywhere.</p>
        </div>
      )}

      {/* Search + filter + sort row */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search products or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <Select value={stockFilter} onValueChange={(v) => setStockFilter(v as StockFilter)}>
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue placeholder="Stock status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stock</SelectItem>
            <SelectItem value="in_stock">In Stock</SelectItem>
            <SelectItem value="low_stock">Low Stock</SelectItem>
            <SelectItem value="out_of_stock">Out of Stock</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
          <SelectTrigger className="h-9 w-[170px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="velocity_desc">Velocity: High → Low</SelectItem>
            <SelectItem value="velocity_asc">Velocity: Low → High</SelectItem>
            <SelectItem value="price_desc">Price: High → Low</SelectItem>
            <SelectItem value="price_asc">Price: Low → High</SelectItem>
            <SelectItem value="inventory_asc">Inventory: Low → High</SelectItem>
            <SelectItem value="inventory_desc">Inventory: High → Low</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground ml-auto">{filtered.length} products</span>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left font-medium text-muted-foreground px-4 py-3 w-[340px]">Product</th>
                <th className="text-left font-medium text-muted-foreground px-3 py-3">Price</th>
                <th className="text-center font-medium text-muted-foreground px-3 py-3">Stock</th>
                <th className="text-center font-medium text-muted-foreground px-3 py-3">
                  <div className="flex items-center justify-center gap-1"><ZapIcon className="size-3" />30d Sold</div>
                </th>
                <th className="text-center font-medium text-muted-foreground px-3 py-3">
                  <div className="flex items-center justify-center gap-1"><GoogleIconSm />Google</div>
                </th>
                <th className="text-center font-medium text-muted-foreground px-3 py-3">
                  <div className="flex items-center justify-center gap-1"><MetaIconSm />Meta</div>
                </th>
                <th className="text-center font-medium text-muted-foreground px-3 py-3">
                  <div className="flex items-center justify-center gap-1"><MicrosoftIconSm />Microsoft</div>
                </th>
                <th className="text-right font-medium text-muted-foreground px-4 py-3">Sync</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    <Loader2Icon className="size-5 animate-spin mx-auto mb-2" />
                    Loading products...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">No products match your search.</td>
                </tr>
              ) : (
                filtered.map((product) => (
                  <tr key={product.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={product.imageUrl}
                          alt={product.title}
                          className="size-10 rounded-lg object-cover border border-border shrink-0"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(product.brand)}&size=40&background=f3f4f6`;
                          }}
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-medium text-foreground leading-tight truncate max-w-[200px]">{product.title}</p>
                            {(() => {
                              const badge = classifyBadge(product);
                              if (!badge) return null;
                              const cfg = BADGE_CONFIG[badge];
                              const Icon = cfg.icon;
                              return (
                                <span className={cn('inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold shrink-0', cfg.className)}>
                                  <Icon className="size-2.5" />{cfg.label}
                                </span>
                              );
                            })()}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            SKU: {product.sku}
                            {product.variants > 1 && ` · ${product.variants} variants`}
                          </p>
                          {product.issues && product.issues.length > 0 && (
                            <div className="flex items-center gap-1 mt-1">
                              <AlertCircleIcon className="size-3 text-red-500 shrink-0" />
                              <span className="text-xs text-red-600 truncate">{product.issues[0]}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div>
                        {product.salePrice ? (
                          <>
                            <p className="font-semibold text-foreground">{formatPrice(product.salePrice, product.currency)}</p>
                            <p className="text-xs text-muted-foreground line-through">{formatPrice(product.price, product.currency)}</p>
                          </>
                        ) : (
                          <p className="font-semibold text-foreground">{formatPrice(product.price, product.currency)}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={cn('text-sm font-medium', product.inventory === 0 ? 'text-red-500' : product.inventory < 10 ? 'text-amber-600' : 'text-foreground')}>
                        {product.inventory === 0 ? 'Out of stock' : product.inventory}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span className={cn('text-sm font-medium', product.velocity_30d > 0 ? 'text-foreground' : 'text-muted-foreground')}>
                        {product.velocity_30d > 0 ? product.velocity_30d : '—'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex justify-center">
                        <ChannelBadge status={product.channelStatus.google} label="Google" icon={<GoogleIconSm />} />
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex justify-center">
                        <ChannelBadge status={product.channelStatus.meta} label="Meta" icon={<MetaIconSm />} />
                      </div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex justify-center">
                        <ChannelBadge status={product.channelStatus.microsoft} label="Microsoft" icon={<MicrosoftIconSm />} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button className="text-xs text-primary hover:underline font-medium whitespace-nowrap">
                        Submit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Feed Settings Tab ─────────────────────────────────────────────────────────

type ConnectedAccount = { accountId: string; accountName: string } | null;

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors',
        checked ? 'bg-blue-600' : 'bg-gray-200'
      )}
    >
      <span className={cn(
        'pointer-events-none inline-block size-4 rounded-full bg-white shadow ring-0 transition-transform',
        checked ? 'translate-x-4' : 'translate-x-0'
      )} />
    </button>
  );
}

function CategoryCombobox({
  value,
  onChange,
  placeholder = 'Search categories…'
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}): React.JSX.Element {
  const [open, setOpen] = React.useState(false);

  const selectedLabel = value
    ? (GOOGLE_TAXONOMY.find((t) => t.name === value)?.name ?? value)
    : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'flex h-9 w-full items-center justify-between rounded-lg border border-border bg-background px-3 py-2 text-xs shadow-sm transition-colors hover:border-gray-300 focus:outline-none',
            !selectedLabel && 'text-muted-foreground'
          )}
        >
          <span className="truncate">{selectedLabel ?? placeholder}</span>
          <ChevronsUpDownIcon className="ml-2 size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search Google taxonomy…" className="h-9 text-xs" />
          <CommandList className="max-h-60">
            <CommandEmpty className="py-4 text-center text-xs text-muted-foreground">No category found.</CommandEmpty>
            <CommandGroup>
              {value && (
                <CommandItem
                  value="__clear__"
                  onSelect={() => { onChange(''); setOpen(false); }}
                  className="text-xs text-muted-foreground italic"
                >
                  Clear selection
                </CommandItem>
              )}
              {GOOGLE_TAXONOMY.map((entry) => (
                <CommandItem
                  key={entry.id}
                  value={entry.name}
                  onSelect={() => { onChange(entry.name); setOpen(false); }}
                  className="text-xs"
                >
                  <CheckIcon className={cn('mr-2 size-3.5 shrink-0', value === entry.name ? 'opacity-100' : 'opacity-0')} />
                  {entry.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function FeedSettingsTab({ orgId }: { orgId: string }): React.JSX.Element {
  const [loadingSettings, setLoadingSettings] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const [channels, setChannels] = React.useState({
    google: true,
    meta: true,
    microsoft: true
  });

  const [connectedAccounts, setConnectedAccounts] = React.useState<{
    google: ConnectedAccount;
    meta: ConnectedAccount;
    bing: ConnectedAccount;
  }>({ google: null, meta: null, bing: null });

  const [settings, setSettings] = React.useState({
    titlePreference: 'default',
    variantPreference: 'all',
    enableSalePrice: true,
    enableUtmTracking: true,
    appendVariantToTitle: false,
    richDescriptions: false,
    submitAdditionalImages: false,
    productIdFormat: 'global',
    inventoryPolicy: 'ignore',
    defaultAgeGroup: '',
    defaultGoogleCategory: '',
    merchantCenterId: ''
  });

  // Load from API
  React.useEffect(() => {
    void fetch(`/api/shopping-feeds/settings?orgId=${orgId}`)
      .then((r) => r.json())
      .then((data: {
        hasStore?: boolean;
        settings?: Record<string, unknown>;
        connectedAccounts?: { google: ConnectedAccount; meta: ConnectedAccount; bing: ConnectedAccount };
      }) => {
        if (data.settings) {
          const s = data.settings;
          const channelsArr = Array.isArray(s.channels) ? (s.channels as string[]) : ['google', 'meta', 'microsoft'];
          setChannels({
            google: channelsArr.includes('google'),
            meta: channelsArr.includes('meta'),
            microsoft: channelsArr.includes('microsoft') || channelsArr.includes('bing')
          });
          setSettings((prev) => ({
            ...prev,
            titlePreference: (s.titlePreference as string) ?? 'default',
            variantPreference: (s.variantPreference as string) ?? 'all',
            enableSalePrice: (s.enableSalePrice as boolean) ?? true,
            enableUtmTracking: (s.enableUtmTracking as boolean) ?? true,
            appendVariantToTitle: (s.appendVariantToTitle as boolean) ?? false,
            richDescriptions: (s.richDescriptions as boolean) ?? false,
            submitAdditionalImages: (s.submitAdditionalImages as boolean) ?? false,
            productIdFormat: (s.productIdFormat as string) ?? 'global',
            inventoryPolicy: (s.inventoryPolicy as string) ?? 'ignore',
            defaultAgeGroup: (s.defaultAgeGroup as string) ?? '',
            defaultGoogleCategory: (s.defaultGoogleCategory as string) ?? '',
            merchantCenterId: (s.merchantCenterId as string) ?? ''
          }));
        }
        if (data.connectedAccounts) {
          setConnectedAccounts(data.connectedAccounts);
        }
      })
      .finally(() => setLoadingSettings(false));
  }, [orgId]);

  async function handleSave(): Promise<void> {
    setSaving(true);
    try {
      const channelsArr = [
        channels.google && 'google',
        channels.meta && 'meta',
        channels.microsoft && 'bing'
      ].filter(Boolean) as string[];

      const res = await fetch('/api/shopping-feeds/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          channels: channelsArr,
          ...settings,
          defaultAgeGroup: settings.defaultAgeGroup || null,
          defaultGoogleCategory: settings.defaultGoogleCategory || null,
          merchantCenterId: settings.merchantCenterId || null
        })
      });
      if (!res.ok) throw new Error('save failed');
      toast.success('Feed settings saved');
    } catch {
      toast.error('Failed to save settings. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loadingSettings) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">

      {/* ── Active Channels ── */}
      <div className="rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold text-foreground mb-1">Active Channels</h3>
        <p className="text-xs text-muted-foreground mb-4">Choose which ad platforms receive your product feed.</p>
        <div className="space-y-3">
          {[
            { key: 'google', label: 'Google Shopping', desc: 'Submit to Google Merchant Center for Shopping ads and free listings.', icon: <GoogleIconSm /> },
            { key: 'meta', label: 'Meta Product Catalog', desc: 'Sync product catalog to Meta for Dynamic Product Ads on Facebook & Instagram.', icon: <MetaIconSm /> },
            { key: 'microsoft', label: 'Microsoft Shopping', desc: 'Submit to Microsoft Merchant Center for Bing Shopping campaigns.', icon: <MicrosoftIconSm /> }
          ].map((ch) => (
            <div key={ch.key} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/20 transition-colors">
              <div className="mt-0.5">{ch.icon}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{ch.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{ch.desc}</p>
              </div>
              <Toggle
                checked={channels[ch.key as keyof typeof channels]}
                onChange={(v) => setChannels((prev) => ({ ...prev, [ch.key]: v }))}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Per-channel panels ── */}
      {(channels.google || channels.meta || channels.microsoft) && (
        <div className="space-y-3">
          {/* Google panel */}
          {channels.google && (
            <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-5">
              <div className="flex items-center gap-2 mb-4">
                <GoogleIconSm />
                <h3 className="text-sm font-semibold text-foreground">Google Shopping Settings</h3>
              </div>
              <div className="space-y-4">
                {/* Connected account */}
                <div>
                  <p className="text-xs font-medium text-foreground mb-1.5">Connected Account</p>
                  {connectedAccounts.google ? (
                    <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                      <CheckCircle2Icon className="size-3.5 text-green-600 shrink-0" />
                      <span className="text-xs text-green-800 font-medium">{connectedAccounts.google.accountName}</span>
                      <span className="text-xs text-green-600 ml-auto font-mono">{connectedAccounts.google.accountId}</span>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                      No Google Ads account connected
                    </div>
                  )}
                </div>
                {/* Merchant Center ID */}
                <div>
                  <label className="text-xs font-medium text-foreground mb-1.5 block">Merchant Center ID</label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="e.g. 123456789"
                    maxLength={20}
                    value={settings.merchantCenterId}
                    onChange={(e) => setSettings((s) => ({ ...s, merchantCenterId: e.target.value.replace(/\D/g, '') }))}
                    className="h-8 text-sm font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">Your Google Merchant Center account ID. Found in the GMC dashboard URL.</p>
                </div>
                {/* Default category */}
                <div>
                  <label className="text-xs font-medium text-foreground mb-1.5 block">Default Google Category</label>
                  <CategoryCombobox
                    value={settings.defaultGoogleCategory}
                    onChange={(v) => setSettings((s) => ({ ...s, defaultGoogleCategory: v }))}
                    placeholder="Search Google Product Taxonomy…"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">Applied when a product has no category set. Also used for Meta Catalog.</p>
                </div>
              </div>
            </div>
          )}

          {/* Meta panel */}
          {channels.meta && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-5">
              <div className="flex items-center gap-2 mb-4">
                <MetaIconSm />
                <h3 className="text-sm font-semibold text-foreground">Meta Catalog Settings</h3>
              </div>
              <div className="space-y-4">
                {/* Connected account */}
                <div>
                  <p className="text-xs font-medium text-foreground mb-1.5">Connected Account</p>
                  {connectedAccounts.meta ? (
                    <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                      <CheckCircle2Icon className="size-3.5 text-green-600 shrink-0" />
                      <span className="text-xs text-green-800 font-medium">{connectedAccounts.meta.accountName}</span>
                      <span className="text-xs text-green-600 ml-auto font-mono">{connectedAccounts.meta.accountId}</span>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                      No Meta Ads account connected
                    </div>
                  )}
                </div>
                {/* Category — shared with Google */}
                <div>
                  <label className="text-xs font-medium text-foreground mb-1.5 block">Default Meta Category</label>
                  <CategoryCombobox
                    value={settings.defaultGoogleCategory}
                    onChange={(v) => setSettings((s) => ({ ...s, defaultGoogleCategory: v }))}
                    placeholder="Search Google Product Taxonomy…"
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">Shared with Google Shopping. Uses Google Product Taxonomy.</p>
                </div>
              </div>
            </div>
          )}

          {/* Microsoft panel */}
          {channels.microsoft && (
            <div className="rounded-xl border border-orange-100 bg-orange-50/30 p-5">
              <div className="flex items-center gap-2 mb-4">
                <MicrosoftIconSm />
                <h3 className="text-sm font-semibold text-foreground">Microsoft Shopping Settings</h3>
              </div>
              <div>
                <p className="text-xs font-medium text-foreground mb-1.5">Connected Account</p>
                {connectedAccounts.bing ? (
                  <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                    <CheckCircle2Icon className="size-3.5 text-green-600 shrink-0" />
                    <span className="text-xs text-green-800 font-medium">{connectedAccounts.bing.accountName}</span>
                    <span className="text-xs text-green-600 ml-auto font-mono">{connectedAccounts.bing.accountId}</span>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                    No Microsoft Ads account connected
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Product Data ── */}
      <div className="rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold text-foreground mb-1">Product Data</h3>
        <p className="text-xs text-muted-foreground mb-4">Control how your product information is submitted to ad channels.</p>
        <div className="space-y-5">

          {/* Title Format */}
          <div>
            <label className="text-xs font-medium text-foreground mb-2 block">Title Format</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: 'default', label: 'Default', desc: 'Use Shopify product title as-is' },
                { value: 'optimized', label: 'Optimized', desc: 'Add brand + attributes automatically' }
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSettings((s) => ({ ...s, titlePreference: opt.value }))}
                  className={cn(
                    'text-left p-3 rounded-lg border transition-all',
                    settings.titlePreference === opt.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-border hover:border-gray-300'
                  )}
                >
                  <p className="text-xs font-medium">{opt.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Variant Handling */}
          <div>
            <label className="text-xs font-medium text-foreground mb-2 block">Variant Handling</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'all', label: 'All Variants' },
                { value: 'main', label: 'Main Only' },
                { value: 'in_stock', label: 'In Stock' }
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSettings((s) => ({ ...s, variantPreference: opt.value }))}
                  className={cn(
                    'text-xs font-medium p-2.5 rounded-lg border transition-all',
                    settings.variantPreference === opt.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-border hover:border-gray-300 text-foreground'
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Product ID Format */}
          <div>
            <label className="text-xs font-medium text-foreground mb-2 block">Product ID Format</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'global', label: 'Global ID', desc: "Shopify's global product ID" },
                { value: 'sku', label: 'SKU', desc: 'Product SKU from Shopify' },
                { value: 'variant', label: 'Variant ID', desc: 'Shopify variant-level ID' }
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSettings((s) => ({ ...s, productIdFormat: opt.value }))}
                  className={cn(
                    'text-left p-3 rounded-lg border transition-all',
                    settings.productIdFormat === opt.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-border hover:border-gray-300'
                  )}
                >
                  <p className="text-xs font-medium">{opt.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Default Age Group */}
          <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">
              Default Age Group <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <select
              value={settings.defaultAgeGroup}
              onChange={(e) => setSettings((s) => ({ ...s, defaultAgeGroup: e.target.value }))}
              className="h-9 w-full rounded-lg border border-border bg-background px-3 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Not set — infer per product</option>
              <option value="newborn">Newborn (up to 3 months)</option>
              <option value="infant">Infant (3–12 months)</option>
              <option value="toddler">Toddler (1–5 years)</option>
              <option value="kids">Kids (5–13 years)</option>
              <option value="adult">Adult</option>
            </select>
            <p className="text-[11px] text-muted-foreground mt-1">Applied to all active channels when not set per product.</p>
          </div>

        </div>
      </div>

      {/* ── Inventory & Sync ── */}
      <div className="rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold text-foreground mb-1">Inventory Policy</h3>
        <p className="text-xs text-muted-foreground mb-4">Control how out-of-stock products are handled in your feed.</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { value: 'follow', label: 'Follow Shopify', desc: 'Exclude out-of-stock products from the feed automatically.' },
            { value: 'ignore', label: 'Ignore & Include', desc: 'Include all products regardless of inventory level.' }
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSettings((s) => ({ ...s, inventoryPolicy: opt.value }))}
              className={cn(
                'text-left p-3 rounded-lg border transition-all',
                settings.inventoryPolicy === opt.value
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-border hover:border-gray-300'
              )}
            >
              <p className="text-xs font-medium">{opt.label}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{opt.desc}</p>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">This coexists with any "Exclude out-of-stock" rules you set in the Rules tab.</p>
      </div>

      {/* ── Advanced Settings ── */}
      <div className="rounded-xl border border-border p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">Advanced Settings</h3>
        <div className="space-y-3">
          {[
            { key: 'enableSalePrice', label: 'Include sale prices', desc: 'Submit compare-at price as the original price so discounts show in ads.' },
            { key: 'enableUtmTracking', label: 'Auto UTM tracking', desc: 'Append utm_source=accelerate&utm_medium=cpc to product URLs.' },
            { key: 'appendVariantToTitle', label: 'Append variant to title', desc: 'Add color/size to title (e.g. "Blue T-Shirt – Large").' },
            { key: 'richDescriptions', label: 'Rich descriptions', desc: 'Use full product description including HTML bullet points.' },
            { key: 'submitAdditionalImages', label: 'Submit additional images', desc: 'Include all product images, not just the first one.' }
          ].map((setting) => (
            <div key={setting.key} className="flex items-start justify-between gap-4 py-2">
              <div>
                <p className="text-sm font-medium text-foreground">{setting.label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{setting.desc}</p>
              </div>
              <Toggle
                checked={settings[setting.key as keyof typeof settings] as boolean}
                onChange={(v) => setSettings((s) => ({ ...s, [setting.key]: v }))}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving && <Loader2Icon className="size-3.5 animate-spin" />}
          Save Settings
        </Button>
      </div>
    </div>
  );
}

// ── Rules Tab ─────────────────────────────────────────────────────────────────

type RuleCondition = {
  field: string;
  operator: string;
  value: string;
};

type RuleAction = {
  type: string;
  value: string;
};

type FeedRule = {
  id: string;
  name: string;
  channels: string[];
  conditions: RuleCondition[];
  actions: RuleAction[];
  isActive: boolean;
  priority: number;
};

const CHANNEL_COLORS: Record<string, string> = {
  google: 'bg-blue-50 text-blue-700 border-blue-200',
  meta: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  microsoft: 'bg-orange-50 text-orange-700 border-orange-200',
  bing: 'bg-orange-50 text-orange-700 border-orange-200'
};

const CHANNEL_LABEL: Record<string, string> = {
  google: 'Google',
  meta: 'Meta',
  microsoft: 'Microsoft',
  bing: 'Microsoft'
};

const CONDITION_FIELDS = [
  { value: 'inventory_quantity', label: 'Inventory quantity' },
  { value: 'product_type', label: 'Product type' },
  { value: 'product_status', label: 'Product status' },
  { value: 'brand', label: 'Brand / Vendor' },
  { value: 'title', label: 'Product title' },
  { value: 'price', label: 'Price' },
  { value: 'tag', label: 'Tag' },
  { value: 'sku', label: 'SKU' },
  { value: 'barcode', label: 'Barcode / GTIN' }
] as const;

const OPERATORS_BY_FIELD: Record<string, { value: string; label: string }[]> = {
  inventory_quantity: [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'does not equal' },
    { value: 'greater_than', label: 'is greater than' },
    { value: 'less_than', label: 'is less than' }
  ],
  price: [
    { value: 'equals', label: 'equals' },
    { value: 'greater_than', label: 'is greater than' },
    { value: 'less_than', label: 'is less than' }
  ],
  product_status: [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'does not equal' }
  ],
  _default: [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'does not equal' },
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: 'does not contain' },
    { value: 'starts_with', label: 'starts with' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' }
  ]
};

const FIELD_VALUES: Record<string, string[]> = {
  product_status: ['active', 'draft', 'archived']
};

const ACTION_TYPES = [
  { value: 'exclude', label: 'Exclude product from feed', hasValue: false },
  { value: 'prepend_title', label: 'Prepend text to title', hasValue: true, placeholder: 'e.g. [Brand]' },
  { value: 'append_title', label: 'Append text to title', hasValue: true, placeholder: 'e.g. – Large' },
  { value: 'set_category', label: 'Set Google category', hasValue: true, placeholder: 'e.g. Apparel & Accessories > Shoes' },
  { value: 'set_custom_label_0', label: 'Set Custom Label 0', hasValue: true, placeholder: 'Label value' },
  { value: 'set_custom_label_1', label: 'Set Custom Label 1', hasValue: true, placeholder: 'Label value' },
  { value: 'set_brand', label: 'Override brand', hasValue: true, placeholder: 'Brand name' },
  { value: 'set_description', label: 'Override description', hasValue: true, placeholder: 'Description text' }
] as const;

function conditionSummary(c: RuleCondition): string {
  const field = CONDITION_FIELDS.find((f) => f.value === c.field)?.label ?? c.field;
  const op = c.operator.replace(/_/g, ' ');
  if (c.operator === 'is_empty' || c.operator === 'is_not_empty') return `${field} ${op}`;
  return `${field} ${op} "${c.value}"`;
}

function actionSummary(a: RuleAction): string {
  const type = ACTION_TYPES.find((t) => t.value === a.type);
  if (!type) return a.type;
  if (!('hasValue' in type) || !type.hasValue) return type.label;
  return `${type.label}: "${a.value}"`;
}

// ── Rule Builder Dialog ───────────────────────────────────────────────────────

function RuleBuilderDialog({
  open,
  onClose,
  onSave,
  initial
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: Omit<FeedRule, 'id' | 'priority'>) => Promise<void>;
  initial?: FeedRule;
}): React.JSX.Element | null {
  const [name, setName] = React.useState(initial?.name ?? '');
  const [channels, setChannels] = React.useState<string[]>(initial?.channels ?? ['google', 'meta', 'microsoft']);
  const [conditions, setConditions] = React.useState<RuleCondition[]>(
    initial?.conditions?.length ? initial.conditions : [{ field: 'inventory_quantity', operator: 'equals', value: '0' }]
  );
  const [actions, setActions] = React.useState<RuleAction[]>(
    initial?.actions?.length ? initial.actions : [{ type: 'exclude', value: '' }]
  );
  const [saving, setSaving] = React.useState(false);

  // Reset when dialog opens with new initial
  React.useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setChannels(initial?.channels ?? ['google', 'meta', 'microsoft']);
      setConditions(initial?.conditions?.length ? initial.conditions : [{ field: 'inventory_quantity', operator: 'equals', value: '0' }]);
      setActions(initial?.actions?.length ? initial.actions : [{ type: 'exclude', value: '' }]);
    }
  }, [open, initial]);

  function toggleChannel(ch: string): void {
    setChannels((prev) => prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch]);
  }

  function updateCondition(idx: number, patch: Partial<RuleCondition>): void {
    setConditions((prev) => prev.map((c, i) => {
      if (i !== idx) return c;
      const updated = { ...c, ...patch };
      // Reset operator when field changes
      if (patch.field && patch.field !== c.field) {
        const ops = OPERATORS_BY_FIELD[patch.field] ?? OPERATORS_BY_FIELD._default!;
        updated.operator = ops[0]!.value;
        updated.value = '';
      }
      return updated;
    }));
  }

  function addCondition(): void {
    setConditions((prev) => [...prev, { field: 'product_type', operator: 'contains', value: '' }]);
  }

  function removeCondition(idx: number): void {
    setConditions((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateAction(idx: number, patch: Partial<RuleAction>): void {
    setActions((prev) => prev.map((a, i) => i === idx ? { ...a, ...patch } : a));
  }

  function addAction(): void {
    setActions((prev) => [...prev, { type: 'exclude', value: '' }]);
  }

  function removeAction(idx: number): void {
    setActions((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave(): Promise<void> {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), channels, conditions, actions, isActive: initial?.isActive ?? true });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-background rounded-2xl border border-border shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
        <div className="sticky top-0 bg-background border-b border-border px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">{initial ? 'Edit Rule' : 'Add Rule'}</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <XCircleIcon className="size-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Rule name */}
          <div>
            <label className="text-xs font-medium text-foreground mb-1.5 block">Rule Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Exclude out-of-stock items"
              className="h-9 text-sm"
            />
          </div>

          {/* Channels */}
          <div>
            <label className="text-xs font-medium text-foreground mb-2 block">Apply to Channels</label>
            <div className="flex gap-2">
              {[
                { key: 'google', label: 'Google', icon: <GoogleIconSm /> },
                { key: 'meta', label: 'Meta', icon: <MetaIconSm /> },
                { key: 'microsoft', label: 'Microsoft', icon: <MicrosoftIconSm /> }
              ].map((ch) => (
                <button
                  key={ch.key}
                  type="button"
                  onClick={() => toggleChannel(ch.key)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all',
                    channels.includes(ch.key)
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-border text-muted-foreground hover:border-gray-300'
                  )}
                >
                  {ch.icon}
                  {ch.label}
                </button>
              ))}
            </div>
          </div>

          {/* Conditions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-foreground">Conditions (ALL must match)</label>
              <button type="button" onClick={addCondition} className="text-xs text-blue-600 hover:underline font-medium">
                + Add condition
              </button>
            </div>
            <div className="space-y-2">
              {conditions.map((cond, idx) => {
                const ops = OPERATORS_BY_FIELD[cond.field] ?? OPERATORS_BY_FIELD._default!;
                const fixedValues = FIELD_VALUES[cond.field];
                const noValue = cond.operator === 'is_empty' || cond.operator === 'is_not_empty';
                return (
                  <div key={idx} className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 p-3">
                    <span className="text-xs text-muted-foreground font-medium w-5 shrink-0 text-right">
                      {idx === 0 ? 'If' : 'And'}
                    </span>
                    {/* Field */}
                    <select
                      value={cond.field}
                      onChange={(e) => updateCondition(idx, { field: e.target.value })}
                      className="h-8 rounded-md border border-border bg-background px-2 text-xs flex-1 min-w-0"
                    >
                      {CONDITION_FIELDS.map((f) => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                    {/* Operator */}
                    <select
                      value={cond.operator}
                      onChange={(e) => updateCondition(idx, { operator: e.target.value })}
                      className="h-8 rounded-md border border-border bg-background px-2 text-xs w-36 shrink-0"
                    >
                      {ops.map((op) => (
                        <option key={op.value} value={op.value}>{op.label}</option>
                      ))}
                    </select>
                    {/* Value */}
                    {!noValue && (
                      fixedValues ? (
                        <select
                          value={cond.value}
                          onChange={(e) => updateCondition(idx, { value: e.target.value })}
                          className="h-8 rounded-md border border-border bg-background px-2 text-xs w-28 shrink-0"
                        >
                          {fixedValues.map((v) => <option key={v} value={v}>{v}</option>)}
                        </select>
                      ) : (
                        <Input
                          value={cond.value}
                          onChange={(e) => updateCondition(idx, { value: e.target.value })}
                          placeholder="Value"
                          className="h-8 text-xs w-28 shrink-0"
                        />
                      )
                    )}
                    {conditions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeCondition(idx)}
                        className="text-muted-foreground hover:text-red-500 shrink-0"
                      >
                        <XCircleIcon className="size-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-foreground">Actions (applied in order)</label>
              <button type="button" onClick={addAction} className="text-xs text-blue-600 hover:underline font-medium">
                + Add action
              </button>
            </div>
            <div className="space-y-2">
              {actions.map((act, idx) => {
                const actionDef = ACTION_TYPES.find((t) => t.value === act.type);
                const needsValue = actionDef && 'hasValue' in actionDef && actionDef.hasValue;
                return (
                  <div key={idx} className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 p-3">
                    <span className="text-xs text-muted-foreground font-medium w-8 shrink-0 text-right">Then</span>
                    <select
                      value={act.type}
                      onChange={(e) => updateAction(idx, { type: e.target.value, value: '' })}
                      className="h-8 rounded-md border border-border bg-background px-2 text-xs flex-1 min-w-0"
                    >
                      {ACTION_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    {needsValue && (
                      <Input
                        value={act.value}
                        onChange={(e) => updateAction(idx, { value: e.target.value })}
                        placeholder={'placeholder' in actionDef ? actionDef.placeholder : 'Value'}
                        className="h-8 text-xs w-40 shrink-0"
                      />
                    )}
                    {actions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeAction(idx)}
                        className="text-muted-foreground hover:text-red-500 shrink-0"
                      >
                        <XCircleIcon className="size-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-background border-t border-border px-6 py-4 rounded-b-2xl flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !name.trim() || channels.length === 0} className="gap-1.5">
            {saving && <Loader2Icon className="size-3.5 animate-spin" />}
            {initial ? 'Save Changes' : 'Create Rule'}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Rules Tab ─────────────────────────────────────────────────────────────────

function RulesTab({ orgId }: { orgId: string }): React.JSX.Element {
  const [rules, setRules] = React.useState<FeedRule[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingRule, setEditingRule] = React.useState<FeedRule | undefined>(undefined);

  // Load rules from API
  React.useEffect(() => {
    void fetch(`/api/shopping-feeds/rules?orgId=${orgId}`)
      .then((r) => r.json())
      .then((data: { rules?: FeedRule[] }) => {
        if (data.rules) setRules(data.rules);
      })
      .finally(() => setLoading(false));
  }, [orgId]);

  async function toggleRule(rule: FeedRule): Promise<void> {
    const optimistic = rules.map((r) => r.id === rule.id ? { ...r, isActive: !r.isActive } : r);
    setRules(optimistic);
    try {
      await fetch(`/api/shopping-feeds/rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, isActive: !rule.isActive })
      });
    } catch {
      setRules(rules); // revert
      toast.error('Failed to update rule');
    }
  }

  async function deleteRule(rule: FeedRule): Promise<void> {
    setRules((prev) => prev.filter((r) => r.id !== rule.id));
    try {
      await fetch(`/api/shopping-feeds/rules/${rule.id}?orgId=${orgId}`, { method: 'DELETE' });
      toast.success('Rule deleted');
    } catch {
      setRules((prev) => [...prev, rule].sort((a, b) => a.priority - b.priority));
      toast.error('Failed to delete rule');
    }
  }

  async function handleSave(data: Omit<FeedRule, 'id' | 'priority'>): Promise<void> {
    if (editingRule) {
      // Update existing
      const res = await fetch(`/api/shopping-feeds/rules/${editingRule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, ...data })
      });
      if (!res.ok) throw new Error('update failed');
      const json = await res.json() as { rule: FeedRule };
      setRules((prev) => prev.map((r) => r.id === editingRule.id ? json.rule : r));
      toast.success('Rule updated');
    } else {
      // Create new
      const res = await fetch('/api/shopping-feeds/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, ...data })
      });
      if (!res.ok) throw new Error('create failed');
      const json = await res.json() as { rule: FeedRule };
      setRules((prev) => [...prev, json.rule]);
      toast.success('Rule created');
    }
  }

  function openEdit(rule: FeedRule): void {
    setEditingRule(rule);
    setDialogOpen(true);
  }

  function openAdd(): void {
    setEditingRule(undefined);
    setDialogOpen(true);
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">Rules transform, filter, and enrich your feed before submission. Applied in order.</p>
        <Button size="sm" onClick={openAdd} className="gap-1.5">
          <TagIcon className="size-3.5" />
          Add Rule
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : rules.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-12 text-center">
          <FilterIcon className="size-6 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">No rules yet</p>
          <p className="text-xs text-muted-foreground mb-4">Create rules to automatically filter and transform your product feed.</p>
          <Button size="sm" onClick={openAdd} className="gap-1.5">
            <TagIcon className="size-3.5" />
            Add your first rule
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {rules.map((rule, idx) => (
              <div
                key={rule.id}
                className={cn(
                  'rounded-xl border p-4 transition-colors',
                  rule.isActive ? 'border-border bg-card' : 'border-border bg-muted/30 opacity-60'
                )}
              >
                <div className="flex items-start gap-3">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground mt-0.5">
                    {idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground">{rule.name}</p>
                      {rule.channels.map((ch) => (
                        <span key={ch} className={cn('text-[11px] font-medium border rounded px-1.5 py-0.5', CHANNEL_COLORS[ch] ?? CHANNEL_COLORS.google)}>
                          {CHANNEL_LABEL[ch] ?? ch}
                        </span>
                      ))}
                    </div>
                    {/* Conditions summary */}
                    <div className="mt-1.5 space-y-0.5">
                      {rule.conditions.map((c, ci) => (
                        <p key={ci} className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground/70">{ci === 0 ? 'If' : 'And'}</span> {conditionSummary(c)}
                        </p>
                      ))}
                      {rule.actions.map((a, ai) => (
                        <p key={ai} className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground/70">Then</span> {actionSummary(a)}
                        </p>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(rule)}
                      className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteRule(rule)}
                      className="text-xs text-muted-foreground hover:text-red-500 px-2 py-1 rounded hover:bg-red-50"
                    >
                      Delete
                    </button>
                    <Toggle checked={rule.isActive} onChange={() => void toggleRule(rule)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-4 text-center">Rules are applied top to bottom in order.</p>
        </>
      )}

      <RuleBuilderDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
        initial={editingRule}
      />
    </div>
  );
}

// ── Promotions Tab ────────────────────────────────────────────────────────────

type PromoStatus = 'active' | 'scheduled' | 'expired' | 'pending';

type Promotion = {
  id: string;
  title: string;
  offerType: string;
  couponCode: string | null;
  discountType: string;
  discountValue: number | null;
  minimumPurchaseAmount: number | null;
  startDate: string;
  endDate: string;
  applicableProducts: string;
  channels: string[];
  status: PromoStatus;
};

type PromoFormState = {
  title: string;
  offerType: string;
  couponCode: string;
  discountType: string;
  discountValue: string;
  minimumPurchaseAmount: string;
  startDate: string;
  endDate: string;
  applicableProducts: string;
  channels: string[];
};

const OFFER_TYPES = [
  { id: 'percent_off', label: 'Percent Off', description: 'e.g. 20% off your order' },
  { id: 'amount_off', label: 'Amount Off', description: 'e.g. $10 off your order' },
  { id: 'free_shipping', label: 'Free Shipping', description: 'Free standard shipping' },
  { id: 'buy_x_get_y', label: 'Buy X Get Y', description: 'e.g. Buy 2 get 1 free' }
];

const PROMO_STATUS_CONFIG: Record<PromoStatus, { label: string; color: string }> = {
  active: { label: 'Active', color: 'bg-green-50 border-green-200 text-green-700' },
  scheduled: { label: 'Scheduled', color: 'bg-blue-50 border-blue-200 text-blue-700' },
  expired: { label: 'Expired', color: 'bg-gray-50 border-gray-200 text-gray-500' },
  pending: { label: 'Pending', color: 'bg-amber-50 border-amber-200 text-amber-700' }
};

function formatDiscountSummary(promo: Promotion): string {
  if (promo.offerType === 'free_shipping') return 'Free shipping';
  if (promo.offerType === 'percent_off' && promo.discountValue != null) return `${promo.discountValue}% off`;
  if (promo.offerType === 'amount_off' && promo.discountValue != null) return `$${promo.discountValue} off`;
  if (promo.offerType === 'buy_x_get_y') return 'Buy X Get Y';
  return promo.offerType;
}

const EMPTY_FORM: PromoFormState = {
  title: '',
  offerType: 'percent_off',
  couponCode: '',
  discountType: 'percent',
  discountValue: '',
  minimumPurchaseAmount: '',
  startDate: '',
  endDate: '',
  applicableProducts: 'all',
  channels: ['google']
};

function PromotionFormDialog({
  orgId,
  open,
  onClose,
  editPromo,
  onSaved
}: {
  orgId: string;
  open: boolean;
  onClose: () => void;
  editPromo: Promotion | null;
  onSaved: (promo: Promotion, isNew: boolean) => void;
}): React.JSX.Element | null {
  const [form, setForm] = React.useState<PromoFormState>(EMPTY_FORM);
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    if (editPromo) {
      setForm({
        title: editPromo.title,
        offerType: editPromo.offerType,
        couponCode: editPromo.couponCode ?? '',
        discountType: editPromo.discountType,
        discountValue: editPromo.discountValue != null ? String(editPromo.discountValue) : '',
        minimumPurchaseAmount: editPromo.minimumPurchaseAmount != null ? String(editPromo.minimumPurchaseAmount) : '',
        startDate: editPromo.startDate.slice(0, 10),
        endDate: editPromo.endDate.slice(0, 10),
        applicableProducts: editPromo.applicableProducts,
        channels: editPromo.channels
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [open, editPromo]);

  if (!open) return null;

  const needsValue = form.offerType === 'percent_off' || form.offerType === 'amount_off';

  function toggleChannel(ch: string): void {
    setForm((f) => ({
      ...f,
      channels: f.channels.includes(ch) ? f.channels.filter((c) => c !== ch) : [...f.channels, ch]
    }));
  }

  async function handleSave(): Promise<void> {
    if (!form.title.trim() || !form.startDate || !form.endDate || form.channels.length === 0) {
      toast.error('Title, dates, and at least one channel are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        orgId,
        title: form.title.trim(),
        offerType: form.offerType,
        couponCode: form.couponCode.trim() || undefined,
        discountType: form.discountType,
        discountValue: form.discountValue ? parseFloat(form.discountValue) : undefined,
        minimumPurchaseAmount: form.minimumPurchaseAmount ? parseFloat(form.minimumPurchaseAmount) : undefined,
        startDate: form.startDate,
        endDate: form.endDate,
        applicableProducts: form.applicableProducts,
        channels: form.channels
      };

      const url = editPromo
        ? `/api/shopping-feeds/promotions/${editPromo.id}`
        : '/api/shopping-feeds/promotions';
      const method = editPromo ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Failed to save');
      const data = await res.json() as { promotion: Promotion };
      toast.success(editPromo ? 'Promotion updated' : 'Promotion created');
      onSaved(data.promotion, !editPromo);
      onClose();
    } catch {
      toast.error('Failed to save promotion');
    } finally {
      setSaving(false);
    }
  }

  const CHANNELS = [
    { id: 'google', label: 'Google', icon: <GoogleIconSm /> },
    { id: 'meta', label: 'Meta', icon: <MetaIconSm /> },
    { id: 'microsoft', label: 'Microsoft', icon: <MicrosoftIconSm /> }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-background rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">
            {editPromo ? 'Edit Promotion' : 'Create Promotion'}
          </h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <XCircleIcon className="size-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">Promotion title</label>
            <Input
              placeholder="e.g. Spring Sale – 20% Off All Orders"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>

          {/* Offer Type */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Offer type</label>
            <div className="grid grid-cols-2 gap-2">
              {OFFER_TYPES.map((ot) => (
                <button
                  key={ot.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, offerType: ot.id }))}
                  className={cn(
                    'rounded-lg border p-3 text-left transition-colors',
                    form.offerType === ot.id
                      ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                      : 'border-border bg-card hover:border-gray-300'
                  )}
                >
                  <p className="text-sm font-medium text-foreground">{ot.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{ot.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Discount value */}
          {needsValue && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Discount value</label>
                <div className="flex">
                  <Input
                    type="number"
                    min="0"
                    placeholder={form.offerType === 'percent_off' ? '20' : '10'}
                    value={form.discountValue}
                    onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
                    className="rounded-r-none"
                  />
                  <span className="flex items-center px-3 rounded-r-lg border border-l-0 border-border bg-muted text-sm text-muted-foreground">
                    {form.offerType === 'percent_off' ? '%' : '$'}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Min. purchase (optional)</label>
                <div className="flex">
                  <span className="flex items-center px-3 rounded-l-lg border border-r-0 border-border bg-muted text-sm text-muted-foreground">$</span>
                  <Input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={form.minimumPurchaseAmount}
                    onChange={(e) => setForm((f) => ({ ...f, minimumPurchaseAmount: e.target.value }))}
                    className="rounded-l-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Coupon code */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Coupon code <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <Input
              placeholder="e.g. SPRING20"
              value={form.couponCode}
              onChange={(e) => setForm((f) => ({ ...f, couponCode: e.target.value.toUpperCase() }))}
              className="font-mono"
            />
          </div>

          {/* Date range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Start date</label>
              <Input
                type="date"
                value={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">End date</label>
              <Input
                type="date"
                value={form.endDate}
                min={form.startDate}
                onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
              />
            </div>
          </div>

          {/* Applicable products */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Applicable products</label>
            <div className="flex gap-2">
              {[
                { id: 'all', label: 'All products' },
                { id: 'specific', label: 'Specific products' }
              ].map((ap) => (
                <button
                  key={ap.id}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, applicableProducts: ap.id }))}
                  className={cn(
                    'flex-1 rounded-lg border py-2 text-sm font-medium transition-colors',
                    form.applicableProducts === ap.id
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-border text-muted-foreground hover:border-gray-300 hover:text-foreground'
                  )}
                >
                  {ap.label}
                </button>
              ))}
            </div>
          </div>

          {/* Channels */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Channels</label>
            <div className="flex gap-2">
              {CHANNELS.map((ch) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => toggleChannel(ch.id)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-lg border py-2 text-sm font-medium transition-colors',
                    form.channels.includes(ch.id)
                      ? cn('border-2', CHANNEL_COLORS[ch.id])
                      : 'border-border text-muted-foreground hover:border-gray-300'
                  )}
                >
                  {ch.icon}
                  {ch.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving && <Loader2Icon className="size-3.5 animate-spin" />}
            {editPromo ? 'Save Changes' : 'Create Promotion'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PromotionsTab({ orgId }: { orgId: string }): React.JSX.Element {
  const [promotions, setPromotions] = React.useState<Promotion[]>([]);
  const [loadingPromos, setLoadingPromos] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editPromo, setEditPromo] = React.useState<Promotion | null>(null);

  React.useEffect(() => {
    void fetch(`/api/shopping-feeds/promotions?orgId=${orgId}`)
      .then((r) => r.json())
      .then((data) => {
        const d = data as { promotions: Promotion[] };
        setPromotions(d.promotions ?? []);
      })
      .finally(() => setLoadingPromos(false));
  }, [orgId]);

  function openCreate(): void {
    setEditPromo(null);
    setDialogOpen(true);
  }

  function openEdit(promo: Promotion): void {
    setEditPromo(promo);
    setDialogOpen(true);
  }

  function handleSaved(promo: Promotion, isNew: boolean): void {
    if (isNew) {
      setPromotions((prev) => [promo, ...prev]);
    } else {
      setPromotions((prev) => prev.map((p) => p.id === promo.id ? promo : p));
    }
  }

  async function handleDelete(id: string): Promise<void> {
    const prev = promotions;
    setPromotions((p) => p.filter((x) => x.id !== id));
    try {
      const res = await fetch(`/api/shopping-feeds/promotions/${id}?orgId=${orgId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      toast.success('Promotion deleted');
    } catch {
      setPromotions(prev);
      toast.error('Failed to delete promotion');
    }
  }

  const statusConfig = PROMO_STATUS_CONFIG;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          Promotions are submitted to ad channels and appear as special offers in your product listings.
        </p>
        <Button size="sm" className="gap-1.5" onClick={openCreate}>
          <TagIcon className="size-3.5" />
          Add Promotion
        </Button>
      </div>

      {loadingPromos ? (
        <div className="flex items-center justify-center py-12">
          <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : promotions.length > 0 ? (
        <div className="space-y-3">
          {promotions.map((promo) => {
            const sc = statusConfig[promo.status] ?? statusConfig.pending;
            return (
              <div key={promo.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground">{promo.title}</p>
                      <span className={cn('text-[11px] font-medium border rounded-full px-2 py-0.5', sc.color)}>
                        {sc.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-2 flex-wrap text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{formatDiscountSummary(promo)}</span>
                      {promo.couponCode && (
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{promo.couponCode}</span>
                      )}
                      {promo.minimumPurchaseAmount != null && promo.minimumPurchaseAmount > 0 && (
                        <span>Min ${promo.minimumPurchaseAmount}</span>
                      )}
                      <span>
                        {new Date(promo.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {' → '}
                        {new Date(promo.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      <div className="flex items-center gap-1">
                        {promo.channels.map((ch) => (
                          <span key={ch} className={cn('text-[11px] font-medium border rounded px-1.5 py-0.5', CHANNEL_COLORS[ch] ?? '')}>
                            {ch === 'google' ? 'Google' : ch === 'meta' ? 'Meta' : 'Microsoft'}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(promo)}
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      Edit
                    </button>
                    <span className="text-muted-foreground">·</span>
                    <button
                      type="button"
                      onClick={() => { void handleDelete(promo.id); }}
                      className="text-xs text-red-500 hover:underline font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <TagIcon className="size-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground mb-1">No promotions yet</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-4">
            Promotions appear alongside your Shopping ads and highlight discounts to increase click-through rates.
          </p>
          <Button size="sm" className="gap-1.5" onClick={openCreate}>
            <TagIcon className="size-3.5" />
            Create First Promotion
          </Button>
        </div>
      )}

      <PromotionFormDialog
        orgId={orgId}
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        editPromo={editPromo}
        onSaved={handleSaved}
      />
    </div>
  );
}

// ── Audience Sync Tab ─────────────────────────────────────────────────────────

type AudienceType = 'retarget' | 'exclusion' | 'lookalike_seed';
type AudienceSyncStatus = 'active' | 'pending' | 'error';

type AudienceRule = {
  field: string;
  operator: string;
  value: string;
  logic: 'AND' | 'OR';
};

type AudienceList = {
  id: string;
  name: string;
  description?: string;
  type: AudienceType;
  platforms: string[];
  rules: AudienceRule[];
  estimatedSize?: number;
  syncStatus: AudienceSyncStatus;
  historicalImportDone: boolean;
  lastSyncAt?: string;
  createdAt: string;
};

const AUDIENCE_RULE_FIELDS = [
  { value: 'customer_tag', label: 'Customer tag' },
  { value: 'email_subscribed', label: 'Email subscribed' },
  { value: 'purchase_count', label: 'Purchase count' },
  { value: 'purchase_value', label: 'Purchase value (total)' },
  { value: 'last_purchase_date', label: 'Last purchase date' },
  { value: 'product_title', label: 'Purchased product title' }
] as const;

const AUDIENCE_OPERATORS: Record<string, { value: string; label: string }[]> = {
  customer_tag: [
    { value: 'equals', label: 'equals' },
    { value: 'contains', label: 'contains' }
  ],
  email_subscribed: [
    { value: 'equals', label: 'equals' }
  ],
  purchase_count: [
    { value: 'greater_than', label: 'is greater than' },
    { value: 'less_than', label: 'is less than' },
    { value: 'equals', label: 'equals' }
  ],
  purchase_value: [
    { value: 'greater_than', label: 'is greater than' },
    { value: 'less_than', label: 'is less than' }
  ],
  last_purchase_date: [
    { value: 'in_last_n_days', label: 'in the last N days' },
    { value: 'not_in_last_n_days', label: 'NOT in the last N days' }
  ],
  product_title: [
    { value: 'contains', label: 'contains' },
    { value: 'equals', label: 'equals' }
  ]
};

const AUDIENCE_FIELD_VALUES: Record<string, string[]> = {
  email_subscribed: ['true', 'false']
};

const TYPE_CONFIG: Record<AudienceType, { label: string; color: string; bg: string; desc: string }> = {
  retarget: { label: 'Retarget', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', desc: 'Show ads to past visitors and customers' },
  exclusion: { label: 'Exclusion', color: 'text-red-700', bg: 'bg-red-50 border-red-200', desc: 'Suppress audiences from acquisition campaigns' },
  lookalike_seed: { label: 'Lookalike Seed', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', desc: 'Seed list for lookalike/similar audiences' }
};

const STATUS_CONFIG: Record<AudienceSyncStatus, { label: string; color: string }> = {
  active: { label: 'Active', color: 'text-green-700 bg-green-50 border-green-200' },
  pending: { label: 'Pending', color: 'text-amber-700 bg-amber-50 border-amber-200' },
  error: { label: 'Error', color: 'text-red-700 bg-red-50 border-red-200' }
};

function audienceRuleSummary(rule: AudienceRule): string {
  const field = AUDIENCE_RULE_FIELDS.find((f) => f.value === rule.field)?.label ?? rule.field;
  const op = rule.operator.replace(/_/g, ' ');
  if (rule.field === 'email_subscribed') return `${field} is ${rule.value}`;
  return `${field} ${op} "${rule.value}"`;
}

// ── Audience Builder Dialog ────────────────────────────────────────────────────

function AudienceBuilderDialog({
  open,
  onClose,
  onSave,
  initial,
  totalContacts
}: {
  open: boolean;
  onClose: () => void;
  onSave: (data: Omit<AudienceList, 'id' | 'syncStatus' | 'historicalImportDone' | 'lastSyncAt' | 'createdAt'>) => Promise<void>;
  initial?: AudienceList;
  totalContacts: number;
}): React.JSX.Element | null {
  const [name, setName] = React.useState(initial?.name ?? '');
  const [description, setDescription] = React.useState(initial?.description ?? '');
  const [type, setType] = React.useState<AudienceType>(initial?.type ?? 'retarget');
  const [platforms, setPlatforms] = React.useState<string[]>(initial?.platforms ?? ['google', 'meta', 'microsoft']);
  const [rules, setRules] = React.useState<AudienceRule[]>(
    initial?.rules?.length ? initial.rules : [{ field: 'customer_tag', operator: 'equals', value: 'newsletter', logic: 'AND' }]
  );
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setName(initial?.name ?? '');
      setDescription(initial?.description ?? '');
      setType(initial?.type ?? 'retarget');
      setPlatforms(initial?.platforms ?? ['google', 'meta', 'microsoft']);
      setRules(initial?.rules?.length ? initial.rules : [{ field: 'customer_tag', operator: 'equals', value: 'newsletter', logic: 'AND' }]);
    }
  }, [open, initial]);

  function togglePlatform(p: string): void {
    setPlatforms((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  }

  function updateRule(idx: number, patch: Partial<AudienceRule>): void {
    setRules((prev) => prev.map((r, i) => {
      if (i !== idx) return r;
      const updated = { ...r, ...patch };
      if (patch.field && patch.field !== r.field) {
        const ops = AUDIENCE_OPERATORS[patch.field] ?? [];
        updated.operator = ops[0]?.value ?? 'equals';
        updated.value = '';
      }
      return updated;
    }));
  }

  async function handleSave(): Promise<void> {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave({ name: name.trim(), description: description.trim() || undefined, type, platforms, rules, estimatedSize: undefined });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-background rounded-2xl border border-border shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4">
        <div className="sticky top-0 bg-background border-b border-border px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <h2 className="text-base font-semibold">{initial ? 'Edit Audience' : 'New Audience List'}</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <XCircleIcon className="size-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Name + description */}
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">List Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. High-value customers" className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs font-medium text-foreground mb-1.5 block">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this audience used for?" className="h-9 text-sm" />
            </div>
          </div>

          {/* Type */}
          <div>
            <label className="text-xs font-medium text-foreground mb-2 block">Audience Type</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(TYPE_CONFIG) as [AudienceType, typeof TYPE_CONFIG[AudienceType]][]).map(([t, cfg]) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cn(
                    'text-left p-3 rounded-lg border transition-all',
                    type === t ? `border-2 ${cfg.bg} ${cfg.color}` : 'border-border hover:border-gray-300'
                  )}
                >
                  <p className="text-xs font-semibold">{cfg.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{cfg.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Platforms */}
          <div>
            <label className="text-xs font-medium text-foreground mb-2 block">Sync to Platforms</label>
            <div className="flex gap-2">
              {[
                { key: 'google', label: 'Google Ads', icon: <GoogleIconSm /> },
                { key: 'meta', label: 'Meta Ads', icon: <MetaIconSm /> },
                { key: 'microsoft', label: 'Microsoft Ads', icon: <MicrosoftIconSm /> }
              ].map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => togglePlatform(p.key)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all',
                    platforms.includes(p.key) ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-border text-muted-foreground hover:border-gray-300'
                  )}
                >
                  {p.icon} {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Rules */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-foreground">Audience Rules</label>
              <button
                type="button"
                onClick={() => setRules((prev) => [...prev, { field: 'customer_tag', operator: 'equals', value: '', logic: 'AND' }])}
                className="text-xs text-blue-600 hover:underline font-medium"
              >
                + Add rule
              </button>
            </div>
            <div className="space-y-2">
              {rules.map((rule, idx) => {
                const ops = AUDIENCE_OPERATORS[rule.field] ?? [];
                const fixedValues = AUDIENCE_FIELD_VALUES[rule.field];
                return (
                  <div key={idx} className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 p-3">
                    {idx > 0 && (
                      <select
                        value={rule.logic}
                        onChange={(e) => updateRule(idx, { logic: e.target.value as 'AND' | 'OR' })}
                        className="h-8 rounded-md border border-border bg-background px-2 text-xs w-16 shrink-0"
                      >
                        <option value="AND">AND</option>
                        <option value="OR">OR</option>
                      </select>
                    )}
                    {idx === 0 && <span className="text-xs text-muted-foreground font-medium w-5 shrink-0">If</span>}
                    <select
                      value={rule.field}
                      onChange={(e) => updateRule(idx, { field: e.target.value })}
                      className="h-8 rounded-md border border-border bg-background px-2 text-xs flex-1 min-w-0"
                    >
                      {AUDIENCE_RULE_FIELDS.map((f) => (
                        <option key={f.value} value={f.value}>{f.label}</option>
                      ))}
                    </select>
                    <select
                      value={rule.operator}
                      onChange={(e) => updateRule(idx, { operator: e.target.value })}
                      className="h-8 rounded-md border border-border bg-background px-2 text-xs w-36 shrink-0"
                    >
                      {ops.map((op) => (
                        <option key={op.value} value={op.value}>{op.label}</option>
                      ))}
                    </select>
                    {fixedValues ? (
                      <select
                        value={rule.value}
                        onChange={(e) => updateRule(idx, { value: e.target.value })}
                        className="h-8 rounded-md border border-border bg-background px-2 text-xs w-24 shrink-0"
                      >
                        {fixedValues.map((v) => <option key={v} value={v}>{v}</option>)}
                      </select>
                    ) : (
                      <Input
                        value={rule.value}
                        onChange={(e) => updateRule(idx, { value: e.target.value })}
                        placeholder={rule.field === 'last_purchase_date' ? 'Days' : 'Value'}
                        className="h-8 text-xs w-24 shrink-0"
                      />
                    )}
                    {rules.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setRules((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-muted-foreground hover:text-red-500 shrink-0"
                      >
                        <XCircleIcon className="size-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Data note */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-start gap-2">
            <CheckCircle2Icon className="size-4 text-green-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-foreground">PII is SHA-256 hashed before upload</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Email, phone, and name are hashed client-side. No raw personal data is sent to ad platforms. GDPR + CCPA compliant.</p>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-background border-t border-border px-6 py-4 rounded-b-2xl flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Based on {totalContacts} customer records
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving || !name.trim() || platforms.length === 0} className="gap-1.5">
              {saving && <Loader2Icon className="size-3.5 animate-spin" />}
              {initial ? 'Save Changes' : 'Create List'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Audience Sync Tab ─────────────────────────────────────────────────────────

function AudienceSyncTab({ orgId }: { orgId: string }): React.JSX.Element {
  const [audiences, setAudiences] = React.useState<AudienceList[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [stats, setStats] = React.useState({ totalContacts: 0, totalOrders: 0 });
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingAudience, setEditingAudience] = React.useState<AudienceList | undefined>(undefined);

  React.useEffect(() => {
    void fetch(`/api/shopping-feeds/audiences?orgId=${orgId}`)
      .then((r) => r.json())
      .then((data: { audiences?: AudienceList[]; stats?: { totalContacts: number; totalOrders: number } }) => {
        if (data.audiences) setAudiences(data.audiences);
        if (data.stats) setStats(data.stats);
      })
      .finally(() => setLoading(false));
  }, [orgId]);

  async function handleSave(data: Omit<AudienceList, 'id' | 'syncStatus' | 'historicalImportDone' | 'lastSyncAt' | 'createdAt'>): Promise<void> {
    if (editingAudience) {
      const res = await fetch(`/api/shopping-feeds/audiences/${editingAudience.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, ...data })
      });
      if (!res.ok) throw new Error('update failed');
      const json = await res.json() as { audience: AudienceList };
      setAudiences((prev) => prev.map((a) => a.id === editingAudience.id ? json.audience : a));
      toast.success('Audience updated');
    } else {
      const res = await fetch('/api/shopping-feeds/audiences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, ...data })
      });
      if (!res.ok) throw new Error('create failed');
      const json = await res.json() as { audience: AudienceList };
      setAudiences((prev) => [json.audience, ...prev]);
      toast.success('Audience list created');
    }
  }

  async function deleteAudience(audience: AudienceList): Promise<void> {
    setAudiences((prev) => prev.filter((a) => a.id !== audience.id));
    try {
      await fetch(`/api/shopping-feeds/audiences/${audience.id}?orgId=${orgId}`, { method: 'DELETE' });
      toast.success('Audience deleted');
    } catch {
      setAudiences((prev) => [audience, ...prev]);
      toast.error('Failed to delete audience');
    }
  }

  function openEdit(audience: AudienceList): void {
    setEditingAudience(audience);
    setDialogOpen(true);
  }

  function openAdd(): void {
    setEditingAudience(undefined);
    setDialogOpen(true);
  }

  const totalReach = audiences.reduce((sum, a) => sum + (a.estimatedSize ?? 0), 0);
  const activeCount = audiences.filter((a) => a.syncStatus === 'active').length;

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-1">Audience Sync</h2>
          <p className="text-xs text-muted-foreground max-w-lg">
            Sync first-party customer data to Google, Meta, and Microsoft for retargeting, exclusion, and lookalike audiences. All PII is SHA-256 hashed before upload.
          </p>
        </div>
        <Button size="sm" onClick={openAdd} className="gap-1.5 shrink-0">
          <UsersIcon className="size-3.5" />
          New Audience
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Customer Records', value: stats.totalContacts.toLocaleString(), sub: `${stats.totalOrders} orders`, icon: <UsersIcon className="size-4" />, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Active Lists', value: activeCount.toString(), sub: `${audiences.length} total`, icon: <CheckCircle2Icon className="size-4" />, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Total Estimated Reach', value: totalReach.toLocaleString(), sub: 'across all lists', icon: <RefreshCwIcon className="size-4" />, color: 'text-purple-600', bg: 'bg-purple-50' }
        ].map((s) => (
          <div key={s.label} className={cn('rounded-xl border p-3', s.bg)}>
            <div className={cn('flex items-center gap-1.5 mb-1', s.color)}>
              {s.icon}
              <span className="text-xs font-medium">{s.label}</span>
            </div>
            <p className={cn('text-2xl font-bold', s.color)}>{s.value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Audience list */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : audiences.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-14 text-center">
          <UsersIcon className="size-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-semibold text-foreground mb-1">No audience lists yet</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mb-5">
            Create rule-based audience lists from your customer data and sync them to Google, Meta, and Microsoft in one click.
          </p>
          <Button size="sm" onClick={openAdd} className="gap-1.5">
            <UsersIcon className="size-3.5" />
            Create your first audience
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {audiences.map((audience) => {
            const typeCfg = TYPE_CONFIG[audience.type] ?? TYPE_CONFIG.retarget;
            const statusCfg = STATUS_CONFIG[audience.syncStatus] ?? STATUS_CONFIG.pending;
            return (
              <div key={audience.id} className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Title row */}
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <p className="text-sm font-semibold text-foreground">{audience.name}</p>
                      <span className={cn('text-[11px] font-medium border rounded-full px-2 py-0.5', typeCfg.bg, typeCfg.color)}>
                        {typeCfg.label}
                      </span>
                      <span className={cn('text-[11px] font-medium border rounded-full px-2 py-0.5', statusCfg.color)}>
                        {statusCfg.label}
                      </span>
                    </div>
                    {audience.description && (
                      <p className="text-xs text-muted-foreground mb-2">{audience.description}</p>
                    )}
                    {/* Rules summary */}
                    <div className="space-y-0.5 mb-3">
                      {audience.rules.map((rule, ri) => (
                        <p key={ri} className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground/70">{ri === 0 ? 'If' : rule.logic}</span>{' '}
                          {audienceRuleSummary(rule)}
                        </p>
                      ))}
                    </div>
                    {/* Footer row */}
                    <div className="flex items-center gap-4 flex-wrap">
                      {/* Platforms */}
                      <div className="flex items-center gap-1">
                        {audience.platforms.includes('google') && <GoogleIconSm />}
                        {audience.platforms.includes('meta') && <MetaIconSm />}
                        {audience.platforms.includes('microsoft') && <MicrosoftIconSm />}
                      </div>
                      {/* Estimated size */}
                      {audience.estimatedSize !== undefined && (
                        <span className="text-xs text-muted-foreground">
                          ~<span className="font-semibold text-foreground">{audience.estimatedSize.toLocaleString()}</span> customers
                        </span>
                      )}
                      {/* Last sync */}
                      {audience.lastSyncAt ? (
                        <span className="text-xs text-muted-foreground">Last synced {formatRelativeTime(audience.lastSyncAt)}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Not synced yet</span>
                      )}
                      {/* Historical import badge */}
                      {audience.historicalImportDone && (
                        <span className="text-[11px] text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 font-medium">
                          Historical import done
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(audience)}
                      className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteAudience(audience)}
                      className="text-xs text-muted-foreground hover:text-red-500 px-2 py-1 rounded hover:bg-red-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Privacy footer */}
      <div className="mt-6 rounded-xl border border-dashed border-border p-4 flex items-start gap-3">
        <CheckCircle2Icon className="size-4 text-green-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-semibold text-foreground">GDPR & CCPA Compliant</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            All customer PII (email, phone, name) is SHA-256 hashed before being sent to any ad platform. Raw personal data never leaves your environment. Automated daily sync keeps lists up to date.
          </p>
        </div>
      </div>

      <AudienceBuilderDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
        initial={editingAudience}
        totalContacts={stats.totalContacts}
      />
    </div>
  );
}

// ── Zombie SKU Tab ────────────────────────────────────────────────────────────

type ZombieSkuConfig = {
  enabled: boolean;
  minDaysSinceLastImpression: number;
  maxImpressions: number;
  maxClicks: number;
  customLabel: 'custom_label_0' | 'custom_label_1' | 'custom_label_2' | 'custom_label_3' | 'custom_label_4';
  labelValue: string;
};

const DEFAULT_ZOMBIE_CONFIG: ZombieSkuConfig = {
  enabled: true,
  minDaysSinceLastImpression: 30,
  maxImpressions: 100,
  maxClicks: 10,
  customLabel: 'custom_label_0',
  labelValue: 'zombie_sku'
};

const CUSTOM_LABEL_OPTIONS = [
  'custom_label_0', 'custom_label_1', 'custom_label_2', 'custom_label_3', 'custom_label_4'
] as const;

function CreateCampaignModal({
  open,
  onClose,
  orgId,
  orgSlug,
  zombieCount,
  labelValue,
  currency = 'USD'
}: {
  open: boolean;
  onClose: () => void;
  orgId: string;
  orgSlug: string;
  zombieCount: number;
  labelValue: string;
  currency?: string;
}): React.JSX.Element | null {
  const [campaignName, setCampaignName] = React.useState('');
  const [dailyBudget, setDailyBudget] = React.useState('15');
  const [creating, setCreating] = React.useState(false);
  const [created, setCreated] = React.useState(false);
  const [campaignId, setCampaignId] = React.useState('');

  React.useEffect(() => {
    if (open) {
      setCampaignName(`Zombie SKU Recovery — ${new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`);
      setCreated(false);
      setCampaignId('');
    }
  }, [open]);

  if (!open) return null;

  async function handleCreate(): Promise<void> {
    if (!campaignName.trim() || !dailyBudget) return;
    setCreating(true);
    try {
      const res = await fetch('/api/shopping-feeds/zombie-sku/create-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          campaignName: campaignName.trim(),
          dailyBudget: parseFloat(dailyBudget),
          labelValue,
          productCount: zombieCount
        })
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json() as { campaign: { id: string } };
      setCampaignId(data.campaign.id);
      setCreated(true);
      toast.success('Campaign created as draft');
    } catch {
      toast.error('Failed to create campaign');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-background rounded-2xl shadow-2xl w-full max-w-md mx-4">
        {created ? (
          <div className="p-8 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-green-100 mx-auto mb-4">
              <CheckCircle2Icon className="size-7 text-green-600" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-2">Campaign created!</h3>
            <p className="text-sm text-muted-foreground mb-6">
              <span className="font-medium text-foreground">{campaignName}</span> has been saved as a draft. Open it in Campaigns to set targeting, add creatives, and launch.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={onClose}>Close</Button>
              <Button
                className="flex-1 gap-1.5"
                onClick={() => { window.location.href = `/organizations/${orgSlug}/campaigns/${campaignId}`; }}
              >
                <ExternalLinkIcon className="size-3.5" />
                Open Campaign
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">Create Zombie SKU Campaign</h2>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
                <XCircleIcon className="size-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <GhostIcon className="size-4 text-amber-600 shrink-0" />
                <p className="text-xs text-amber-800">
                  This campaign will target <span className="font-semibold">{zombieCount} product{zombieCount !== 1 ? 's' : ''}</span> labeled <code className="font-mono bg-amber-100 px-1 rounded">{labelValue}</code> with a Standard Shopping strategy.
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Campaign name</label>
                <Input
                  value={campaignName}
                  onChange={(e) => setCampaignName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Daily budget ({currency})</label>
                <div className="flex">
                  <span className="flex items-center px-3 rounded-l-lg border border-r-0 border-border bg-muted text-sm text-muted-foreground">{currency}</span>
                  <Input
                    type="number"
                    min="1"
                    value={dailyBudget}
                    onChange={(e) => setDailyBudget(e.target.value)}
                    className="rounded-l-none"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Recommended: $10–$30/day to resurface zombie products</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
                <p><span className="font-medium text-foreground">Channel:</span> Google Shopping</p>
                <p><span className="font-medium text-foreground">Type:</span> Standard Shopping</p>
                <p><span className="font-medium text-foreground">Targeting:</span> custom_label = {labelValue}</p>
                <p><span className="font-medium text-foreground">Status:</span> Draft (activate after review)</p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
              <Button variant="outline" onClick={onClose} disabled={creating}>Cancel</Button>
              <Button onClick={handleCreate} disabled={creating || !campaignName.trim()} className="gap-1.5">
                {creating && <Loader2Icon className="size-3.5 animate-spin" />}
                Create Campaign
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ZombieSkuTab({ orgId, orgSlug, products, currency = 'USD' }: { orgId: string; orgSlug: string; products: MockProduct[]; currency?: string }): React.JSX.Element {
  const [config, setConfig] = React.useState<ZombieSkuConfig>(DEFAULT_ZOMBIE_CONFIG);
  const [loadingConfig, setLoadingConfig] = React.useState(true);
  const [savingConfig, setSavingConfig] = React.useState(false);
  const [labeling, setLabeling] = React.useState(false);
  const [labeledIds, setLabeledIds] = React.useState<Set<string>>(new Set());
  const [campaignModalOpen, setCampaignModalOpen] = React.useState(false);

  React.useEffect(() => {
    void fetch(`/api/shopping-feeds/zombie-sku?orgId=${orgId}`)
      .then((r) => r.json())
      .then((data) => { const d = data as { config: ZombieSkuConfig }; setConfig(d.config); })
      .finally(() => setLoadingConfig(false));
  }, [orgId]);

  // Detect zombies from mock products based on config criteria
  const zombies = React.useMemo(() => {
    if (!config.enabled) return [];
    return products.filter((p) =>
      p.lastImpressionDaysAgo >= config.minDaysSinceLastImpression &&
      p.impressions <= config.maxImpressions &&
      p.clicks <= config.maxClicks
    );
  }, [products, config]);

  async function handleSaveConfig(): Promise<void> {
    setSavingConfig(true);
    try {
      await fetch('/api/shopping-feeds/zombie-sku', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId, config })
      });
      toast.success('Zombie SKU config saved');
    } catch {
      toast.error('Failed to save config');
    } finally {
      setSavingConfig(false);
    }
  }

  async function handleLabelAll(): Promise<void> {
    if (zombies.length === 0) return;
    setLabeling(true);
    try {
      const productIds = zombies.map((p) => p.externalProductId);
      const res = await fetch('/api/shopping-feeds/zombie-sku/label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orgId,
          productIds,
          customLabel: config.customLabel,
          labelValue: config.labelValue
        })
      });
      if (!res.ok) throw new Error('Failed');
      setLabeledIds(new Set(productIds));
      toast.success(`${zombies.length} product${zombies.length !== 1 ? 's' : ''} labeled "${config.labelValue}"`);
    } catch {
      toast.error('Failed to label products');
    } finally {
      setLabeling(false);
    }
  }

  const allLabeled = zombies.length > 0 && zombies.every((p) => labeledIds.has(p.externalProductId));

  if (loadingConfig) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2Icon className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <GhostIcon className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Zombie SKU Campaigns</h3>
        </div>
        <p className="text-sm text-muted-foreground">
          Detect low-visibility products, label them with a custom label, and create a targeted Shopping campaign to resurface them.
        </p>
      </div>

      {/* Config card */}
      <div className="rounded-xl border border-border bg-card p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-foreground">Detection Criteria</p>
          {/* Enable toggle */}
          <button
            type="button"
            onClick={() => setConfig((c) => ({ ...c, enabled: !c.enabled }))}
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors',
              config.enabled ? 'bg-blue-600' : 'bg-gray-200'
            )}
          >
            <span className={cn(
              'pointer-events-none inline-block size-4 rounded-full bg-white shadow-sm transition-transform',
              config.enabled ? 'translate-x-4' : 'translate-x-0.5'
            )} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-5">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Min. days since impression</label>
            <Input
              type="number"
              min="1"
              value={config.minDaysSinceLastImpression}
              onChange={(e) => setConfig((c) => ({ ...c, minDaysSinceLastImpression: parseInt(e.target.value) || 30 }))}
              disabled={!config.enabled}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Max impressions (30d)</label>
            <Input
              type="number"
              min="0"
              value={config.maxImpressions}
              onChange={(e) => setConfig((c) => ({ ...c, maxImpressions: parseInt(e.target.value) || 100 }))}
              disabled={!config.enabled}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Max clicks (30d)</label>
            <Input
              type="number"
              min="0"
              value={config.maxClicks}
              onChange={(e) => setConfig((c) => ({ ...c, maxClicks: parseInt(e.target.value) || 10 }))}
              disabled={!config.enabled}
            />
          </div>
        </div>

        <div className="border-t border-border pt-4 mb-4">
          <p className="text-xs font-medium text-muted-foreground mb-3">Label Configuration</p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Custom label slot</label>
              <div className="flex flex-wrap gap-1.5">
                {CUSTOM_LABEL_OPTIONS.map((lbl) => (
                  <button
                    key={lbl}
                    type="button"
                    onClick={() => setConfig((c) => ({ ...c, customLabel: lbl }))}
                    disabled={!config.enabled}
                    className={cn(
                      'rounded-md border px-2 py-1 text-xs font-mono font-medium transition-colors',
                      config.customLabel === lbl
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-border text-muted-foreground hover:border-gray-300'
                    )}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Label value</label>
              <Input
                placeholder="e.g. zombie_sku"
                value={config.labelValue}
                onChange={(e) => setConfig((c) => ({ ...c, labelValue: e.target.value }))}
                disabled={!config.enabled}
                className="font-mono text-sm"
              />
            </div>
          </div>
        </div>

        <Button size="sm" onClick={handleSaveConfig} disabled={savingConfig} className="gap-1.5">
          {savingConfig ? <Loader2Icon className="size-3.5 animate-spin" /> : <SaveIcon className="size-3.5" />}
          Save Config
        </Button>
      </div>

      {/* Detection results */}
      {config.enabled && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingDownIcon className="size-4 text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">Detected Zombie SKUs</p>
              <span className={cn(
                'rounded-full px-2 py-0.5 text-[11px] font-semibold',
                zombies.length > 0 ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground'
              )}>
                {zombies.length}
              </span>
            </div>
            {zombies.length > 0 && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleLabelAll}
                  disabled={labeling || allLabeled}
                  className="gap-1.5"
                >
                  {labeling ? <Loader2Icon className="size-3.5 animate-spin" /> : <TagIcon className="size-3.5" />}
                  {allLabeled ? 'All Labeled' : `Label All (${zombies.length})`}
                </Button>
                <Button
                  size="sm"
                  onClick={() => setCampaignModalOpen(true)}
                  disabled={!allLabeled}
                  className="gap-1.5"
                >
                  <ZapIcon className="size-3.5" />
                  Create Campaign
                </Button>
              </div>
            )}
          </div>

          {zombies.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-10 text-center">
              <CheckCircle2Icon className="size-8 text-green-500 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">No zombie SKUs detected</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                All products meet your current criteria thresholds. Adjust the criteria above to broaden detection.
              </p>
            </div>
          ) : (
            <>
              {allLabeled && (
                <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 mb-3">
                  <CheckCircle2Icon className="size-4 text-blue-600 shrink-0" />
                  <p className="text-xs text-blue-800">
                    All {zombies.length} products labeled <code className="font-mono bg-blue-100 px-1 rounded">{config.labelValue}</code> — ready to create a campaign.
                  </p>
                </div>
              )}
              <div className="space-y-2">
                {zombies.map((p) => {
                  const isLabeled = labeledIds.has(p.externalProductId);
                  return (
                    <div key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                      <img
                        src={p.imageUrl}
                        alt={p.title}
                        className="size-12 rounded-lg object-cover border border-border shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.title}</p>
                        <p className="text-xs text-muted-foreground font-mono">{p.sku}</p>
                      </div>
                      {/* Metrics */}
                      <div className="flex items-center gap-4 shrink-0 text-center">
                        <div>
                          <p className="text-xs font-semibold text-foreground">{p.impressions.toLocaleString()}</p>
                          <p className="text-[10px] text-muted-foreground">impressions</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-foreground">{p.clicks}</p>
                          <p className="text-[10px] text-muted-foreground">clicks</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-foreground">
                            {p.lastImpressionDaysAgo === 999 ? 'Never' : `${p.lastImpressionDaysAgo}d ago`}
                          </p>
                          <p className="text-[10px] text-muted-foreground">last seen</p>
                        </div>
                      </div>
                      {/* Label status */}
                      {isLabeled ? (
                        <span className="shrink-0 flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
                          <CheckIcon className="size-3" />
                          {config.labelValue}
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full border border-dashed border-gray-300 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          unlabeled
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Based on last 30-day performance data · {products.length} products scanned · {zombies.length} qualify
              </p>
            </>
          )}
        </div>
      )}

      <CreateCampaignModal
        open={campaignModalOpen}
        onClose={() => setCampaignModalOpen(false)}
        orgId={orgId}
        orgSlug={orgSlug}
        zombieCount={zombies.length}
        labelValue={config.labelValue}
        currency={currency}
      />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

type Tab = 'products' | 'settings' | 'rules' | 'promotions' | 'audiences' | 'zombie' | 'advanced';

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'products', label: 'Products', icon: <PackageIcon className="size-4" /> },
  { id: 'settings', label: 'Feed Settings', icon: <StoreIcon className="size-4" /> },
  { id: 'rules', label: 'Rules', icon: <FilterIcon className="size-4" /> },
  { id: 'promotions', label: 'Promotions', icon: <TagIcon className="size-4" /> },
  { id: 'audiences', label: 'Audience Sync', icon: <UsersIcon className="size-4" /> },
  { id: 'zombie', label: 'Zombie SKUs', icon: <GhostIcon className="size-4" /> },
  { id: 'advanced', label: 'Advanced', icon: <ZapIcon className="size-4" /> }
];

export function ShoppingFeedsClient({
  orgId,
  orgSlug,
  orgCurrency = 'USD'
}: {
  orgId: string;
  orgSlug: string;
  orgCurrency?: string;
}): React.JSX.Element {
  const { permissions } = useRole();
  const [activeTab, setActiveTab] = React.useState<Tab>('products');
  const [products, setProducts] = React.useState<MockProduct[]>([]);
  const [store, setStore] = React.useState<null | {
    storeName: string;
    shopDomain: string;
    productCount: number;
    lastSyncAt: string;
    currency: string;
  }>(null);
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [wizardOpen, setWizardOpen] = React.useState(false);
  const [googleAccount, setGoogleAccount] = React.useState<{ accountId: string; accountName: string } | null>(null);

  // Use mock connected state for demo
  const isConnected = true;

  React.useEffect(() => {
    void fetch('/api/shopping-feeds/products')
      .then((r) => r.json())
      .then((data) => {
        const d = data as { store: typeof store; products: MockProduct[] };
        setStore(d.store);
        setProducts(d.products);
      })
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    void fetch(`/api/shopping-feeds/settings?orgId=${orgId}`)
      .then((r) => r.json())
      .then((data) => {
        const d = data as { connectedAccounts?: { google?: { accountId: string; accountName: string } | null } };
        setGoogleAccount(d.connectedAccounts?.google ?? null);
      })
      .catch(() => { /* non-critical */ });
  }, [orgId]);

  async function handleSync(): Promise<void> {
    setSyncing(true);
    try {
      await fetch('/api/shopping-feeds/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orgId })
      });
      toast.success('Product feed synced successfully');
      if (store) setStore({ ...store, lastSyncAt: new Date().toISOString() });
    } catch {
      toast.error('Sync failed. Please try again.');
    } finally {
      setSyncing(false);
    }
  }

  if (!isConnected) {
    return <NoStoreState orgSlug={orgSlug} />;
  }

  return (
    <div className="p-6 max-w-6xl">
      {/* Store banner */}
      {store && (
        <StoreConnectedBanner store={store} onSync={handleSync} syncing={syncing} canSync={permissions.canManageFeeds} />
      )}

      {/* Channel coverage cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          {
            icon: <GoogleIconSm />, label: 'Google Shopping', status: 'Active',
            color: 'text-green-600', bg: 'bg-green-50', products: 8,
            action: permissions.canManageFeeds ? (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 gap-1 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-2"
                onClick={() => setWizardOpen(true)}
              >
                <ZapIcon className="size-3" />
                Setup
              </Button>
            ) : null
          },
          { icon: <MetaIconSm />, label: 'Meta Catalog', status: 'Active', color: 'text-green-600', bg: 'bg-green-50', products: 9, action: null },
          { icon: <MicrosoftIconSm />, label: 'Microsoft Shopping', status: 'Pending', color: 'text-amber-600', bg: 'bg-amber-50', products: 5, action: null }
        ].map((ch) => (
          <div key={ch.label} className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              {ch.icon}
              <span className="text-sm font-medium text-foreground flex-1">{ch.label}</span>
              {ch.action}
            </div>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-2xl font-bold text-foreground">{ch.products}</p>
                <p className="text-xs text-muted-foreground">products active</p>
              </div>
              <span className={cn('text-xs font-medium', ch.color, ch.bg, 'rounded-full px-2 py-0.5')}>
                {ch.status}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-border mb-6">
        <div className="flex gap-1">
          {TABS.filter((tab) => {
            if (!permissions.canManageFeeds) {
              return tab.id === 'products';
            }
            return true;
          }).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300'
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'products' && <ProductsTab products={products} loading={loading} />}
      {activeTab === 'settings' && <FeedSettingsTab orgId={orgId} />}
      {activeTab === 'rules' && <RulesTab orgId={orgId} />}
      {activeTab === 'promotions' && <PromotionsTab orgId={orgId} />}
      {activeTab === 'audiences' && <AudienceSyncTab orgId={orgId} />}
      {activeTab === 'zombie' && <ZombieSkuTab orgId={orgId} orgSlug={orgSlug} products={products} currency={store?.currency ?? orgCurrency} />}
      {activeTab === 'advanced' && <AdvancedSettingsTab orgId={orgId} />}

      <GoogleSetupWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        orgId={orgId}
        orgSlug={orgSlug}
        googleAccount={googleAccount}
        storeDomain={store?.shopDomain ?? ''}
        storeCurrency={store?.currency ?? 'USD'}
      />
    </div>
  );
}
