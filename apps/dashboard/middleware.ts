import { NextResponse, type NextRequest } from 'next/server';

// This middleware is used to pass organization slug to the headers.
// In Next.js you can get the header value anywhere in the code (both server and client side).
// However server-side params can only be accessed by the page.

const MAX_SLUG_LENGTH = 255;

export function middleware(request: NextRequest): NextResponse<unknown> {
  const path = request.nextUrl.pathname;

  // ── Meta OAuth local-dev callback forwarding ─────────────────────────────
  // In development, Meta only allows http://localhost:3000/ as a redirect URI
  // (adding subpaths is blocked when the app is live). When Meta redirects back
  // to the root with ?code=&state= we forward to the real callback handler.
  if (
    path === '/' &&
    request.nextUrl.searchParams.has('code') &&
    request.nextUrl.searchParams.has('state')
  ) {
    const callbackUrl = new URL('/oauth/meta/callback', request.url);
    request.nextUrl.searchParams.forEach((value, key) => {
      callbackUrl.searchParams.set(key, value);
    });
    return NextResponse.redirect(callbackUrl);
  }

  // ── Organization slug header ─────────────────────────────────────────────
  const pathSegments = path.split('/').filter((segment) => segment !== '');
  let slug = null;
  if (pathSegments.length >= 2 && pathSegments[0] === 'organizations') {
    slug = pathSegments[1];
  }
  const response = NextResponse.next();
  if (slug && slug.length <= MAX_SLUG_LENGTH) {
    response.headers.set('x-organization-slug', slug);
    response.cookies.set('organizationSlug', slug, {
      path: '/',
      httpOnly: true,
      sameSite: 'strict'
    });
  }

  return response;
}

export const config = {
  matcher: ['/', '/organizations/:path*']
};
