/**
 * Shared types and interfaces for platform adapters.
 * These types were extracted from routes/publish.ts.
 */

import type { ResourceNode } from '../types';

// ---------------------------------------------------------------------------
// Media plan types (mirror of dashboard's MediaPlan / AdTypePlan)
// ---------------------------------------------------------------------------

export type AdCreative = {
  headlines: string[];
  descriptions: string[];
  imageUrls: string[];
  ctaText: string;
  destinationUrl: string;
};

export type AdTypePlan = {
  adType: string;
  budget: number;
  bidStrategy: string;
  targeting: {
    locations: unknown[];
    ageRange: string;
    gender: string;
    languages: string[];
  };
  ads: AdCreative[];
};

export type PlatformPlan = {
  platform: 'google' | 'meta' | 'bing';
  budget: number;
  adTypes: AdTypePlan[];
};

export type MediaPlan = {
  campaignName: string;
  objective: string;
  totalBudget: number;
  currency: string;
  dailyBudget: number;
  duration: number;
  startDate: string;
  endDate: string;
  platforms: PlatformPlan[];
};

export type ConnectedAccount = {
  platform: string;
  accountId: string;
  accessToken: string;
  customerId?: string; // Bing / Google MCC
  developerToken?: string; // Google / Bing
  facebookPageId?: string; // Meta page ID
};

// ---------------------------------------------------------------------------
// Adapter interface
// ---------------------------------------------------------------------------

export interface AdapterCtx {
  account: ConnectedAccount;
  mediaPlan: MediaPlan;
}

export interface PlatformAdapter {
  /**
   * When true, create() on the campaign node builds the whole platform tree;
   * the executor skips create() for child adgroup/ad nodes this phase.
   */
  treeCreate?: boolean;
  create(node: ResourceNode, ctx: AdapterCtx): Promise<{ externalId: string }>;
  update(node: ResourceNode, externalId: string, changedFields: string[], ctx: AdapterCtx): Promise<void>;
  delete(externalId: string, ctx: AdapterCtx): Promise<void>;
  /** Reserved for 3-way reconciliation; leave UNIMPLEMENTED for now. */
  fetchLive?(externalId: string, ctx: AdapterCtx): Promise<Record<string, unknown>>;
}
