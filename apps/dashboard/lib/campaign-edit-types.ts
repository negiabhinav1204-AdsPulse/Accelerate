/**
 * Shared types for the campaign edit feature.
 * Used by both the API route handler and the client component.
 */

export type EditOperation = {
  op: 'set';
  path: string; // dot-notation with bracket support, e.g. 'name', 'platforms[0].budget', 'platforms[0].adTypes[0].ads[0].headlines'
  value: unknown;
};

export type CampaignEditPayload = {
  id: string;
  name: string;
  objective: string;
  status: string;
  totalBudget: number;
  currency: string;
  startDate: string;
  endDate: string;
  source: string;
  mediaPlan: {
    campaignName: string;
    objective: string;
    totalBudget: number;
    currency: string;
    dailyBudget: number;
    duration: number;
    startDate: string;
    endDate: string;
    targetAudience: {
      locations: string[];
      ageRange: string;
      gender: string;
      languages: string[];
      interests: string[];
    };
    platforms: {
      platform: string;
      budget: number;
      budgetPercent: number;
      adTypes: {
        adType: string;
        adCount: number;
        targeting: {
          locations: string[];
          ageRange: string;
          gender: string;
          languages: string[];
          deviceTargeting: string[];
          keywords: string[];
          bidStrategy: string;
        };
        ads: {
          id: string;
          headlines: string[];
          descriptions: string[];
          imageUrls: string[];
          ctaText: string;
          destinationUrl: string;
        }[];
      }[];
    }[];
    summary?: { brandName: string; tagline: string };
    executiveSummary?: string;
  };
};

/**
 * Deep-set a value at a dot-notation path (with bracket array notation).
 * Mutates the target object in-place.
 * Example paths: 'name', 'targetAudience.locations', 'platforms[0].budget'
 */
export function setByPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  // Convert bracket notation to dot notation: platforms[0].budget → platforms.0.budget
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
  let current: unknown = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i]!;
    if (typeof current !== 'object' || current === null) return;
    current = (current as Record<string, unknown>)[key];
  }

  const lastKey = parts[parts.length - 1]!;
  if (typeof current === 'object' && current !== null) {
    (current as Record<string, unknown>)[lastKey] = value;
  }
}
