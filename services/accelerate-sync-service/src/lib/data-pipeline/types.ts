export type SyncResult = {
  reportType: string;
  rowCount: number;
  source: 'api' | 'mock';
  error?: string;
};

export type PlatformSyncSummary = {
  platform: string;
  accountId: string;
  results: SyncResult[];
  completedAt: Date;
};
