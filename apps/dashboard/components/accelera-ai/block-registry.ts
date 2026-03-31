/**
 * Block Registry — maps block_type strings from the agentic service to
 * the existing React components in this directory.
 *
 * The agentic service emits CUSTOM SSE events with block_type + data.
 * The proxy at /api/chat/route.ts translates these to JSON-lines:
 *   {"type":"tool","name":"<block_type>","input":{...}}
 * The ToolRenderer in accelera-ai-home.tsx switches on the name.
 *
 * New block_type (agentic service)  →  Old show_* name (legacy)  →  React Component
 */

export const BLOCK_TYPE_ALIASES: Record<string, string> = {
  // New agentic service block types → legacy show_* names (used in ToolRenderer switch)
  metric_cards:         'show_metrics',
  campaign_table:       'show_campaigns',
  performance_chart:    'show_chart',
  product_leaderboard:  'show_products',
  inventory_card:       'show_inventory',
  health_score_card:    'show_health_scores',
  executive_summary:    'show_executive_summary',
  funnel_chart:         'show_funnel',
  revenue_breakdown:    'show_revenue_breakdown',
  wasted_spend:         'show_wasted_spend',
  platform_comparison:  'show_platform_comparison',
  audience_card:        'show_audience',
  feed_health:          'show_feed_health',
  nav_suggestion:       'navigate_to',
  connect_prompt:       'connect_accounts_prompt',
  // Dynamic catalog rendering — passes a full CatalogSpec JSON tree
  json_render_spec:     'json_render_spec',
  // Phase 2 — agentic workflow blocks (handled by dedicated components in ToolRenderer)
  // These pass through unchanged so ToolRenderer can route them to WorkflowProgressBlock,
  // HITLCard, etc.
  workflow_progress:    'workflow_progress',
  hitl_request:         'hitl_request',
  generated_image:      'generated_image',
  campaign_overview:    'campaign_overview',
  media_plan:           'media_plan',
};

/**
 * Normalize a block_type from the agentic service to the name used in ToolRenderer.
 * Falls through as-is if it's already a legacy name or an unknown type.
 */
export function resolveBlockType(name: string): string {
  return BLOCK_TYPE_ALIASES[name] ?? name;
}
