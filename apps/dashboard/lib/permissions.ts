import { Role } from '@workspace/database';

export type UserPermissions = {
  canManageCampaigns: boolean;   // create, edit, pause, archive campaigns
  canManageBudgets: boolean;     // set / change campaign budgets
  canManageFeeds: boolean;       // shopping-feeds write actions
  canManageAudiences: boolean;   // audience management
  canManageConnectors: boolean;  // connect / disconnect ad platforms
  canManagePixels: boolean;      // pixels & tracking
  canManageApiKeys: boolean;     // API keys
  canViewBilling: boolean;       // view billing / invoices
  canManageBilling: boolean;     // change payment methods
  canManageMembers: boolean;     // invite / remove / change role
  canManageOrgSettings: boolean; // org general settings
  canUseAcceleraAi: boolean;     // Accelera AI chat
  canExportReports: boolean;     // export PDF / CSV
};

const ADMIN_PERMISSIONS: UserPermissions = {
  canManageCampaigns: true,
  canManageBudgets: true,
  canManageFeeds: true,
  canManageAudiences: true,
  canManageConnectors: true,
  canManagePixels: true,
  canManageApiKeys: true,
  canViewBilling: true,
  canManageBilling: true,
  canManageMembers: true,
  canManageOrgSettings: true,
  canUseAcceleraAi: true,
  canExportReports: true
};

const ROLE_PERMISSIONS: Record<Role, UserPermissions> = {
  [Role.ADMIN]: ADMIN_PERMISSIONS,
  [Role.MARKETER]: {
    ...ADMIN_PERMISSIONS,
    canManageConnectors: false,
    canManagePixels: false,
    canManageApiKeys: false,
    canViewBilling: false,
    canManageBilling: false,
    canManageMembers: false,
    canManageOrgSettings: false
  },
  [Role.ANALYST]: {
    canManageCampaigns: false,
    canManageBudgets: false,
    canManageFeeds: false,
    canManageAudiences: false,
    canManageConnectors: false,
    canManagePixels: false,
    canManageApiKeys: false,
    canViewBilling: false,
    canManageBilling: false,
    canManageMembers: false,
    canManageOrgSettings: false,
    canUseAcceleraAi: true,
    canExportReports: true
  },
  [Role.FINANCE]: {
    canManageCampaigns: false,
    canManageBudgets: false,
    canManageFeeds: false,
    canManageAudiences: false,
    canManageConnectors: false,
    canManagePixels: false,
    canManageApiKeys: false,
    canViewBilling: true,
    canManageBilling: true,
    canManageMembers: false,
    canManageOrgSettings: false,
    canUseAcceleraAi: false,
    canExportReports: true
  },
  [Role.DEVELOPER]: {
    canManageCampaigns: false,
    canManageBudgets: false,
    canManageFeeds: false,
    canManageAudiences: false,
    canManageConnectors: true,
    canManagePixels: true,
    canManageApiKeys: true,
    canViewBilling: false,
    canManageBilling: false,
    canManageMembers: false,
    canManageOrgSettings: false,
    canUseAcceleraAi: false,
    canExportReports: false
  }
};

export function getPermissions(role: Role): UserPermissions {
  return ROLE_PERMISSIONS[role];
}
