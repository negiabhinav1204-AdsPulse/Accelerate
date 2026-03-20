import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@workspace/auth';
import { symmetricDecrypt, symmetricEncrypt } from '@workspace/auth/encryption';
import { prisma } from '@workspace/database/client';

import { runPlatformSync } from '~/lib/data-pipeline/sync';

/**
 * The redirect_uri sent in the token exchange MUST exactly match the one
 * sent in the authorize request. We derive it from the request origin so
 * it works correctly for localhost:3000 AND 127.0.0.1:3000.
 */
function getBaseUrl(request: NextRequest): string {
  if (process.env.NODE_ENV === 'production') {
    return process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'https://accelerate.inmobi.com';
  }
  return `${request.nextUrl.protocol}//${request.nextUrl.host}`;
}

const KNOWN_PLATFORMS = ['google', 'meta', 'bing'] as const;
type Platform = (typeof KNOWN_PLATFORMS)[number];

type TokenConfig = {
  tokenUrl: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
};

function getPlatformTokenConfig(
  platform: Platform,
  baseUrl: string
): TokenConfig {
  switch (platform) {
    case 'google':
      return {
        tokenUrl: 'https://oauth2.googleapis.com/token',
        redirectUri: `${baseUrl}/oauth2/callback`,
        clientId: process.env.GOOGLE_CLIENT_ID ?? '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? ''
      };
    case 'meta':
      return {
        tokenUrl: 'https://graph.facebook.com/v23.0/oauth/access_token',
        redirectUri: `${baseUrl}/oauth/meta/callback`,
        clientId: process.env.META_APP_ID ?? '',
        clientSecret: process.env.META_APP_SECRET ?? ''
      };
    case 'bing':
      // Token endpoint uses /common tenant — works regardless of which
      // authorize tenant was used, as the access code grants cross-tenant
      return {
        tokenUrl: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
        redirectUri: `${baseUrl}/oauth/msads/callback`,
        clientId: process.env.BING_CLIENT_ID ?? '',
        clientSecret: process.env.BING_CLIENT_SECRET ?? ''
      };
  }
}

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
};

type AdAccount = {
  id: string;
  name: string;
};

async function fetchGoogleAccounts(
  accessToken: string
): Promise<AdAccount[]> {
  try {
    const res = await fetch(
      'https://googleads.googleapis.com/v17/customers:listAccessibleCustomers',
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'developer-token': process.env.GOOGLE_DEVELOPER_TOKEN ?? ''
        }
      }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      resourceNames?: string[];
    };
    return (data.resourceNames ?? []).map((name) => {
      const id = name.replace('customers/', '');
      return { id, name: `Google Ads Account ${id}` };
    });
  } catch {
    return [];
  }
}

