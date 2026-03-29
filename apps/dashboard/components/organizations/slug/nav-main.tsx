'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { baseUrl, getPathname } from '@workspace/routes';
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  type SidebarGroupProps
} from '@workspace/ui/components/sidebar';
import { cn } from '@workspace/ui/lib/utils';

import { createMainNavItems, createUtilitiesNavItems } from '~/components/organizations/slug/nav-items';
import { useActiveOrganization } from '~/hooks/use-active-organization';
import { useRole } from '~/hooks/use-role';

export function NavMain(props: SidebarGroupProps): React.JSX.Element {
  const pathname = usePathname();
  const activeOrganization = useActiveOrganization();
  const { permissions } = useRole();
  const allItems = createMainNavItems(activeOrganization.slug);
  const utilitiesItems = createUtilitiesNavItems(activeOrganization.slug);
  const visibleItems = allItems.filter((item) => {
    if (item.title === 'Create Campaign') return permissions.canManageCampaigns;
    if (item.title === 'Shopping Feeds') return permissions.canManageFeeds;
    if (item.title === 'Connectors') return permissions.canManageConnectors || permissions.canManageFeeds;
    return true;
  });
  return (
    <SidebarGroup {...props}>
      <SidebarMenu>
        {visibleItems.map((item, index) => {
          const isActive = pathname.startsWith(
            getPathname(item.href, baseUrl.Dashboard)
          );
          return (
            <SidebarMenuItem key={index}>
              <SidebarMenuButton
                asChild
                isActive={isActive}
                tooltip={item.title}
              >
                <Link
                  href={item.disabled ? '~/' : item.href}
                  target={item.external ? '_blank' : undefined}
                >
                  <item.icon
                    className={cn(
                      'size-4 shrink-0',
                      isActive ? 'text-foreground' : 'text-muted-foreground'
                    )}
                  />
                  <span
                    className={
                      isActive
                        ? 'dark:text-foreground'
                        : 'dark:text-muted-foreground'
                    }
                  >
                    {item.title}
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
      <SidebarSeparator className="my-2" />
      <SidebarGroupLabel>Utilities</SidebarGroupLabel>
      <SidebarMenu>
        {utilitiesItems.map((item, index) => {
          const isActive = pathname.startsWith(
            getPathname(item.href, baseUrl.Dashboard)
          );
          return (
            <SidebarMenuItem key={index}>
              <SidebarMenuButton
                asChild
                isActive={isActive}
                tooltip={item.title}
              >
                <Link href={item.href}>
                  <item.icon
                    className={cn(
                      'size-4 shrink-0',
                      isActive ? 'text-foreground' : 'text-muted-foreground'
                    )}
                  />
                  <span
                    className={
                      isActive
                        ? 'dark:text-foreground'
                        : 'dark:text-muted-foreground'
                    }
                  >
                    {item.title}
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
