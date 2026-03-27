import {
  BellIcon,
  BotIcon,
  CodeIcon,
  CreditCardIcon,
  LayoutDashboardIcon,
  LockKeyholeIcon,
  MegaphoneIcon,
  PackageIcon,
  PlusCircleIcon,
  PlugIcon,
  BarChart3Icon,
  ShoppingCartIcon,
  StoreIcon,
  UserIcon,
  UserPlus2Icon,
  UsersIcon
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { replaceOrgSlug, routes } from '@workspace/routes';

type NavItem = {
  title: string;
  href: string;
  disabled?: boolean;
  external?: boolean;
  icon: LucideIcon;
};

export function createMainNavItems(slug: string): NavItem[] {
  return [
    {
      title: 'Accelera AI',
      href: replaceOrgSlug(routes.dashboard.organizations.slug.AcceleraAi, slug),
      icon: BotIcon
    },
    {
      title: 'Dashboard',
      href: replaceOrgSlug(routes.dashboard.organizations.slug.Dashboard, slug),
      icon: LayoutDashboardIcon
    },
    {
      title: 'Campaigns',
      href: replaceOrgSlug(routes.dashboard.organizations.slug.Campaigns, slug),
      icon: MegaphoneIcon
    },
    {
      title: 'Reporting',
      href: replaceOrgSlug(routes.dashboard.organizations.slug.Reporting, slug),
      icon: BarChart3Icon
    },
    {
      title: 'Shopping Feeds',
      href: replaceOrgSlug(routes.dashboard.organizations.slug.ShoppingFeeds, slug),
      icon: ShoppingCartIcon
    },
    {
      title: 'Commerce',
      href: replaceOrgSlug(routes.dashboard.organizations.slug.Products, slug),
      icon: PackageIcon
    },
    {
      title: 'Customers',
      href: replaceOrgSlug(routes.dashboard.organizations.slug.Cdp, slug),
      icon: UsersIcon
    },
    {
      title: 'Connectors',
      href: replaceOrgSlug(routes.dashboard.organizations.slug.Connectors, slug),
      icon: PlugIcon
    },
    {
      title: 'Create Campaign',
      href: replaceOrgSlug(routes.dashboard.organizations.slug.CreateCampaign, slug),
      icon: PlusCircleIcon
    }
  ];
}

export function createAccountNavItems(slug: string): NavItem[] {
  return [
    {
      title: 'Profile',
      href: replaceOrgSlug(
        routes.dashboard.organizations.slug.settings.account.Profile,
        slug
      ),
      icon: UserIcon
    },
    {
      title: 'Security',
      href: replaceOrgSlug(
        routes.dashboard.organizations.slug.settings.account.Security,
        slug
      ),
      icon: LockKeyholeIcon
    },
    {
      title: 'Notifications',
      href: replaceOrgSlug(
        routes.dashboard.organizations.slug.settings.account.Notifications,
        slug
      ),
      icon: BellIcon
    }
  ];
}

export function createOrganizationNavItems(slug: string): NavItem[] {
  return [
    {
      title: 'General',
      href: replaceOrgSlug(
        routes.dashboard.organizations.slug.settings.organization.General,
        slug
      ),
      icon: StoreIcon
    },
    {
      title: 'Members',
      href: replaceOrgSlug(
        routes.dashboard.organizations.slug.settings.organization.Members,
        slug
      ),
      icon: UserPlus2Icon
    },
    {
      title: 'Billing',
      href: replaceOrgSlug(
        routes.dashboard.organizations.slug.settings.organization.Billing,
        slug
      ),
      icon: CreditCardIcon
    },
    {
      title: 'Developers',
      href: replaceOrgSlug(
        routes.dashboard.organizations.slug.settings.organization.Developers,
        slug
      ),
      icon: CodeIcon
    }
  ];
}
