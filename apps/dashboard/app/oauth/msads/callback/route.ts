import { NextRequest, NextResponse } from 'next/server';

/**
 * Registered redirect URI for Microsoft Ads OAuth.
 * Forwards to the actual API handler with all query params preserved.
 * Uses request origin so localhost:3000 and 127.0.0.1:3000 both work.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const baseUrl =
    process.env.NODE_ENV === 'production'
      ? (process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'https://accelerate.inmobi.com')
      : `${url.protocol}//${url.host}`;

  const apiCallbackUrl = new URL('/api/connectors/bing/callback', baseUrl);
  url.searchParams.forEach((value, key) => {
    apiCallbackUrl.searchParams.append(key, value);
  });

  return NextResponse.redirect(apiCallbackUrl.toString());
}
