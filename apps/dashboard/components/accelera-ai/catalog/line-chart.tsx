'use client';
import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { LineChartProps } from '~/lib/chat-ui/catalog-schema';

function formatTick(value: number, format?: string): string {
  if (format === 'currency') return `$${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}`;
  if (format === 'percent') return `${value}%`;
  return value >= 1000 ? `${(value / 1000).toFixed(0)}k` : String(value);
}

export function CatalogLineChart({ title, data, lines, formatValue, height = 240 }: LineChartProps) {
  const defaultLines = [{ key: 'value', label: 'Value', color: '#4285F4' }];
  const seriesLines = lines ?? defaultLines;
  return (
    <div className="space-y-2">
      {title && <p className="text-sm font-semibold text-foreground">{title}</p>}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
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
          {seriesLines.length > 1 && <Legend />}
          {seriesLines.map(l => (
            <Line
              key={l.key}
              type="monotone"
              dataKey={l.key}
              name={l.label}
              stroke={l.color}
              strokeWidth={2}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
