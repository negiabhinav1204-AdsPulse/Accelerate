export type AgentName =
  | 'brand'
  | 'lpu'
  | 'intent'
  | 'trend'
  | 'competitor'
  | 'creative'
  | 'budget'
  | 'strategy';

export type AgentStatus = 'idle' | 'running' | 'complete' | 'error';

export type AgentOutput = {
  capabilities?: { title: string; description?: string }[];
  summary?: string;
};

export type AgentState = {
  name: AgentName;
  label: string;
  icon: string;
  status: AgentStatus;
  currentMessage: string;
  completedMessage?: string;
  output?: AgentOutput;
  timeTaken?: number;
  confidence?: 'High' | 'Medium' | 'Low';
  expanded: boolean;
};

export type KpiForecastScenario = {
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  costPerResult: number;
  roas: number;
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
  targetAudience: {
    locations: string[];
    ageRange: string;
    gender: string;
    languages: string[];
    interests?: string[];
  };
  platforms: PlatformPlan[];
  summary: {
    brandName: string;
    tagline: string;
  };
  // Enhanced strategy fields (optional — populated when strategy agent runs)
  executiveSummary?: string;
  kpiForecast?: {
    conservative: KpiForecastScenario;
    moderate: KpiForecastScenario;
    aggressive: KpiForecastScenario;
  };
  prerequisites?: {
    item: string;
    priority: 'blocker' | 'high' | 'medium' | 'low';
    description: string;
  }[];
  audienceStrategy?: {
    prospectingPercentage: number;
    retargetingPercentage: number;
    prospectingAudiences: string[];
    retargetingAudiences: string[];
  };
  riskFlags?: {
    risk: string;
    severity: 'high' | 'medium' | 'low';
    mitigation: string;
  }[];
};

export type PlatformPlan = {
  platform: 'google' | 'meta' | 'bing';
  budget: number;
  budgetPercent: number;
  adTypes: AdTypePlan[];
};

export type AdTypePlan = {
  adType: string;
  adCount: number;
  budget?: number;
  budgetPercent?: number;
  targeting: {
    locations: string[];
    ageRange: string;
    gender: string;
    languages: string[];
    deviceTargeting?: string[];
    keywords?: string[];
    negativeKeywords?: string[];
    matchTypes?: string[];
    placements?: string;
    publisherPlatforms?: string[];
    optimizationGoal?: string;
    conversionEvent?: string;
    bidStrategy?: string;
    interests?: string[];
    additionalSettings?: Record<string, unknown>;
  };
  adExtensions?: {
    sitelinks?: { title: string; description: string; url: string }[];
    callouts?: string[];
    structuredSnippets?: { header: string; values: string[] };
  };
  ads: AdCreative[];
};

export type AdCreative = {
  id: string;
  headlines: string[];
  descriptions: string[];
  imageUrls: string[];
  imagePrompt?: string;
  videoUrl?: string;
  ctaText: string;
  destinationUrl: string;
};

export type SSEEvent =
  | { type: 'agent_start'; agent: AgentName; message: string }
  | { type: 'agent_progress'; agent: AgentName; message: string; step: number }
  | {
      type: 'agent_complete';
      agent: AgentName;
      message: string;
      output: AgentOutput;
      timeTaken: number;
      confidence: 'High' | 'Medium' | 'Low';
    }
  | {
      type: 'preference_question';
      question: string;
      options?: string[];
      questionId: string;
    }
  | { type: 'media_plan'; plan: MediaPlan }
  | { type: 'image_update'; platformAdTypeKey: string; imageUrls: string[] }
  | { type: 'error'; message: string }
  | {
      type: 'conflict_check';
      conflictId: string;
      message: string;
      question: string;
      options: string[];
    };
