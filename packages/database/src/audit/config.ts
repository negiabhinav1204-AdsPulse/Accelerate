export const AUDITED_MODELS: Record<string, { fields: string[]; hasLastApplied: boolean }> = {
  Campaign: {
    hasLastApplied: false,
    fields: ['name', 'objective', 'status', 'totalBudget', 'currency', 'startDate', 'endDate', 'targetAudience', 'mediaPlan'],
  },
  PlatformCampaign: {
    hasLastApplied: true,
    fields: ['platform', 'adTypes', 'budget', 'currency', 'status', 'platformCampaignId', 'settings', 'lastAppliedState'],
  },
  AdGroup: {
    hasLastApplied: true,
    fields: ['name', 'adType', 'targeting', 'bidStrategy', 'status', 'platformAdGroupId', 'lastAppliedState'],
  },
  Ad: {
    hasLastApplied: true,
    fields: ['adType', 'headlines', 'descriptions', 'imageUrls', 'videoUrl', 'ctaText', 'destinationUrl', 'status', 'platformAdId', 'metadata', 'lastAppliedState'],
  },
};

export type EncryptedFieldType = 'string' | 'json';
// ConnectedAdAccount tokens are encrypted at the application layer (symmetricEncrypt) — do NOT re-encrypt here.
export const ENCRYPTED_FIELDS: Record<string, Record<string, EncryptedFieldType>> = {
  CommerceConnector: { credentials: 'json' },
};
