'use client';
import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { PieChartProps } from '~/lib/chat-ui/catalog-schema';

const DEFAULT_COLORS = ['#4285F4', '#1877F2', '#00809D', '#FF9900', '#0A66C2', '#FF4500'];

export function CatalogPieChart({ title, data, height = 240 }: PieChartProps) {
  return (
    <div className="space-y-2">
      {title && <p className="text-sm font-semibold text-foreground">{title}</p>}
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            outerRadius={80}
            label={({ name, percent }: { name: string; percent: number }) =>
              `${name} ${(percent * 100).toFixed(0)}%`
            }
            labelLine={false}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.color ?? DEFAULT_COLORS[i % DEFAULT_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v: number) => v.toLocaleString()}
            contentStyle={{ fontSize: 12, borderRadius: 6 }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
