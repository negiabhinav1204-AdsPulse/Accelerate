'use client';

import * as React from 'react';

import { type Role } from '@workspace/database';

import { getPermissions, type UserPermissions } from '~/lib/permissions';

type RoleContextValue = {
  role: Role;
  isOwner: boolean;
  permissions: UserPermissions;
};

const RoleContext = React.createContext<RoleContextValue | null>(null);

export function RoleProvider({
  role,
  isOwner,
  children
}: {
  role: Role;
  isOwner: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  const permissions = React.useMemo(() => getPermissions(role), [role]);
  const value = React.useMemo(
    () => ({ role, isOwner, permissions }),
    [role, isOwner, permissions]
  );
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole(): RoleContextValue {
  const ctx = React.useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used within RoleProvider');
  return ctx;
}