async function fetchMetaAccounts(
  accessToken: string
): Promise<AdAccount[]> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v18.0/me/adaccounts?fields=id,name&access_token=${accessToken}`
    );
    if (!res.ok) return [];
    const data = (await res.json()) as {
      data?: { id: string; name: string }[];
    };
    return (data.data ?? []).map((a) => ({ id: a.id, name: a.name }));
  } catch {
    return [];
  }
}

async function fetchBingAccounts(
  accessToken: string
): Promise<AdAccount[]> {
  try {
    const body = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Header>
    <h:AuthenticationToken xmlns:h="https://bingads.microsoft.com/Customer/v13">${accessToken}</h:AuthenticationToken>
    <h:DeveloperToken xmlns:h="https://bingads.microsoft.com/Customer/v13">${process.env.BING_DEVELOPER_TOKEN}</h:DeveloperToken>
  </s:Header>
  <s:Body>
    <GetAccountsInfoRequest xmlns="https://bingads.microsoft.com/Customer/v13" />
  </s:Body>
</s:Envelope>`;

    const res = await fetch(
      'https://clientcenter.api.bingads.microsoft.com/Api/CustomerManagement/v13/CustomerManagementService.svc',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: 'GetAccountsInfo'
        },
        body
      }
    );
    if (!res.ok) return [];
    const text = await res.text();
    const matches = [...text.matchAll(/<Id>(\d+)<\/Id>.*?<Name>(.*?)<\/Name>/gs)];
    return matches.map((m) => ({ id: m[1], name: m[2] }));
  } catch {
    return [];
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL('/auth/sign-in', request.url));
  }

  const { platform } = await params;
  if (!KNOWN_PLATFORMS.includes(platform as Platform)) {
    return new NextResponse('Unknown platform', { status: 400 });
  }

  const baseUrl = getBaseUrl(request);

  const code = request.nextUrl.searchParams.get('code');
  const stateParam = request.nextUrl.searchParams.get('state');
  const storedState = request.cookies.get('connector_oauth_state')?.value;

  if (!code || !stateParam || !storedState) {
    return redirectWithError(baseUrl, '/onboarding', 'oauth_missing_params', request);
  }

  // Validate state matches cookie
  if (stateParam !== storedState) {
    return redirectWithError(baseUrl, '/onboarding', 'oauth_state_mismatch', request);
  }

  let statePayload: {
    platform: string;
    userId: string;
    returnTo: string;
    orgSlug: string;
  };
  try {
    statePayload = JSON.parse(
      symmetricDecrypt(stateParam, process.env.AUTH_SECRET!)
    ) as typeof statePayload;
  } catch {
    return redirectWithError(baseUrl, '/onboarding', 'oauth_invalid_state', request);
  }

  if (statePayload.userId !== session.user.id) {
    return redirectWithError(baseUrl, '/onboarding', 'oauth_user_mismatch', request);
  }

  const config = getPlatformTokenConfig(platform as Platform, baseUrl);

  // Exchange code for tokens — redirect_uri must exactly match what was sent in authorize
  let tokens: TokenResponse;
  try {
    const body = new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code'
    });
    const res = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString()
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`[connector/${platform}] Token exchange failed:`, err);
      return redirectWithError(
        baseUrl,
        statePayload.returnTo,
        'oauth_token_error',
        request
      );
    }
    tokens = (await res.json()) as TokenResponse;
  } catch (e) {
    console.error(`[connector/${platform}] Token exchange error:`, e);
    return redirectWithError(
      baseUrl,
      statePayload.returnTo,
      'oauth_token_error',
      request
    );
  }

  // Fetch ad accounts from the platform
  let accounts: AdAccount[] = [];
  if (platform === 'google') {
    accounts = await fetchGoogleAccounts(tokens.access_token);
  } else if (platform === 'meta') {
    accounts = await fetchMetaAccounts(tokens.access_token);
  } else if (platform === 'bing') {
    accounts = await fetchBingAccounts(tokens.access_token);
  }

  const returnTo = statePayload.returnTo;
  const isConnectorFlow = returnTo.includes('/connectors');

  // ── In-platform connector flow ────────────────────────────────────────────
  if (isConnectorFlow) {
    const org = await prisma.organization.findFirst({
      where: { slug: statePayload.orgSlug },
      select: { id: true, slug: true }
    });

    if (!org) {
      return redirectWithError(baseUrl, returnTo, 'org_not_found', request);
    }

    // Verify user is a member of this org
    const membership = await prisma.membership.findFirst({
      where: { organizationId: org.id, userId: statePayload.userId },
      select: { id: true }
    });
    if (!membership) {
      return redirectWithError(baseUrl, returnTo, 'not_member', request);
    }

    const encryptedAccessToken = symmetricEncrypt(
      tokens.access_token,
      process.env.AUTH_SECRET!
    );
    const encryptedRefreshToken = tokens.refresh_token
      ? symmetricEncrypt(tokens.refresh_token, process.env.AUTH_SECRET!)
      : null;

    const platformLower = platform.toLowerCase();

    // Upsert all fetched accounts into ConnectedAdAccount
    const upsertedIds: string[] = [];
    for (const account of accounts.slice(0, 20)) {
      // Check for an existing (possibly archived) row for same org+platform+accountId
      const existing = await prisma.connectedAdAccount.findFirst({
        where: {
          organizationId: org.id,
          platform: platformLower,
          accountId: account.id
        },
        select: { id: true, archivedAt: true }
      });

      if (existing) {
        // Restore if archived, update tokens regardless
        await prisma.connectedAdAccount.update({
          where: { id: existing.id },
          data: {
            archivedAt: null,
            status: 'connected',
            isDefault: false,
            accountName: account.name,
            accessToken: encryptedAccessToken,
            refreshToken: encryptedRefreshToken
          }
        });
        // Restore any archived reports for this account
        if (existing.archivedAt !== null) {
          await prisma.adPlatformReport.updateMany({
            where: { connectedAccountId: existing.id },
            data: { archivedAt: null }
          });
        }
        upsertedIds.push(existing.id);
      } else {
        const created = await prisma.connectedAdAccount.create({
          data: {
            organizationId: org.id,
            platform: platformLower,
            accountId: account.id,
            accountName: account.name,
            status: 'connected',
            isDefault: false,
            accessToken: encryptedAccessToken,
            refreshToken: encryptedRefreshToken
          },
          select: { id: true }
        });
        upsertedIds.push(created.id);
      }
    }

    if (upsertedIds.length === 1) {
      // Auto-set as default and fire background sync
      const singleId = upsertedIds[0]!;
      await prisma.connectedAdAccount.update({
        where: { id: singleId },
        data: { isDefault: true }
      });

      void (async () => {
        try {
          const connected = await prisma.connectedAdAccount.findUnique({
            where: { id: singleId },
            select: {
              id: true,
              organizationId: true,
              platform: true,
              accountId: true,
              accessToken: true
            }
          });
          if (connected?.accessToken) {
            await runPlatformSync(connected);
          }
        } catch (e) {
          console.error('[callback] Background sync failed:', e);
        }
      })();

      // Redirect back to connectors with ?connected=[platform] so the page can show a success toast
      const successUrl = new URL(`${baseUrl}/organizations/${org.slug}/connectors`);
      successUrl.searchParams.set('connected', platformLower);
      const response = NextResponse.redirect(successUrl.toString());
      response.cookies.delete('connector_oauth_state');
      return response;
    } else {
      // Multiple accounts — redirect to connectors with ?select=[platform]
      // The ConnectorsClient will open an account picker dialog
      const selectionUrl = new URL(`${baseUrl}/organizations/${org.slug}/connectors`);
      selectionUrl.searchParams.set('select', platformLower);
      const multiResponse = NextResponse.redirect(selectionUrl.toString());
      multiResponse.cookies.delete('connector_oauth_state');
      return multiResponse;
    }
  }

  // ── Onboarding flow (returnTo includes /onboarding) ────────────────────────
  // Store tokens + accounts in encrypted cookie for completeOnboarding to consume
  const pendingConnector = {
    platform,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token ?? null,
    accounts: accounts.slice(0, 20)
  };
  const encrypted = symmetricEncrypt(
    JSON.stringify(pendingConnector),
    process.env.AUTH_SECRET!
  );

  const redirectUrl = new URL(`${baseUrl}${returnTo}`);
  redirectUrl.searchParams.set('connected', platform);

  const response = NextResponse.redirect(redirectUrl.toString());

  // Clear state cookie, set pending connector cookie
  response.cookies.delete('connector_oauth_state');
  response.cookies.set(`pending_connector_${platform}`, encrypted, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 30, // 30 minutes
    path: '/'
  });

  // Fire Tier 1 data pipeline in background — non-blocking, best-effort
  // Looks up the already-saved ConnectedAdAccount for this user+platform to get the DB id
  void (async () => {
    try {
      // Find the most recently connected account for this user's org + platform
      const membershipRecord = await prisma.membership.findFirst({
        where: { userId: statePayload.userId },
        select: { organizationId: true },
        orderBy: { createdAt: 'desc' }
      });
      if (!membershipRecord) return;

      const connected = await prisma.connectedAdAccount.findFirst({
        where: {
          organizationId: membershipRecord.organizationId,
          platform: platform.toUpperCase()
        },
        select: { id: true, organizationId: true, platform: true, accountId: true, accessToken: true },
        orderBy: { connectedAt: 'desc' }
      });
      if (!connected?.accessToken) return;

      await runPlatformSync(connected);
    } catch (e) {
      console.error('[callback] Background sync failed:', e);
    }
  })();

  return response;
}

function redirectWithError(
  baseUrl: string,
  returnTo: string,
  error: string,
  request: NextRequest
): NextResponse {
  const url = new URL(`${baseUrl}${returnTo}`);
  url.searchParams.set('connector_error', error);
  const response = NextResponse.redirect(url.toString());
  response.cookies.delete('connector_oauth_state');
  return response;
}
