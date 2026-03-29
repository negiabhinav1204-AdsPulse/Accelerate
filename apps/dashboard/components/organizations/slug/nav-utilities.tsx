'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDownIcon, WrenchIcon } from 'lucide-react';

import { baseUrl, getPathname } from '@workspace/routes';
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  type SidebarGroupProps
} from '@workspace/ui/components/sidebar';
import { cn } from '@workspace/ui/lib/utils';

import { createUtilitiesNavItems } from '~/components/organizations/slug/nav-items';
import { useActiveOrganization } from '~/hooks/use-active-organization';

export function NavUtilities(props: SidebarGroupProps): React.JSX.Element {
  const pathname = usePathname();
  const activeOrganization = useActiveOrganization();
  const items = createUtilitiesNavItems(activeOrganization.slug);

  const isAnyActive = items.some((item) =>
    pathname.startsWith(getPathname(item.href, baseUrl.Dashboard))
  );

  const [isOpen, setIsOpen] = React.useState(isAnyActive);

  return (
    <SidebarGroup {...props}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center justify-between w-full px-2 py-1.5 rounded-md text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors group"
      >
        <div className="flex items-center gap-1.5">
          <WrenchIcon className="size-3 shrink-0" />
          <span>Utilities</span>
        </div>
        <ChevronDownIcon
          className={cn(
            'size-3 transition-transform duration-200',
            isOpen ? 'rotate-0' : '-rotate-90'
          )}
        />
      </button>
      {isOpen && (
        <SidebarMenu className="mt-1">
          {items.map((item, index) => {
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
      )}
    </SidebarGroup>
  );
}
