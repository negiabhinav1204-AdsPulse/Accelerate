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
// Secret fields are encrypted at their owning application layers:
//   - ConnectedAdAccount tokens: dashboard symmetricEncrypt (AUTH_SECRET)
//   - CommerceConnector credentials: Python commerce-service CREDENTIALS_ENCRYPTION_KEY
// The DB extension intentionally does not field-encrypt — no double-encryption.
export const ENCRYPTED_FIELDS: Record<string, Record<string, EncryptedFieldType>> = {};
