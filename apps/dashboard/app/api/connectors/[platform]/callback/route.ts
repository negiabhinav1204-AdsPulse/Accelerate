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
  baseUrl: string,
  isInmobi?: boolean
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
        // Must exactly match the redirect_uri sent in the authorize step.
        // In dev we send baseUrl (root) because Meta blocks localhost subpaths on live apps.
        redirectUri:
          process.env.NODE_ENV === 'production'
            ? `${baseUrl}/oauth/meta/callback`
            : baseUrl,
        clientId: process.env.META_APP_ID ?? '',
        clientSecret: process.env.META_APP_SECRET ?? ''
      };
    case 'bing': {
      // InMobi users go through tenant-specific adminconsent → the code they get
      // must be exchanged against the same InMobi tenant endpoint.
      // External users use the common endpoint.
      const bingTenantId = process.env.BING_TENANT_ID ?? '89359cf4-9e60-4099-80c4-775a0cfe27a7';
      const tokenHost = isInmobi
        ? `https://login.microsoftonline.com/${bingTenantId}/oauth2/v2.0/token`
        : 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
      return {
        tokenUrl: tokenHost,
        redirectUri: `${baseUrl}/oauth/msads/callback`,
        clientId: process.env.BING_CLIENT_ID ?? '24acd153-281a-4766-898d-fa19bf538ce9',
        clientSecret: process.env.BING_CLIENT_SECRET ?? ''
      };
    }
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
    const loginCustomerId = process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID ?? '';
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': process.env.GOOGLE_DEVELOPER_TOKEN ?? ''
    };
    if (loginCustomerId) headers['login-customer-id'] = loginCustomerId;
    const res = await fetch(
      'https://googleads.googleapis.com/v17/customers:listAccessibleCustomers',
      { headers }
    );
    const body = await res.text();
    console.log('[google] listAccessibleCustomers status:', res.status);
    console.log('[google] listAccessibleCustomers body:', body.slice(0, 600));
    if (!res.ok) return [];
    const data = JSON.parse(body) as { resourceNames?: string[] };
    return (data.resourceNames ?? []).map((name) => {
      const id = name.replace('customers/', '');
      return { id, name: `Google Ads Account ${id}` };
    });
  } catch (e) {
    console.error('[google] fetchGoogleAccounts error:', e);
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

const BING_SOAP_ENDPOINT =
  'https://clientcenter.api.bingads.microsoft.com/Api/CustomerManagement/v13/CustomerManagementService.svc';

function bingSoap(accessToken: string, action: string, bodyInner: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:i="http://www.w3.org/2001/XMLSchema-instance" xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Header xmlns="https://bingads.microsoft.com/Customer/v13">
    <AuthenticationToken>${accessToken}</AuthenticationToken>
    <DeveloperToken>${process.env.BING_DEVELOPER_TOKEN ?? ''}</DeveloperToken>
  </s:Header>
  <s:Body>
    <${action}Request xmlns="https://bingads.microsoft.com/Customer/v13">
      ${bodyInner}
    </${action}Request>
  </s:Body>
</s:Envelope>`;
}

// Extract text between a tag, ignoring any namespace prefix (e.g. <e1:Id> or <Id>)
function xmlTag(xml: string, tag: string): string | null {
  const m = xml.match(new RegExp(`<(?:[\\w]+:)?${tag}[^>]*>([^<]*)<\\/(?:[\\w]+:)?${tag}>`));
  return m ? m[1]! : null;
}

// Extract all blocks wrapped in a given tag
function xmlBlocks(xml: string, tag: string): string[] {
  const blocks: string[] = [];
  const re = new RegExp(`<(?:[\\w]+:)?${tag}[\\s\\S]*?<\\/(?:[\\w]+:)?${tag}>`, 'g');
  for (const m of xml.matchAll(re)) blocks.push(m[0]!);
  return blocks;
}

// Extract SOAP fault message for surfacing to UI
function soapFaultMessage(xml: string): string {
  return (
    xmlTag(xml, 'faultstring') ??
    xmlTag(xml, 'Message') ??
    xmlTag(xml, 'ErrorCode') ??
    'Unknown SOAP error'
  );
}

type BingFetchResult = { accounts: AdAccount[]; error: string | null };

async function fetchBingAccounts(accessToken: string): Promise<BingFetchResult> {
  // ── Step 1: GetUser → resolve Bing Ads UserId from the access token ────────
  let bingUserId: string | null = null;
  let getUserError: string | null = null;

  try {
    const userRes = await fetch(BING_SOAP_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: 'GetUser' },
      body: bingSoap(accessToken, 'GetUser', '<UserId i:nil="true"/>')
    });
    const userXml = await userRes.text();
    console.log('[bing] GetUser status:', userRes.status);
    console.log('[bing] GetUser body:', userXml.slice(0, 600));

    if (!userRes.ok) {
      getUserError = `GetUser ${userRes.status}: ${soapFaultMessage(userXml)}`;
    } else {
      // Handle both <Id> and <e1:Id> namespace variants
      bingUserId = xmlTag(userXml, 'Id');
    }
  } catch (e) {
    getUserError = `GetUser network error: ${String(e)}`;
  }

  if (!bingUserId) {
    const err = getUserError ?? 'GetUser returned no UserId';
    console.error('[bing]', err);
    return { accounts: [], error: err };
  }

  console.log('[bing] UserId:', bingUserId);

  // ── Step 2: SearchAccounts by UserId ───────────────────────────────────────
  try {
    const searchBody = `
<Predicates>
  <Predicate>
    <Field>UserId</Field>
    <Operator>Equals</Operator>
    <Value>${bingUserId}</Value>
  </Predicate>
</Predicates>
<Ordering i:nil="true"/>
<PageInfo>
  <Index>0</Index>
  <Size>100</Size>
</PageInfo>`;

    const accountsRes = await fetch(BING_SOAP_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: 'SearchAccounts' },
      body: bingSoap(accessToken, 'SearchAccounts', searchBody)
    });
    const xml = await accountsRes.text();
    console.log('[bing] SearchAccounts status:', accountsRes.status);
    console.log('[bing] SearchAccounts body:', xml.slice(0, 800));

    if (!accountsRes.ok) {
      return { accounts: [], error: `SearchAccounts ${accountsRes.status}: ${soapFaultMessage(xml)}` };
    }

    const accounts: AdAccount[] = [];
    for (const block of xmlBlocks(xml, 'AdvertiserAccount')) {
      const id = xmlTag(block, 'Id');
      const name = xmlTag(block, 'Name');
      if (id && name) accounts.push({ id, name });
    }
    return { accounts, error: accounts.length === 0 ? 'SearchAccounts returned 0 accounts' : null };
  } catch (e) {
    return { accounts: [], error: `SearchAccounts network error: ${String(e)}` };
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
  const oauthError = request.nextUrl.searchParams.get('error');

  // ── Bing InMobi admin consent callback ──────────────────────────────────────
  // Microsoft returns admin_consent=True (no code) after an admin grants
  // tenant-level consent via the /adminconsent endpoint.
  // We validate state, then redirect to the InMobi tenant's /authorize endpoint
  // to complete the OAuth flow and get actual user tokens.
  if (platform === 'bing' && request.nextUrl.searchParams.get('admin_consent') === 'True') {
    if (!stateParam || !storedState || stateParam !== storedState) {
      return redirectWithError(baseUrl, '/onboarding', 'oauth_state_mismatch', request);
    }
    const tenantId = process.env.BING_TENANT_ID ?? '89359cf4-9e60-4099-80c4-775a0cfe27a7';
    const bingClientId = process.env.BING_CLIENT_ID ?? '24acd153-281a-4766-898d-fa19bf538ce9';
    const redirectUri = `${baseUrl}/oauth/msads/callback`;
    const authorizeParams = new URLSearchParams({
      client_id: bingClientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      response_mode: 'query',
      scope: 'https://ads.microsoft.com/msads.manage offline_access',
      state: stateParam,
      prompt: 'select_account'
    });
    // State cookie stays alive for the second OAuth step
    return NextResponse.redirect(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${authorizeParams.toString()}`
    );
  }

  // If the provider returned an error (e.g. user cancelled), try to decode the state
  // to redirect back to the correct page (connectors or onboarding) rather than /onboarding
  if (oauthError || !code || !stateParam || !storedState) {
    let returnTo = '/onboarding';
    if (stateParam) {
      try {
        const decoded = JSON.parse(symmetricDecrypt(stateParam, process.env.AUTH_SECRET!)) as { returnTo?: string };
        if (decoded.returnTo) returnTo = decoded.returnTo;
      } catch { /* ignore — fall back to /onboarding */ }
    }
    return redirectWithError(baseUrl, returnTo, oauthError ?? 'oauth_missing_params', request);
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
    isInmobi?: boolean;
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

  const config = getPlatformTokenConfig(platform as Platform, baseUrl, statePayload.isInmobi);

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
    console.log(`[connector/${platform}] Token exchange OK, has_refresh_token:`, !!tokens.refresh_token);
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
  let bingFetchError: string | null = null;
  if (platform === 'google') {
    accounts = await fetchGoogleAccounts(tokens.access_token);
  } else if (platform === 'meta') {
    accounts = await fetchMetaAccounts(tokens.access_token);
  } else if (platform === 'bing') {
    const result = await fetchBingAccounts(tokens.access_token);
    accounts = result.accounts;
    bingFetchError = result.error;
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
    } else if (upsertedIds.length === 0) {
      // No accounts found — log the full error, redirect with a simple code for the toast
      console.error(`[connector/${platform}] No accounts fetched:`, bingFetchError ?? 'unknown');
      const noAccountsUrl = new URL(`${baseUrl}${returnTo}`);
      noAccountsUrl.searchParams.set('connector_error', 'no_accounts_found');
      noAccountsUrl.searchParams.set('platform', platformLower);
      const noAccountsResp = NextResponse.redirect(noAccountsUrl.toString());
      noAccountsResp.cookies.delete('connector_oauth_state');
      return noAccountsResp;
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
