/**
 * Local dev seed — bypasses connector OAuth for testing campaigns/reporting.
 * Run: pnpm --filter @workspace/database seed:dev
 * Safe to re-run: upserts on accountId, skips if campaigns already exist.
 */
import { PrismaClient, CampaignStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find the first org in the DB (your local org after onboarding)
  const org = await prisma.organization.findFirst({
    select: { id: true, name: true, slug: true }
  });

  if (!org) {
    console.error('No organization found. Complete onboarding first, then re-run this script.');
    process.exit(1);
  }

  console.log(`Seeding for org: "${org.name}" (${org.slug})`);

  // ── Mock connected ad accounts ──────────────────────────────────────────────
  const mockAccounts = [
    {
      platform: 'google',
      accountId: 'mock-google-001',
      accountName: 'InMobi Google Ads (Mock)',
      currency: 'USD',
      timezone: 'America/New_York',
      accountType: 'CLIENT'
    },
    {
      platform: 'meta',
      accountId: 'mock-meta-001',
      accountName: 'InMobi Meta Ads (Mock)',
      currency: 'USD',
      timezone: 'America/New_York',
      accountType: 'CLIENT'
    },
    {
      platform: 'bing',
      accountId: 'mock-bing-001',
      accountName: 'InMobi Microsoft Ads (Mock)',
      currency: 'USD',
      timezone: 'America/New_York',
      accountType: 'CLIENT'
    }
  ];

  const createdAccounts: { id: string; platform: string }[] = [];

  for (const acct of mockAccounts) {
    const existing = await prisma.connectedAdAccount.findFirst({
      where: { organizationId: org.id, platform: acct.platform, accountId: acct.accountId }
    });

    if (existing) {
      console.log(`  ✓ ${acct.platform} account already exists, skipping`);
      createdAccounts.push({ id: existing.id, platform: acct.platform });
    } else {
      const created = await prisma.connectedAdAccount.create({
        data: {
          organizationId: org.id,
          ...acct,
          isDefault: acct.platform === 'google', // google as default
          status: 'connected',
          accessToken: 'mock-access-token',
          refreshToken: 'mock-refresh-token'
        }
      });
      console.log(`  + created ${acct.platform} account`);
      createdAccounts.push({ id: created.id, platform: acct.platform });
    }
  }

  // ── Find a user to attribute campaigns to ───────────────────────────────────
  const membership = await prisma.membership.findFirst({
    where: { organizationId: org.id },
    select: { userId: true }
  });

  if (!membership) {
    console.log('No members found in org — skipping campaign seed.');
    return;
  }

  // ── Mock campaigns ───────────────────────────────────────────────────────────
  const existingCampaigns = await prisma.campaign.count({
    where: { organizationId: org.id }
  });

  if (existingCampaigns > 0) {
    console.log(`  ✓ ${existingCampaigns} campaigns already exist, skipping`);
  } else {
    const mockCampaigns = [
      {
        name: 'InMobi Brand Awareness Q1',
        objective: 'brand_awareness',
        status: CampaignStatus.LIVE,
        totalBudget: 50000,
        currency: 'USD',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-03-31'),
        sourceUrl: 'https://inmobi.com',
        platforms: ['google', 'meta']
      },
      {
        name: 'Performance Max — App Install',
        objective: 'app_installs',
        status: CampaignStatus.LIVE,
        totalBudget: 25000,
        currency: 'USD',
        startDate: new Date('2026-02-01'),
        endDate: new Date('2026-04-30'),
        sourceUrl: 'https://inmobi.com/app',
        platforms: ['google']
      },
      {
        name: 'Retargeting — Website Visitors',
        objective: 'conversions',
        status: CampaignStatus.DRAFT,
        totalBudget: 10000,
        currency: 'USD',
        startDate: new Date('2026-04-01'),
        endDate: new Date('2026-06-30'),
        sourceUrl: 'https://inmobi.com',
        platforms: ['meta', 'bing']
      },
      {
        name: 'Lead Gen — Enterprise Q2',
        objective: 'lead_generation',
        status: CampaignStatus.DRAFT,
        totalBudget: 15000,
        currency: 'USD',
        startDate: null,
        endDate: null,
        sourceUrl: null,
        platforms: ['google', 'bing']
      }
    ];

    for (const c of mockCampaigns) {
      const campaign = await prisma.campaign.create({
        data: {
          organizationId: org.id,
          createdBy: membership.userId,
          name: c.name,
          objective: c.objective,
          status: c.status,
          totalBudget: c.totalBudget,
          currency: c.currency,
          startDate: c.startDate,
          endDate: c.endDate,
          sourceUrl: c.sourceUrl
        }
      });

      // Create a PlatformCampaign row for each platform
      for (const platform of c.platforms) {
        await prisma.platformCampaign.create({
          data: {
            campaignId: campaign.id,
            platform,
            adTypes: platform === 'google' ? ['search', 'display'] : platform === 'meta' ? ['image', 'video'] : ['search'],
            budget: c.totalBudget / c.platforms.length,
            currency: c.currency,
            status: c.status === CampaignStatus.LIVE ? 'active' : 'draft'
          }
        });
      }

      console.log(`  + created campaign: "${c.name}"`);
    }
  }

  console.log('\nDone. You can now test campaigns/reporting locally without real connectors.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
