'use client';

import * as React from 'react';
import NiceModal from '@ebay/nice-modal-react';

import { type Role } from '@workspace/database';
import { SidebarProvider } from '@workspace/ui/components/sidebar';

import {
  ActiveOrganizationProvider,
  type ActiveOrganization
} from '~/hooks/use-active-organization';
import { RoleProvider } from '~/hooks/use-role';

export type ProvidersProps = React.PropsWithChildren<{
  organization: ActiveOrganization;
  role: Role;
  isOwner: boolean;
  defaultOpen?: boolean;
  defaultWidth?: string;
}>;

export function Providers({
  organization,
  role,
  isOwner,
  defaultOpen,
  defaultWidth,
  children
}: ProvidersProps): React.JSX.Element {
  return (
    <ActiveOrganizationProvider organization={organization}>
      <RoleProvider role={role} isOwner={isOwner}>
        {/* Provide a second modal provider so we can use 'useActiveOrganization' in modals */}
        <NiceModal.Provider>
          <SidebarProvider
            defaultOpen={defaultOpen}
            defaultWidth={defaultWidth}
          >
            {children}
          </SidebarProvider>
        </NiceModal.Provider>
      </RoleProvider>
    </ActiveOrganizationProvider>
  );
}
