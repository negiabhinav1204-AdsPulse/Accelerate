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
  capabilities: { title: string; description: string }[];
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
  targeting: {
    locations: string[];
    ageRange: string;
    gender: string;
    languages: string[];
    deviceTargeting: string[];
    keywords?: string[];
    bidStrategy: string;
    additionalSettings?: Record<string, unknown>;
  };
  ads: AdCreative[];
};

export type AdCreative = {
  id: string;
  headlines: string[];
  descriptions: string[];
  imageUrls: string[];
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
  | { type: 'error'; message: string };
