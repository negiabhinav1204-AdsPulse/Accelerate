import crypto from 'crypto';

import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@workspace/auth';
import { symmetricEncrypt } from '@workspace/auth/encryption';

/**
 * Derive the base URL from the incoming request origin so that the
 * redirect_uri we send to each OAuth provider exactly matches the
 * URI registered in that provider's developer console — regardless
 * of whether the developer is running on localhost:3000 or
 * 127.0.0.1:3000 (both need to be registered in each platform's
 * console for local development).
 *
 * In production NEXT_PUBLIC_DASHBOARD_URL is used instead.
 */
function getBaseUrl(request: NextRequest): string {
  if (process.env.NODE_ENV === 'production') {
    return process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'https://accelerate.inmobi.com';
  }
  // Local dev: derive from actual request so localhost and 127.0.0.1 both work
  return `${request.nextUrl.protocol}//${request.nextUrl.host}`;
}

const GOOGLE_SCOPE = [
  'https://www.googleapis.com/auth/adwords',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile'
].join(' ');

const META_SCOPE = [
  'ads_read',
  'business_management',
  'public_profile',
  'email',
  'pages_manage_ads',
  'pages_show_list',
  'pages_read_engagement',
  'ads_management',
  'leads_retrieval'
].join(',');

type Platform = 'google' | 'meta' | 'bing';
const KNOWN_PLATFORMS: Platform[] = ['google', 'meta', 'bing'];

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
  const userEmail = session.user.email ?? '';
  const returnTo = request.nextUrl.searchParams.get('return') ?? '/onboarding';
  const orgSlug = request.nextUrl.searchParams.get('org') ?? '';

  // State carries context back through the OAuth round-trip
  const statePayload = JSON.stringify({
    nonce: crypto.randomBytes(16).toString('hex'),
    platform,
    userId: session.user.id,
    email: userEmail,
    returnTo,
    orgSlug
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
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: GOOGLE_SCOPE,
      state: encryptedState,
      access_type: 'offline',
      // select_account forces the account picker (allows switching from Chrome default)
      // consent forces the consent screen so we always get a refresh token
      prompt: 'select_account consent'
    });
    authUrlString = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  } else if (platform === 'meta') {
    clientId = process.env.META_APP_ID ?? '';
    if (!clientId) {
      return NextResponse.redirect(
        new URL(`${baseUrl}${returnTo}?connector_error=credentials_missing&platform=${platform}`)
      );
    }
    const redirectUri = `${baseUrl}/oauth/meta/callback`;
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
    clientId = process.env.BING_CLIENT_ID ?? '';
    if (!clientId) {
      return NextResponse.redirect(
        new URL(`${baseUrl}${returnTo}?connector_error=credentials_missing&platform=${platform}`)
      );
    }
    const redirectUri = `${baseUrl}/oauth/msads/callback`;

    const isInmobiUser = userEmail.endsWith('@inmobi.com');
    const isProduction = process.env.NODE_ENV === 'production';

    let tenantId: string;
    let scope: string;

    if (isInmobiUser && isProduction) {
      // Production InMobi flow — requires admin consent to have been pre-granted
      // in the InMobi Azure AD tenant by an IT admin
      tenantId = process.env.BING_TENANT_ID ?? '72f988bf-86f1-41af-91ab-2d7cd011db47';
      scope = `api://${process.env.BING_PERMISSION_SCOPE ?? 'dev.accelerate.inmobi.com'}/msads.manage offline_access`;
    } else {
      // Standard Microsoft Ads flow — works without admin consent
      // Used in local dev (to avoid needing IT admin approval) and for all
      // non-InMobi users in all environments
      tenantId = 'common';
      scope = 'https://ads.microsoft.com/msads.manage offline_access';
    }

    const bingParams = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      response_mode: 'query',
      scope,
      state: encryptedState,
      prompt: 'consent' // critical for 90-day refresh tokens
    });
    authUrlString = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${bingParams.toString()}`;
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
