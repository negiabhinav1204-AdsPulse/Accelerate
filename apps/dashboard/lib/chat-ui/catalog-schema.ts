// catalog-schema.ts — TypeScript types for the json_render_spec catalog
// Validated at runtime in CatalogRenderer before rendering.

export interface MetricCardProps {
  label: string;
  value: string;
  delta?: string;           // e.g. "+12.3%"
  deltaDirection?: 'up' | 'down' | 'neutral';
  subtitle?: string;
  platform?: string;        // 'google' | 'meta' | 'bing' | etc.
}

export interface MetricRowProps {
  metrics: MetricCardProps[];  // 2-5 items
}

export interface CampaignCardProps {
  name: string;
  platform: string;
  status: 'active' | 'paused' | 'draft' | 'ended' | 'error';
  spend: string;
  roas?: string;
  impressions?: number;
  clicks?: number;
  budget?: string;
  health?: 'winner' | 'learner' | 'underperformer' | 'bleeder';
  campaignId?: string;
}

export interface CampaignListProps {
  title?: string;
  campaigns: CampaignCardProps[];
}

export interface ChartDataPoint {
  label: string;    // x-axis label
  value: number;    // primary value
  value2?: number;  // secondary series
  color?: string;   // override color
}

export interface BarChartProps {
  title?: string;
  data: ChartDataPoint[];
  xKey?: string;
  valueLabel?: string;
  color?: string;           // hex color
  formatValue?: string;     // 'currency' | 'percent' | 'number'
  height?: number;
}

export interface LineChartProps {
  title?: string;
  data: ChartDataPoint[];
  lines?: Array<{ key: string; label: string; color: string }>;
  formatValue?: string;
  height?: number;
}

export interface PieChartProps {
  title?: string;
  data: Array<{ label: string; value: number; color?: string }>;
  height?: number;
}

export interface DataTableColumn {
  key: string;
  label: string;
  align?: 'left' | 'right' | 'center';
  format?: 'currency' | 'percent' | 'number' | 'text';
}

export interface DataTableProps {
  title?: string;
  columns: DataTableColumn[];
  rows: Record<string, string | number>[];
  maxRows?: number;         // default 10
}

// MediaPlanPreview — collapsible campaign tree
export interface MediaPlanAdProps {
  headline: string;
  description?: string;
  creativeType?: string;
}

export interface MediaPlanAdSetProps {
  name: string;
  audience?: string;
  ads: MediaPlanAdProps[];
}

export interface MediaPlanCampaignProps {
  name: string;
  platform: string;
  objective?: string;
  dailyBudget?: string;
  targeting?: { locations?: string[]; ageRange?: string; gender?: string };
  adSets: MediaPlanAdSetProps[];
}

export interface MediaPlanPreviewProps {
  planName?: string;
  totalBudget?: string;
  platforms?: string[];
  campaigns: MediaPlanCampaignProps[];
  onPublish?: boolean;      // show publish button
}

export interface CreativePreviewProps {
  headline: string;
  description?: string;
  imageUrl?: string;
  platform?: string;
  ctaLabel?: string;
  format?: 'feed' | 'story' | 'banner';
}

export interface CreativeGridProps {
  title?: string;
  creatives: CreativePreviewProps[];
  columns?: 2 | 3;
}

export interface AudienceCardProps {
  name: string;
  size?: string;
  platforms?: string[];
  status?: 'active' | 'draft' | 'syncing';
  description?: string;
}

export interface AlertProps {
  type: 'info' | 'warning' | 'error' | 'success';
  title?: string;
  message: string;
}

export interface ActionButtonProps {
  label: string;
  action: string;           // 'navigate' | 'confirm' | 'dismiss' | custom
  target?: string;          // URL for navigate, step_id for confirm
  style?: 'primary' | 'secondary' | 'destructive';
  disabled?: boolean;
}

export interface ActionRowProps {
  actions: ActionButtonProps[];
}

// Layout containers — support recursive children
export type CatalogSpec =
  | { type: 'MetricCard';         props: MetricCardProps }
  | { type: 'MetricRow';          props: MetricRowProps }
  | { type: 'CampaignCard';       props: CampaignCardProps }
  | { type: 'CampaignList';       props: CampaignListProps }
  | { type: 'BarChart';           props: BarChartProps }
  | { type: 'LineChart';          props: LineChartProps }
  | { type: 'PieChart';           props: PieChartProps }
  | { type: 'DataTable';          props: DataTableProps }
  | { type: 'MediaPlanPreview';   props: MediaPlanPreviewProps }
  | { type: 'CreativePreview';    props: CreativePreviewProps }
  | { type: 'CreativeGrid';       props: CreativeGridProps }
  | { type: 'AudienceCard';       props: AudienceCardProps }
  | { type: 'Alert';              props: AlertProps }
  | { type: 'ActionButton';       props: ActionButtonProps }
  | { type: 'ActionRow';          props: ActionRowProps }
  | { type: 'Stack';   props?: { gap?: number };  children: CatalogSpec[] }
  | { type: 'Grid';    props?: { cols?: 2 | 3 };  children: CatalogSpec[] }
  | { type: 'Section'; props?: { title?: string }; children: CatalogSpec[] }
  | { type: 'TextBlock'; props: { content: string; size?: 'sm' | 'base' | 'lg' } }
  | { type: 'Divider' }
