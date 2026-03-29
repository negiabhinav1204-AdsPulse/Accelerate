'use client';
import React, { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@workspace/ui/components/table';
import { ChevronUpIcon, ChevronDownIcon } from 'lucide-react';
import type { DataTableProps } from '~/lib/chat-ui/catalog-schema';

function formatCell(value: string | number | undefined | null, format?: string): string {
  if (value === null || value === undefined) return '—';
  if (format === 'currency') return `$${Number(value).toLocaleString()}`;
  if (format === 'percent') return `${value}%`;
  if (format === 'number') return Number(value).toLocaleString();
  return String(value);
}

export function CatalogDataTable({ title, columns, rows, maxRows = 10 }: DataTableProps) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = [...rows]
    .sort((a, b) => {
      if (!sortKey) return 0;
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === bv) return 0;
      const cmp = (av ?? '') < (bv ?? '') ? -1 : 1;
      return sortDir === 'asc' ? cmp : -cmp;
    })
    .slice(0, maxRows);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  return (
    <div className="space-y-2">
      {title && <p className="text-sm font-semibold text-foreground">{title}</p>}
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map(col => (
                <TableHead
                  key={col.key}
                  className={`text-xs cursor-pointer select-none ${
                    col.align === 'right'
                      ? 'text-right'
                      : col.align === 'center'
                        ? 'text-center'
                        : ''
                  }`}
                  onClick={() => toggleSort(col.key)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {sortKey === col.key
                      ? sortDir === 'asc'
                        ? <ChevronUpIcon className="size-3" />
                        : <ChevronDownIcon className="size-3" />
                      : null}
                  </span>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row, ri) => (
              <TableRow key={ri}>
                {columns.map(col => (
                  <TableCell
                    key={col.key}
                    className={`text-xs py-2 ${
                      col.align === 'right'
                        ? 'text-right tabular-nums'
                        : col.align === 'center'
                          ? 'text-center'
                          : ''
                    }`}
                  >
                    {formatCell(row[col.key], col.format)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {rows.length > maxRows && (
        <p className="text-xs text-muted-foreground text-center">
          {rows.length - maxRows} more rows not shown
        </p>
      )}
    </div>
  );
}
