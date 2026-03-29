'use client';
// catalog-registry.tsx — central renderer for json_render_spec blocks
// Dispatches CatalogSpec to the appropriate catalog component.

import React from 'react';
import type { CatalogSpec } from './catalog-schema';

// Import all 15 catalog components
import { CatalogMetricCard } from '~/components/accelera-ai/catalog/metric-card';
import { CatalogMetricRow } from '~/components/accelera-ai/catalog/metric-row';
import { CatalogCampaignCard } from '~/components/accelera-ai/catalog/campaign-card';
import { CatalogCampaignList } from '~/components/accelera-ai/catalog/campaign-list';
import { CatalogBarChart } from '~/components/accelera-ai/catalog/bar-chart';
import { CatalogLineChart } from '~/components/accelera-ai/catalog/line-chart';
import { CatalogPieChart } from '~/components/accelera-ai/catalog/pie-chart';
import { CatalogDataTable } from '~/components/accelera-ai/catalog/data-table';
import { CatalogMediaPlanPreview } from '~/components/accelera-ai/catalog/media-plan-preview';
import { CatalogCreativePreview } from '~/components/accelera-ai/catalog/creative-preview';
import { CatalogCreativeGrid } from '~/components/accelera-ai/catalog/creative-grid';
import { CatalogAudienceCard } from '~/components/accelera-ai/catalog/audience-card';
import { CatalogAlert } from '~/components/accelera-ai/catalog/alert';
import { CatalogActionButton } from '~/components/accelera-ai/catalog/action-button';
import { CatalogActionRow } from '~/components/accelera-ai/catalog/action-row';

export function CatalogRenderer({ spec }: { spec: CatalogSpec }): React.JSX.Element | null {
  switch (spec.type) {
    case 'MetricCard':
      return <CatalogMetricCard {...spec.props} />;
    case 'MetricRow':
      return <CatalogMetricRow {...spec.props} />;
    case 'CampaignCard':
      return <CatalogCampaignCard {...spec.props} />;
    case 'CampaignList':
      return <CatalogCampaignList {...spec.props} />;
    case 'BarChart':
      return <CatalogBarChart {...spec.props} />;
    case 'LineChart':
      return <CatalogLineChart {...spec.props} />;
    case 'PieChart':
      return <CatalogPieChart {...spec.props} />;
    case 'DataTable':
      return <CatalogDataTable {...spec.props} />;
    case 'MediaPlanPreview':
      return <CatalogMediaPlanPreview {...spec.props} />;
    case 'CreativePreview':
      return <CatalogCreativePreview {...spec.props} />;
    case 'CreativeGrid':
      return <CatalogCreativeGrid {...spec.props} />;
    case 'AudienceCard':
      return <CatalogAudienceCard {...spec.props} />;
    case 'Alert':
      return <CatalogAlert {...spec.props} />;
    case 'ActionButton':
      return <CatalogActionButton {...spec.props} />;
    case 'ActionRow':
      return <CatalogActionRow {...spec.props} />;
    case 'Stack': {
      const gap = spec.props?.gap ?? 3;
      return (
        <div className={`flex flex-col gap-${gap}`}>
          {spec.children.map((child, i) => <CatalogRenderer key={i} spec={child} />)}
        </div>
      );
    }
    case 'Grid': {
      const cols = spec.props?.cols ?? 2;
      return (
        <div className={`grid grid-cols-${cols} gap-3`}>
          {spec.children.map((child, i) => <CatalogRenderer key={i} spec={child} />)}
        </div>
      );
    }
    case 'Section': {
      const title = spec.props?.title;
      return (
        <div className="rounded-lg border bg-card p-4 space-y-3">
          {title && <h3 className="text-sm font-semibold text-foreground">{title}</h3>}
          {spec.children.map((child, i) => <CatalogRenderer key={i} spec={child} />)}
        </div>
      );
    }
    case 'TextBlock': {
      const sizeClass =
        spec.props.size === 'sm'
          ? 'text-xs'
          : spec.props.size === 'lg'
            ? 'text-base'
            : 'text-sm';
      return <p className={`${sizeClass} text-muted-foreground`}>{spec.props.content}</p>;
    }
    case 'Divider':
      return <hr className="border-border" />;
    default:
      return null;
  }
}
