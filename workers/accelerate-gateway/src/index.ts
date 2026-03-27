/**
 * accelerate-gateway — Cloudflare Workers API Gateway
 *
 * Responsibilities:
 *  1. Edge-cache the XML product feed (crawled by Google/Meta/Microsoft every hour)
 *  2. Route public shopping-feeds endpoints directly to Cloud Run (bypass Vercel cold-starts)
 *  3. Proxy all other traffic to the Vercel dashboard (auth stays there)
 *  4. Rate-limit API write calls at the edge
 *  5. Inject standard security headers on every response
 *
 * Rollback: disable the Cloudflare proxying (orange cloud → grey cloud in DNS)
 *           or set USE_SHOPPING_FEEDS_SERVICE=false via wrangler secret
 */

export interface Env {
  /** Vercel dashboard origin, e.g. https://accelerate-dashboard-sable.vercel.app */
  DASHBOARD_URL: string;
  /** Cloud Run shopping feeds service URL */
  SHOPPING_FEEDS_SERVICE_URL: string;
  /** Shared INTERNAL_API_KEY for service-to-service calls */
  INTERNAL_API_KEY: string;
  /** Set to 'true' to enable direct routing to the shopping feeds service */
  USE_SHOPPING_FEEDS_SERVICE: string;
  /** Workers KV namespace for rate-limit counters */
  RATE_LIMIT: KVNamespace;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // Gateway health — does not hit origin
    if (pathname === '/gateway/health') {
      return Response.json({ status: 'ok', service: 'accelerate-gateway', ts: Date.now() });
    }

    // Rate-limit mutating API requests
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
      const limited = await isRateLimited(request, env);
      if (limited) {
        return new Response(JSON.stringify({ error: 'Too many requests' }), {
          status: 429,
          headers: { 'Content-Type': 'application/json', 'Retry-After': '60' }
        });
      }
    }

    // Public XML product feed — edge-cached, routed directly to shopping feeds service
    if (pathname.startsWith('/api/shopping-feeds/xml') && env.USE_SHOPPING_FEEDS_SERVICE === 'true' && env.SHOPPING_FEEDS_SERVICE_URL) {
      return handleXmlFeed(request, url, env, ctx);
    }

    // Everything else → Vercel dashboard
    return proxyToDashboard(request, url, env);
  }
};

// ---------------------------------------------------------------------------
// XML feed handler — edge-cached for 1 hour
// ---------------------------------------------------------------------------

async function handleXmlFeed(request: Request, url: URL, env: Env, ctx: ExecutionContext): Promise<Response> {
  const targetUrl = new URL('/shopping-feeds/xml' + url.search, env.SHOPPING_FEEDS_SERVICE_URL);

  // Try Cloudflare cache first
  const cache = caches.default;
  const cacheKey = new Request(targetUrl.toString(), { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached) {
    const response = new Response(cached.body, cached);
    response.headers.set('X-Cache', 'HIT');
    response.headers.set('X-Served-By', 'accelerate-gateway');
    return response;
  }

  const upstream = await fetch(targetUrl.toString(), {
    headers: { 'x-internal-api-key': env.INTERNAL_API_KEY }
  });

  if (!upstream.ok) {
    return new Response('Product feed temporarily unavailable', {
      status: upstream.status,
      headers: { 'Content-Type': 'text/plain' }
    });
  }

  const responseToServe = new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      'X-Cache': 'MISS',
      'X-Served-By': 'accelerate-gateway'
    }
  });

  // Store in cache (non-blocking)
  ctx.waitUntil(cache.put(cacheKey, responseToServe.clone()));
  return addSecurityHeaders(responseToServe);
}

// ---------------------------------------------------------------------------
// Generic dashboard proxy
// ---------------------------------------------------------------------------

async function proxyToDashboard(request: Request, url: URL, env: Env): Promise<Response> {
  const targetUrl = new URL(url.pathname + url.search, env.DASHBOARD_URL);

  const proxyHeaders = new Headers(request.headers);
  proxyHeaders.set('X-Forwarded-Host', url.hostname);
  proxyHeaders.set('X-Forwarded-Proto', url.protocol.replace(':', ''));
  // Strip Cloudflare-specific headers that could confuse Vercel
  proxyHeaders.delete('cf-connecting-ip');
  proxyHeaders.delete('cf-ipcountry');
  proxyHeaders.delete('cf-ray');
  proxyHeaders.delete('cf-visitor');

  const upstream = await fetch(targetUrl.toString(), {
    method: request.method,
    headers: proxyHeaders,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
    redirect: 'manual'
  });

  const response = new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: upstream.headers
  });

  return addSecurityHeaders(response);
}

// ---------------------------------------------------------------------------
// Rate limiting — 120 write requests per IP per minute via Workers KV
// ---------------------------------------------------------------------------

const RATE_LIMIT_REQUESTS = 120;
const RATE_LIMIT_WINDOW_SECONDS = 60;

async function isRateLimited(request: Request, env: Env): Promise<boolean> {
  if (!env.RATE_LIMIT) return false; // KV not bound in dev

  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  const key = `rl:${ip}:${Math.floor(Date.now() / 1000 / RATE_LIMIT_WINDOW_SECONDS)}`;

  const current = await env.RATE_LIMIT.get(key);
  const count = current ? parseInt(current, 10) : 0;

  if (count >= RATE_LIMIT_REQUESTS) return true;

  // Increment counter (non-blocking — we accept minor over-counting at burst)
  await env.RATE_LIMIT.put(key, String(count + 1), { expirationTtl: RATE_LIMIT_WINDOW_SECONDS * 2 });
  return false;
}

// ---------------------------------------------------------------------------
// Security headers applied to every response
// ---------------------------------------------------------------------------

function addSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'SAMEORIGIN');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  // Only set HSTS on non-redirect responses
  if (response.status < 300 || response.status >= 400) {
    headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
