import crypto from 'crypto';

import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@workspace/auth';
import { symmetricEncrypt } from '@workspace/auth/encryption';

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'https://accelerate.inmobi.com';
}

const GOOGLE_SCOPE = [
  'https://www.googleapis.com/auth/adwords',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
].join(' ');

// Only standard-access scopes — restricted ones (pages_manage_ads, leads_retrieval, etc.)
// require Meta App Review and block non-tester accounts in development mode.
const META_SCOPE = [
  'ads_read',
  'ads_management',
  'public_profile',
  'email'
].join(',');

const GOOGLE_SHOPPING_SCOPE = 'https://www.googleapis.com/auth/content';

type Platform = 'google' | 'meta' | 'bing' | 'shopify';
const KNOWN_PLATFORMS: Platform[] = ['google', 'meta', 'bing', 'shopify'];

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

  const baseUrl = getBaseUrl();
  const userEmail = session.user.email ?? '';
  const returnTo = request.nextUrl.searchParams.get('return') ?? '/onboarding';
  const orgSlug = request.nextUrl.searchParams.get('org') ?? '';
  const scopeLevel = request.nextUrl.searchParams.get('scopeLevel') ?? '';
  const shopDomain = request.nextUrl.searchParams.get('shop') ?? '';

  const isInmobiUser = userEmail.endsWith('@inmobi.com');

  // State carries context back through the OAuth round-trip
  const statePayload = JSON.stringify({
    nonce: crypto.randomBytes(16).toString('hex'),
    platform,
    userId: session.user.id,
    email: userEmail,
    returnTo,
    orgSlug,
    isInmobi: isInmobiUser,
    ...(scopeLevel && { scopeLevel }),
    ...(shopDomain && { shopDomain })
  });
  const encryptedState = symmetricEncrypt(statePayload, process.env.AUTH_SECRET!);

  let clientId: string;
  let authUrlString: string;

  if (platform === 'google') {
    clientId = process.env.GOOGLE_CLIENT_ID ?? '';
    if (!clientId) {
      return NextResponse.redirect(
        new URL(`${baseUrl}${returnTo}?connector_error=credentials_missing&platform=${platform}`)
      );
    }
    const redirectUri = `${baseUrl}/oauth2/callback`;
    // Append Google Content API scope when connecting from Shopping Feeds (scopeLevel=shopping)
    const googleScope = scopeLevel === 'shopping'
      ? `${GOOGLE_SCOPE} ${GOOGLE_SHOPPING_SCOPE}`
      : GOOGLE_SCOPE;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: googleScope,
      state: encryptedState,
      access_type: 'offline',
      // select_account forces the account picker (allows switching from Chrome default)
      // consent forces the consent screen so we always get a refresh token
      prompt: 'select_account consent'
    });
    authUrlString = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  } else if (platform === 'shopify') {
    if (!shopDomain) {
      return NextResponse.redirect(
        new URL(`${baseUrl}${returnTo}?connector_error=missing_shop_domain&platform=shopify`)
      );
    }
    clientId = process.env.SHOPIFY_CLIENT_ID ?? '';
    if (!clientId) {
      return NextResponse.redirect(
        new URL(`${baseUrl}${returnTo}?connector_error=credentials_missing&platform=shopify`)
      );
    }
    const redirectUri = `${baseUrl}/api/connectors/shopify/callback`;
    const shopifyScopes = [
      'read_products',
      'read_product_listings',
      'read_inventory',
      'read_orders',
      'read_customers'
    ].join(',');
    const shopHost = shopDomain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: shopifyScopes,
      state: encryptedState,
      'grant_options[]': 'per-user'
    });
    authUrlString = `https://${shopHost}/admin/oauth/authorize?${params.toString()}`;
  } else if (platform === 'meta') {
    clientId = process.env.META_APP_ID ?? '';
    if (!clientId) {
      return NextResponse.redirect(
        new URL(`${baseUrl}${returnTo}?connector_error=credentials_missing&platform=${platform}`)
      );
    }
    // In dev, Meta only allows http://localhost:3000/ as a redirect URI (live apps
    // block adding subpaths). Middleware at / detects ?code=&state= and forwards
    // to /oauth/meta/callback. In production use the full registered path.
    const redirectUri =
      process.env.NODE_ENV === 'production'
        ? `${baseUrl}/oauth/meta/callback`
        : baseUrl;
    // Meta only accepts: client_id, redirect_uri, state, scope, response_type
    // Do NOT send access_type or prompt — Meta rejects/ignores them and can cause errors
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      state: encryptedState,
      scope: META_SCOPE,
      response_type: 'code'
    });
    authUrlString = `https://www.facebook.com/v23.0/dialog/oauth?${params.toString()}`;
  } else {
    // Bing / Microsoft Ads
    clientId = process.env.BING_CLIENT_ID ?? '24acd153-281a-4766-898d-fa19bf538ce9';
    if (!clientId) {
      return NextResponse.redirect(
        new URL(`${baseUrl}${returnTo}?connector_error=credentials_missing&platform=${platform}`)
      );
    }
    const redirectUri = `${baseUrl}/oauth/msads/callback`;

    if (isInmobiUser) {
      // InMobi users: tenant-specific endpoint for corporate SSO, but using the
      // standard Microsoft Ads scope so the token works with Bing Ads API.
      const tenantId = process.env.BING_TENANT_ID ?? '89359cf4-9e60-4099-80c4-775a0cfe27a7';
      const bingInternalParams = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        response_mode: 'query',
        scope: 'https://ads.microsoft.com/msads.manage offline_access',
        state: encryptedState,
        prompt: 'consent'
      });
      authUrlString = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${bingInternalParams.toString()}`;
    } else {
      // External users: standard Microsoft common OAuth flow
      const bingParams = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        response_mode: 'query',
        scope: 'https://ads.microsoft.com/msads.manage offline_access',
        state: encryptedState,
        prompt: 'consent' // critical for 90-day refresh tokens
      });
      authUrlString = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${bingParams.toString()}`;
    }
  }

  const response = NextResponse.redirect(authUrlString);

  // Store encrypted state in HTTP-only cookie for CSRF validation in callback
  response.cookies.set('connector_oauth_state', encryptedState, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes
    path: '/'
  });

  return response;
}
