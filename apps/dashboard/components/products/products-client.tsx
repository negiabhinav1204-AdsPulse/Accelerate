'use client';

import * as React from 'react';
import { format } from 'date-fns';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  Loader2Icon,
  PackageIcon,
  SearchIcon,
  SparklesIcon,
  TrendingUpIcon
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

type Product = {
  id: string;
  title: string;
  sku: string | null;
  platform: string;
  status: string;
  price: number;
  compareAtPrice: number | null;
  inventoryQuantity: number;
  velocity_30d: number;
  currency: string;
  imageUrl: string | null;
  labels: string[];
  is_top_performer?: boolean;
};

type Props = {
  orgId: string;
  orgCurrency: string;
};

// ── Component ────────────────────────────────────────────────────────────────

export function ProductsClient({ orgId, orgCurrency }: Props): React.JSX.Element {
  const [products, setProducts] = React.useState<Product[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pages, setPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [sort, setSort] = React.useState('velocity_desc');
  const [note, setNote] = React.useState('');

  const searchRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  React.useEffect(() => {
    void fetchProducts();
  }, [page, status, sort]);

  React.useEffect(() => {
    clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => {
      setPage(1);
      void fetchProducts();
    }, 350);
  }, [search]);

  async function fetchProducts(): Promise<void> {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '50',
        sort,
        ...(search && { search }),
        ...(status && { status }),
      });
      const res = await fetch(`/api/products?${params}`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products ?? []);
        setTotal(data.total ?? 0);
        setPages(data.pages ?? 1);
        if (data.note) setNote(data.note);
      }
    } finally {
      setLoading(false);
    }
  }

  const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: orgCurrency, minimumFractionDigits: 2 });

  return (
    <div className="space-y-4">
      {note && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800/30 dark:bg-amber-900/20 dark:text-amber-400">
          {note} — commerce service not yet deployed.
        </div>
      )}

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={(v) => { setStatus(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => { setSort(v); setPage(1); }}>
          <SelectTrigger className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="velocity_desc">Top velocity</SelectItem>
            <SelectItem value="revenue_desc">Top revenue</SelectItem>
            <SelectItem value="inventory_asc">Low inventory first</SelectItem>
            <SelectItem value="title_asc">Name A–Z</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground ml-auto">
          {total.toLocaleString()} products
        </span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : products.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="rounded-xl border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>SKU</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Inventory</TableHead>
                  <TableHead className="text-right">30d Sold</TableHead>
                  <TableHead>Labels</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((p) => (
                  <ProductRow key={p.id} product={p} fmt={fmt} />
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
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
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function ProductRow({ product: p, fmt }: { product: Product; fmt: Intl.NumberFormat }): React.JSX.Element {
  return (
    <TableRow>
      <TableCell>
        <div className="flex items-center gap-3">
          {p.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={p.imageUrl} alt={p.title} className="size-9 rounded object-cover" />
          ) : (
            <div className="flex size-9 items-center justify-center rounded bg-muted">
              <PackageIcon className="size-4 text-muted-foreground" />
            </div>
          )}
          <div>
            <p className="text-sm font-medium leading-tight line-clamp-1">{p.title}</p>
            <p className="text-xs text-muted-foreground capitalize">{p.platform}</p>
          </div>
          {p.is_top_performer && (
            <SparklesIcon className="size-3.5 shrink-0 text-amber-500" />
          )}
        </div>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground font-mono">
        {p.sku ?? '—'}
      </TableCell>
      <TableCell>
        <StatusBadge status={p.status} />
      </TableCell>
      <TableCell className="text-right text-sm tabular-nums">
        {fmt.format(p.price)}
        {p.compareAtPrice && p.compareAtPrice > p.price && (
          <span className="ml-1.5 text-xs text-muted-foreground line-through">
            {fmt.format(p.compareAtPrice)}
          </span>
        )}
      </TableCell>
      <TableCell className="text-right text-sm tabular-nums">
        <InventoryBadge qty={p.inventoryQuantity} />
      </TableCell>
      <TableCell className="text-right text-sm tabular-nums">
        {p.velocity_30d > 0 ? (
          <span className="flex items-center justify-end gap-1 text-green-600">
            <TrendingUpIcon className="size-3.5" />
            {p.velocity_30d}
          </span>
        ) : (
          <span className="text-muted-foreground">0</span>
        )}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {p.labels.slice(0, 3).map((label) => (
            <Badge key={label} variant="secondary" className="text-xs">
              {label}
            </Badge>
          ))}
        </div>
      </TableCell>
    </TableRow>
  );
}

function StatusBadge({ status }: { status: string }): React.JSX.Element {
  if (status === 'active') {
    return <Badge variant="outline" className="border-green-500/30 bg-green-500/10 text-green-600 text-xs">Active</Badge>;
  }
  if (status === 'draft') {
    return <Badge variant="outline" className="text-muted-foreground text-xs">Draft</Badge>;
  }
  return <Badge variant="outline" className="border-red-500/30 bg-red-500/10 text-red-600 text-xs">Archived</Badge>;
}

function InventoryBadge({ qty }: { qty: number }): React.JSX.Element {
  if (qty === 0) {
    return <span className="font-medium text-red-600">Out of stock</span>;
  }
  if (qty <= 5) {
    return <span className="font-medium text-amber-600">{qty} left</span>;
  }
  return <span>{qty}</span>;
}

function EmptyState(): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center">
      <PackageIcon className="mb-4 size-12 text-muted-foreground/40" />
      <h3 className="mb-1 text-sm font-medium">No products found</h3>
      <p className="text-sm text-muted-foreground">
        Connect a commerce store to see your product catalog here.
      </p>
    </div>
  );
}
