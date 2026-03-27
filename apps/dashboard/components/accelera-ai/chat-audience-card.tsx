'use client';

import * as React from 'react';
import { UsersIcon } from 'lucide-react';
import { Badge } from '@workspace/ui/components/badge';

type AudienceRow = {
  id: string;
  name: string;
  type: string;
  platforms: string[];
  estimated_size: number | null;
  sync_status: string;
  created_at: string;
};

type Props = {
  total: number;
  audiences: AudienceRow[];
};

const TYPE_CONFIG: Record<string, { label: string; className: string }> = {
  customer_list:  { label: 'Customer List',  className: 'border-purple-500/30 bg-purple-500/10 text-purple-600' },
  website:        { label: 'Website',        className: 'border-blue-500/30 bg-blue-500/10 text-blue-600' },
  catalog:        { label: 'Catalog',        className: 'border-amber-500/30 bg-amber-500/10 text-amber-600' },
  lookalike:      { label: 'Lookalike',      className: 'border-green-500/30 bg-green-500/10 text-green-600' },
  retarget:       { label: 'Retarget',       className: 'border-blue-500/30 bg-blue-500/10 text-blue-600' },
};

const SYNC_CONFIG: Record<string, { label: string; className: string }> = {
  synced:  { label: 'Synced',  className: 'border-green-500/30 bg-green-500/10 text-green-600' },
  pending: { label: 'Pending', className: 'border-amber-500/30 bg-amber-500/10 text-amber-600' },
  error:   { label: 'Error',   className: 'border-red-500/30 bg-red-500/10 text-red-600' },
};

export function ChatAudienceCard({ total, audiences }: Props): React.JSX.Element {
  return (
    <div className="mt-2 w-full max-w-2xl rounded-xl border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <UsersIcon className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">Audiences</span>
        <span className="ml-auto text-xs text-muted-foreground">{total} total</span>
      </div>

      {audiences.length === 0 ? (
        <div className="flex flex-col items-center py-10 text-center">
          <UsersIcon className="mb-2 size-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">
            No audiences created yet. Create custom or lookalike audiences to improve targeting.
          </p>
        </div>
      ) : (
        <div className="divide-y">
          {audiences.map((a) => {
            const typeCfg = TYPE_CONFIG[a.type] ?? TYPE_CONFIG.retarget!;
            const syncCfg = SYNC_CONFIG[a.sync_status] ?? SYNC_CONFIG.pending!;

            return (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium truncate">{a.name}</span>
                    <Badge variant="outline" className={`text-xs shrink-0 ${typeCfg.className}`}>
                      {typeCfg.label}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {a.platforms.join(', ') || 'No platforms'} · Created {a.created_at}
                  </p>
                </div>
                <div className="shrink-0 text-right space-y-1">
                  <p className="text-sm font-medium tabular-nums">
                    {a.estimated_size != null ? a.estimated_size.toLocaleString() : '—'}
                  </p>
                  <Badge variant="outline" className={`text-xs ${syncCfg.className}`}>
                    {syncCfg.label}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
