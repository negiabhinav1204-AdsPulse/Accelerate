'use client';

import * as React from 'react';
import { PackageIcon, SparklesIcon, TrendingUpIcon } from 'lucide-react';

import { Badge } from '@workspace/ui/components/badge';

type Product = {
  title: string;
  price?: string;
  sold_30d?: number;
  revenue_30d?: string;
  inventory?: number;
  badge?: 'best_seller' | 'trending' | 'high_value' | 'low_stock' | 'new' | '';
  insight?: string;
};

type Props = {
  title: string;
  products: Product[];
};

const BADGE_CONFIG: Record<string, { label: string; className: string }> = {
  best_seller: { label: 'Best Seller', className: 'border-amber-500/30 bg-amber-500/10 text-amber-600' },
  trending: { label: 'Trending', className: 'border-blue-500/30 bg-blue-500/10 text-blue-600' },
  high_value: { label: 'High Value', className: 'border-purple-500/30 bg-purple-500/10 text-purple-600' },
  low_stock: { label: 'Low Stock', className: 'border-red-500/30 bg-red-500/10 text-red-600' },
  new: { label: 'New', className: 'border-green-500/30 bg-green-500/10 text-green-600' },
};

export function ChatProductLeaderboard({ title, products }: Props): React.JSX.Element {
  return (
    <div className="mt-2 w-full max-w-2xl rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <TrendingUpIcon className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">{title}</span>
        <span className="ml-auto text-xs text-muted-foreground">{products.length} products</span>
      </div>
      <div className="divide-y">
        {products.map((p, i) => (
          <div key={i} className="flex items-start gap-3 px-4 py-3">
            {/* Rank */}
            <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground mt-0.5">
              {i + 1}
            </div>

            {/* Product info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium truncate">{p.title}</span>
                {p.badge && BADGE_CONFIG[p.badge] && (
                  <Badge
                    variant="outline"
                    className={`text-xs shrink-0 ${BADGE_CONFIG[p.badge]!.className}`}
                  >
                    {BADGE_CONFIG[p.badge]!.label}
                  </Badge>
                )}
              </div>
              {p.insight && (
                <p className="mt-0.5 text-xs text-muted-foreground">{p.insight}</p>
              )}
            </div>

            {/* Stats */}
            <div className="shrink-0 text-right space-y-0.5">
              {p.price && (
                <p className="text-sm font-medium tabular-nums">{p.price}</p>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground justify-end">
                {p.sold_30d !== undefined && p.sold_30d > 0 && (
                  <span className="flex items-center gap-0.5 text-green-600">
                    <SparklesIcon className="size-3" />
                    {p.sold_30d} sold
                  </span>
                )}
                {p.inventory !== undefined && p.inventory < 10 && (
                  <span className="text-red-500">{p.inventory} left</span>
                )}
              </div>
              {p.revenue_30d && (
                <p className="text-xs text-muted-foreground">{p.revenue_30d} / 30d</p>
              )}
            </div>
          </div>
        ))}

        {products.length === 0 && (
          <div className="flex flex-col items-center py-10 text-center">
            <PackageIcon className="mb-2 size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No products found. Connect a commerce store to see your catalog.</p>
          </div>
        )}
      </div>
    </div>
  );
}
