'use client';
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { BarChartProps } from '~/lib/chat-ui/catalog-schema';

function formatTick(value: number, format?: string): string {
  if (format === 'currency') return `$${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}`;
  if (format === 'percent') return `${value}%`;
  return value >= 1000 ? `${(value / 1000).toFixed(0)}k` : String(value);
}

export function CatalogBarChart({ title, data, color = '#4285F4', formatValue, height = 240 }: BarChartProps) {
  return (
    <div className="space-y-2">
      {title && <p className="text-sm font-semibold text-foreground">{title}</p>}
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
          <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => formatTick(v as number, formatValue)}
            width={40}
          />
          <Tooltip
            formatter={(v: number) => formatTick(v, formatValue)}
            contentStyle={{ fontSize: 12, borderRadius: 6 }}
          />
          <Bar dataKey="value" radius={[3, 3, 0, 0]}>
            {data.map((entry, i) => <Cell key={i} fill={entry.color ?? color} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
