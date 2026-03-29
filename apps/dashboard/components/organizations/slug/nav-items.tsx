import {
  BarChart2Icon,
  BellIcon,
  BotIcon,
  BrainCircuitIcon,
  ClipboardListIcon,
  CodeIcon,
  CreditCardIcon,
  FlaskConicalIcon,
  LayoutDashboardIcon,
  LockKeyholeIcon,
  MegaphoneIcon,
  PlusCircleIcon,
  PlugIcon,
  BarChart3Icon,
  RssIcon,
  SearchCheckIcon,
  ShoppingCartIcon,
  SlidersHorizontalIcon,
  StoreIcon,
  UserIcon,
  UserPlus2Icon,
  ZapIcon,
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
      title: 'Analytics',
      href: replaceOrgSlug(routes.dashboard.organizations.slug.Analytics, slug),
      icon: BarChart2Icon
    },
    {
      title: 'Commerce',
      href: replaceOrgSlug(routes.dashboard.organizations.slug.ShoppingFeeds, slug),
      icon: ShoppingCartIcon
    },
    {
      title: 'Feeds',
      href: replaceOrgSlug(routes.dashboard.organizations.slug.Feeds, slug),
      icon: RssIcon
    },
    {
      title: 'Lead Forms',
      href: replaceOrgSlug(routes.dashboard.organizations.slug.Leads, slug),
      icon: ClipboardListIcon
    },
    {
      title: 'Personalization',
      href: replaceOrgSlug(routes.dashboard.organizations.slug.Personalization, slug),
      icon: SlidersHorizontalIcon
    },
    {
      title: 'Experiments',
      href: replaceOrgSlug(routes.dashboard.organizations.slug.Experiments, slug),
      icon: FlaskConicalIcon
    },
    {
      title: 'Optimization',
      href: replaceOrgSlug(routes.dashboard.organizations.slug.Optimization, slug),
      icon: ZapIcon
    },
    {
      title: 'AI CMO',
      href: replaceOrgSlug(routes.dashboard.organizations.slug.Cmo, slug),
      icon: BrainCircuitIcon
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

export function createUtilitiesNavItems(slug: string): NavItem[] {
  return [
    {
      title: 'Keyword Planner',
      href: replaceOrgSlug(routes.dashboard.organizations.slug.UtilitiesKeywordPlanner, slug),
      icon: SearchCheckIcon
    }
  ];
}
