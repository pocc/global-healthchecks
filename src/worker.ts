/**
 * Global Health Checks Worker
 * Uses Cloudflare Workers Sockets API (cloudflare:sockets) for TCP, TLS, and HTTP checks.
 * STARTTLS approach gives per-phase timing: tcpMs, tlsHandshakeMs, httpMs.
 */

import { connect } from 'cloudflare:sockets';
import { getColoCity, COLO_TO_CITY } from './coloMapping';

/**
 * In-memory result cache for /api/results endpoint.
 * Stores recent check results keyed by colo, pruned on access.
 * Note: this cache is per-isolate (not shared across datacenters).
 */
const RESULT_TTL_MS = 60_000; // keep results for 60 seconds
const resultCache: { result: HealthCheckResult; storedAt: number }[] = [];

function cacheResult(result: HealthCheckResult): void {
  resultCache.push({ result, storedAt: Date.now() });
  // Prune old entries
  const cutoff = Date.now() - RESULT_TTL_MS;
  while (resultCache.length > 0 && resultCache[0].storedAt < cutoff) {
    resultCache.shift();
  }
}

/**
 * Resolve hostname via Cloudflare DoH (DNS-over-HTTPS) JSON API.
 * Returns the resolved IP or null if lookup fails. Non-blocking to the health check.
 */
async function workerDohResolve(hostname: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(hostname)}&type=A`,
      { headers: { Accept: 'application/dns-json' } }
    );
    const data = await res.json() as { Answer?: { type: number; data: string }[] };
    return data.Answer?.find(a => a.type === 1)?.data ?? null;
  } catch {
    return null;
  }
}

const IP_RE = /^(\d{1,3}\.){3}\d{1,3}$|^[0-9a-fA-F:]+$/;

interface HealthCheckRequest {
  host: string;
  port: number;
  timeout?: number;
  connectTimeout?: number; // TCP connect timeout (ms)
  idleTimeout?: number; // socket idle timeout (ms)
  keepAlive?: boolean; // enable TCP keep-alive
  keepAliveInitialDelay?: number; // keep-alive initial delay (ms)
  retries?: number; // number of retry attempts
  retryBackoff?: boolean; // use exponential backoff
  region?: string;
  tlsEnabled?: boolean;
  tlsServername?: string; // SNI servername (defaults to host)
  minTlsVersion?: string; // 'TLSv1', 'TLSv1.1', 'TLSv1.2', 'TLSv1.3'
  maxTlsVersion?: string;
  ciphers?: string; // colon-separated OpenSSL cipher list
  clientCert?: string; // PEM-encoded client certificate (mTLS)
  clientKey?: string; // PEM-encoded private key (mTLS)
  caBundlePem?: string; // PEM-encoded CA bundle (custom trust store)
  ocspStapling?: boolean; // request OCSP stapling
  pinnedPublicKey?: string; // SHA-256 hash for certificate pinning
  httpEnabled?: boolean;
  httpMethod?: string; // GET, HEAD, POST, OPTIONS
  httpPath?: string; // default '/'
  httpHeaders?: Record<string, string>;
  followRedirects?: boolean;
  maxRedirects?: number; // default 5
}

interface HealthCheckResult {
  success: boolean;
  host: string;
  port: number;
  region?: string;
  latencyMs?: number;
  error?: string;
  timestamp: number;
  cfRay?: string;
  colo?: string;
  coloCity?: string;
  cfPlacement?: string;
  clientTcpRtt?: number; // TCP RTT from client to Cloudflare edge (ms), from request.cf
  tcpMs?: number;
  /** Not currently populated — cloudflare:sockets connect() does not expose TLS session details */
  tlsVersion?: string;
  /** Not currently populated — cloudflare:sockets connect() does not expose TLS session details */
  tlsCipher?: string;
  tlsHandshakeMs?: number;
  httpStatusCode?: number;
  httpStatusText?: string;
  httpVersion?: string;
  httpMs?: number; // time to first byte after request sent
  redirectCount?: number;
  redirectUrl?: string; // final redirect destination (if followed)
  resolvedIp?: string; // DNS-resolved IP from edge DoH lookup
}

/**
 * Single TCP connection attempt using Cloudflare Workers Sockets API
 */
async function singleTcpAttempt(
  request: HealthCheckRequest
): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const connectMs = request.connectTimeout || request.timeout || 5000;

  try {
    const socket = connect(
      { hostname: request.host, port: request.port },
      { secureTransport: 'off', allowHalfOpen: false }
    );

    let timer: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Connection timeout')), connectMs);
    });

    await Promise.race([socket.opened, timeoutPromise]);
    clearTimeout(timer!);
    const latencyMs = Date.now() - startTime;
    await socket.close();

    return {
      success: true,
      host: request.host,
      port: request.port,
      region: request.region,
      latencyMs,
      tcpMs: latencyMs,
      timestamp: Date.now(),
    };
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    return {
      success: false,
      host: request.host,
      port: request.port,
      region: request.region,
      latencyMs,
      tcpMs: latencyMs,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now(),
    };
  }
}

/**
 * Test raw TCP connectivity with optional retries and exponential backoff
 */
async function testTcpPort(
  request: HealthCheckRequest
): Promise<HealthCheckResult> {
  const maxRetries = request.retries || 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const result = await singleTcpAttempt(request);
    if (result.success || attempt === maxRetries) return result;

    // Retry delay: exponential backoff with jitter, or fixed 100ms
    const baseDelay = request.retryBackoff ? Math.pow(2, attempt) * 100 : 100;
    const jitter = request.retryBackoff ? Math.random() * baseDelay * 0.5 : 0;
    await new Promise(r => setTimeout(r, baseDelay + jitter));
  }

  // Should not reach here, but TypeScript needs it
  return singleTcpAttempt(request);
}

/**
 * Test TLS handshake timing using two concurrent connections:
 *
 * Both connections open simultaneously to experience identical network conditions.
 * The difference in their open times isolates the TLS handshake cost:
 *
 *   tcpMs        = time until TCP-only socket.opened  (secureTransport: 'off')
 *   tcpPlusTlsMs = time until TLS socket.opened       (secureTransport: 'on')
 *   tlsHandshakeMs = tcpPlusTlsMs - tcpMs
 *
 * Sequential connections would have more variance; concurrent connections share
 * the same network path and routing, making the delta measurement reliable.
 */
async function testTlsPort(
  request: HealthCheckRequest
): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const timeout = request.timeout || 5000;

  const timeoutReject = (ms: number, msg: string) =>
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error(msg)), ms));

  // Open both connections simultaneously
  let tcpSocket: ReturnType<typeof connect> | undefined;
  let tlsSocket: ReturnType<typeof connect> | undefined;

  tcpSocket = connect(
    { hostname: request.host, port: request.port },
    { secureTransport: 'off', allowHalfOpen: false }
  );
  tlsSocket = connect(
    { hostname: request.host, port: request.port },
    { secureTransport: 'on', allowHalfOpen: false }
  );

  const tcpOpenedAt = Promise.race([tcpSocket.opened, timeoutReject(timeout, 'TCP connection timeout')])
    .then(() => Date.now() - startTime);
  const tlsOpenedAt = Promise.race([tlsSocket.opened, timeoutReject(timeout, 'TLS connection timeout')])
    .then(() => Date.now() - startTime);

  const [tcpResult, tlsResult] = await Promise.allSettled([tcpOpenedAt, tlsOpenedAt]);

  tcpSocket.close().catch(() => {});
  tlsSocket.close().catch(() => {});

  if (tcpResult.status === 'rejected') {
    return {
      success: false,
      host: request.host,
      port: request.port,
      region: request.region,
      latencyMs: Date.now() - startTime,
      tcpMs: Date.now() - startTime,
      error: tcpResult.reason instanceof Error ? tcpResult.reason.message : 'TCP connection failed',
      timestamp: Date.now(),
    };
  }

  if (tlsResult.status === 'rejected') {
    return {
      success: false,
      host: request.host,
      port: request.port,
      region: request.region,
      latencyMs: Date.now() - startTime,
      tcpMs: tcpResult.value,
      error: tlsResult.reason instanceof Error ? tlsResult.reason.message : 'TLS connection failed',
      timestamp: Date.now(),
    };
  }

  const tcpMs = tcpResult.value;
  const tlsHandshakeMs = Math.max(0, tlsResult.value - tcpMs);

  return {
    success: true,
    host: request.host,
    port: request.port,
    region: request.region,
    latencyMs: tlsResult.value,
    timestamp: Date.now(),
    tcpMs,
    tlsHandshakeMs,
  };
}

/**
 * Test full HTTPS request using two connections for accurate per-phase timing.
 *
 * Connection 1: secureTransport: 'off'  → tcpMs (pure TCP)
 * Connection 2: secureTransport: 'on'   → TCP+TLS time; tlsHandshakeMs = total - tcpMs;
 *                                          then send HTTP request → httpMs (TTFB)
 *
 * Optionally follows 3xx redirects up to maxRedirects.
 */
async function testHttpPort(
  request: HealthCheckRequest,
  redirectCount = 0,
  visitedUrls: Set<string> = new Set()
): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const timeout = request.timeout || 5000;
  const sni = request.tlsServername || request.host;
  let tcpSocket: ReturnType<typeof connect> | undefined;
  let tlsSocket: ReturnType<typeof connect> | undefined;

  const withTimeout = <T>(p: Promise<T>, ms: number, msg: string): Promise<T> =>
    Promise.race([p, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(msg)), ms))]);

  try {
    // Open TCP-only and TLS connections simultaneously to minimize timing variance.
    // TCP socket measures pure TCP RTT; TLS socket measures TCP+TLS combined.
    // The delta gives tlsHandshakeMs.  The TLS socket is reused for the HTTP request.
    tcpSocket = connect(
      { hostname: request.host, port: request.port },
      { secureTransport: 'off', allowHalfOpen: false }
    );
    tlsSocket = connect(
      { hostname: request.host, port: request.port },
      { secureTransport: 'on', allowHalfOpen: false }
    );

    const tcpOpenedAt = withTimeout(tcpSocket.opened, timeout, 'TCP connection timeout')
      .then(() => Date.now() - startTime);
    const tlsOpenedAt = withTimeout(tlsSocket.opened, timeout, 'TLS connection timeout')
      .then(() => Date.now() - startTime);

    const [tcpResult, tlsResult] = await Promise.allSettled([tcpOpenedAt, tlsOpenedAt]);

    // TCP socket is only needed for timing; close it now
    tcpSocket.close().catch(() => {});
    tcpSocket = undefined;

    // Propagate TCP failure
    if (tcpResult.status === 'rejected') {
      tlsSocket.close().catch(() => {});
      tlsSocket = undefined;
      const err = tcpResult.reason instanceof Error ? tcpResult.reason.message : 'TCP connection failed';
      return { success: false, host: request.host, port: request.port, region: request.region, latencyMs: Date.now() - startTime, error: err, timestamp: Date.now(), ...(redirectCount > 0 && { redirectCount }) };
    }
    // Propagate TLS failure
    if (tlsResult.status === 'rejected') {
      tlsSocket.close().catch(() => {});
      tlsSocket = undefined;
      const err = tlsResult.reason instanceof Error ? tlsResult.reason.message : 'TLS connection failed';
      return { success: false, host: request.host, port: request.port, region: request.region, latencyMs: Date.now() - startTime, tcpMs: tcpResult.value, error: err, timestamp: Date.now(), ...(redirectCount > 0 && { redirectCount }) };
    }

    const tcpMs = tcpResult.value;
    const tlsHandshakeMs = Math.max(0, tlsResult.value - tcpMs);

    // Phase 3: HTTP request
    const ALLOWED_METHODS = ['GET', 'HEAD', 'POST', 'OPTIONS'];
    const method = ALLOWED_METHODS.includes((request.httpMethod || 'GET').toUpperCase())
      ? (request.httpMethod || 'GET').toUpperCase()
      : 'GET';
    const rawPath = request.httpPath || '/';
    const path = /[\r\n]/.test(rawPath) ? '/' : rawPath;
    const lines = [`${method} ${path} HTTP/1.1`, `Host: ${sni}`];
    if (request.httpHeaders) {
      const RESERVED = ['host', 'connection', 'content-length', 'transfer-encoding'];
      for (const [key, value] of Object.entries(request.httpHeaders)) {
        if (/[\r\n]/.test(key) || /[\r\n]/.test(value)) continue;
        if (RESERVED.includes(key.toLowerCase())) continue;
        lines.push(`${key}: ${value}`);
      }
    }
    lines.push('Connection: close', '', '');

    const writer = tlsSocket.writable.getWriter();
    const reader = tlsSocket.readable.getReader();
    const httpSentAt = Date.now();
    await writer.write(new TextEncoder().encode(lines.join('\r\n')));
    writer.releaseLock();

    // Read first chunk (status line + headers)
    const { value: chunk } = await withTimeout(reader.read(), timeout, 'Response timeout');
    reader.releaseLock();
    const httpMs = Date.now() - httpSentAt;
    await tlsSocket.close();

    if (!chunk) {
      return {
        success: false,
        host: request.host,
        port: request.port,
        region: request.region,
        latencyMs: Date.now() - startTime,
        error: 'Empty response',
        timestamp: Date.now(),
        tcpMs,
        tlsHandshakeMs,
        ...(redirectCount > 0 && { redirectCount }),
      };
    }

    const responseStart = new TextDecoder().decode(chunk).slice(0, 2048);
    const statusMatch = responseStart.match(/^(HTTP\/[\d.]+)\s+(\d{3})\s*(.*)/);
    const httpVersion = statusMatch?.[1];
    const statusCode = statusMatch ? parseInt(statusMatch[2]) : undefined;
    const statusText = statusMatch?.[3]?.trim();

    // Follow 3xx redirects
    const maxRedir = request.maxRedirects ?? 5;
    if (request.followRedirects && statusCode && statusCode >= 300 && statusCode < 400 && redirectCount < maxRedir) {
      const locationMatch = responseStart.match(/\r\nLocation:\s*(\S+)/i);
      if (locationMatch) {
        const location = locationMatch[1];
        try {
          const base = `https://${sni}:${request.port}${request.httpPath || '/'}`;
          const redirectUrl = new URL(location, base);
          const redirectHost = redirectUrl.hostname;
          const redirectPort = parseInt(redirectUrl.port) || (redirectUrl.protocol === 'https:' ? 443 : 80);
          const redirectPath = redirectUrl.pathname + redirectUrl.search;

          const redirectBlocked = isBlockedHost(redirectHost);
          if (redirectBlocked) {
            return { success: false, host: request.host, port: request.port, region: request.region, latencyMs: Date.now() - startTime, error: `Redirect to blocked host: ${redirectBlocked}`, timestamp: Date.now(), tcpMs, redirectCount: redirectCount + 1, redirectUrl: redirectUrl.href };
          }
          if (visitedUrls.has(redirectUrl.href)) {
            return { success: false, host: request.host, port: request.port, region: request.region, latencyMs: Date.now() - startTime, error: `Redirect loop detected: ${redirectUrl.href}`, timestamp: Date.now(), tcpMs, redirectCount: redirectCount + 1, redirectUrl: redirectUrl.href };
          }
          visitedUrls.add(redirectUrl.href);

          const result = await testHttpPort(
            { ...request, host: redirectHost, port: redirectPort, httpPath: redirectPath, tlsServername: redirectHost },
            redirectCount + 1, visitedUrls
          );
          return { ...result, host: request.host, port: request.port, redirectCount: redirectCount + 1, redirectUrl: redirectUrl.href };
        } catch {
          return { success: false, host: request.host, port: request.port, region: request.region, latencyMs: Date.now() - startTime, error: `Bad redirect URL: ${location}`, timestamp: Date.now(), tcpMs, redirectCount };
        }
      }
    }

    return {
      success: statusCode !== undefined && statusCode < 500,
      host: request.host,
      port: request.port,
      region: request.region,
      latencyMs: Date.now() - startTime,
      timestamp: Date.now(),
      tcpMs,
      tlsHandshakeMs,
      httpMs,
      httpStatusCode: statusCode,
      httpStatusText: statusText,
      httpVersion,
      ...(redirectCount > 0 && { redirectCount }),
    };
  } catch (error) {
    try { tcpSocket?.close(); } catch { /* ignore */ }
    try { tlsSocket?.close(); } catch { /* ignore */ }
    return {
      success: false,
      host: request.host,
      port: request.port,
      region: request.region,
      latencyMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: Date.now(),
      ...(redirectCount > 0 && { redirectCount }),
    };
  }
}


/**
 * SSRF protection: block connections to private/internal/link-local addresses.
 * Returns an error string if blocked, or null if allowed.
 */
function isBlockedHost(host: string): string | null {
  // Normalize to lowercase for comparison
  const h = host.toLowerCase().trim();

  // Block empty hosts
  if (!h) return 'Empty host';

  // Strip brackets from IPv6 (e.g. [::1] → ::1)
  const stripped = h.startsWith('[') && h.endsWith(']') ? h.slice(1, -1) : h;

  // Block IPv6 loopback, unspecified, private (fc00::/7), link-local (fe80::/10)
  if (stripped === '::1' || stripped === '::') {
    return 'Loopback/unspecified address blocked';
  }
  if (/^f[cd][0-9a-f]{0,2}:/i.test(stripped)) return 'IPv6 private (fc00::/7) blocked';
  if (/^fe[89ab][0-9a-f]:/i.test(stripped)) return 'IPv6 link-local (fe80::/10) blocked';
  // Block IPv4-mapped IPv6 (::ffff:x.x.x.x)
  if (/^::ffff:/i.test(stripped)) return 'IPv4-mapped IPv6 address blocked';

  // Block well-known internal hostnames
  if (h === 'localhost' || h.endsWith('.localhost') ||
      h === 'metadata.google.internal' ||
      h.endsWith('.internal')) {
    return 'Internal hostname blocked';
  }

  // Check if it's an IPv4 address
  const ipv4Match = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b, c] = ipv4Match.map(Number);
    // 127.0.0.0/8 loopback
    if (a === 127) return 'Loopback address blocked';
    // 0.0.0.0/8
    if (a === 0) return 'Unspecified address blocked';
    // 10.0.0.0/8
    if (a === 10) return 'Private address (10/8) blocked';
    // 172.16.0.0/12
    if (a === 172 && b >= 16 && b <= 31) return 'Private address (172.16/12) blocked';
    // 192.168.0.0/16
    if (a === 192 && b === 168) return 'Private address (192.168/16) blocked';
    // 169.254.0.0/16 link-local (includes cloud metadata 169.254.169.254)
    if (a === 169 && b === 254) return 'Link-local address blocked';
    // 100.64.0.0/10 CGNAT
    if (a === 100 && b >= 64 && b <= 127) return 'CGNAT address blocked';
    // 192.0.0.0/24 IETF protocol assignments
    if (a === 192 && b === 0 && c === 0) return 'IETF reserved address blocked';
  }

  return null;
}

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

/**
 * Main worker fetch handler
 */
export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // CORS: reflect allowed origins instead of wildcard
    const origin = request.headers.get('Origin') ?? '';
    const ALLOWED_ORIGINS = [
      'https://healthchecks.ross.gg',
      'http://localhost:5173',
      'http://127.0.0.1:5173',
    ];
    let allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : '';
    if (!allowedOrigin) {
      try {
        const u = new URL(origin);
        if (u.hostname.endsWith('.healthchecks.ross.gg')) allowedOrigin = origin;
      } catch { /* not a valid URL */ }
    }
    const corsHeaders: Record<string, string> = {
      ...(allowedOrigin ? { 'Access-Control-Allow-Origin': allowedOrigin } : {}),
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Expose-Headers': 'cf-placement, cf-ray',
      'Vary': 'Origin',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Geo endpoint -return caller's location from Cloudflare edge
    if (url.pathname === '/api/geo' && request.method === 'GET') {
      const cf = request.cf as any;
      return new Response(JSON.stringify({
        lat: cf?.latitude ? parseFloat(cf.latitude) : null,
        lng: cf?.longitude ? parseFloat(cf.longitude) : null,
        city: cf?.city || null,
        country: cf?.country || null,
        colo: cf?.colo || null,
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          ...corsHeaders,
        },
      });
    }

    // Geo lookup proxy endpoint - proxies geolocation API requests to avoid CORS issues
    if (url.pathname === '/api/geo-lookup' && request.method === 'GET') {
      const ip = url.searchParams.get('ip');
      if (!ip) {
        return new Response(JSON.stringify({ error: 'Missing ip parameter' }), {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      }

      // Try multiple geo providers in order
      const geoProviders = [
        {
          url: `https://ipwho.is/${ip}`,
          parse: (d: any) => d.success !== false && d.latitude && d.longitude
            ? { lat: d.latitude, lng: d.longitude, city: d.city, country: d.country }
            : null,
        },
        {
          url: `https://freeipapi.com/api/json/${ip}`,
          parse: (d: any) => d.latitude && d.longitude
            ? { lat: d.latitude, lng: d.longitude, city: d.cityName, country: d.countryName }
            : null,
        },
        {
          url: `https://reallyfreegeoip.org/json/${encodeURIComponent(ip)}`,
          parse: (d: any) => d.latitude && d.longitude
            ? { lat: d.latitude, lng: d.longitude, city: d.city, country: d.country_name }
            : null,
        },
      ];

      for (const provider of geoProviders) {
        try {
          const response = await fetch(provider.url, { signal: AbortSignal.timeout(3000) });
          if (response.ok) {
            const data = await response.json();
            const parsed = provider.parse(data);
            if (parsed) {
              return new Response(JSON.stringify(parsed), {
                headers: {
                  'Content-Type': 'application/json',
                  'Cache-Control': 'public, max-age=3600',
                  ...corsHeaders,
                },
              });
            }
          }
        } catch {
          // Try next provider
          continue;
        }
      }

      // All providers failed
      return new Response(JSON.stringify({ error: 'All geo providers failed' }), {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    // Results endpoint - return cached check results from this isolate
    if (url.pathname === '/api/results' && request.method === 'GET') {
      const sinceParam = url.searchParams.get('since');
      const since = sinceParam ? parseInt(sinceParam) : Date.now() - 1000; // default: last 1 second
      const cutoff = Date.now() - RESULT_TTL_MS;

      // Filter to results within the requested window (and not expired)
      const filtered = resultCache
        .filter(e => e.storedAt >= Math.max(since, cutoff))
        .map(e => e.result);

      const colo = (request.cf as any)?.colo || undefined;
      return new Response(JSON.stringify({
        colo,
        coloCity: getColoCity(colo),
        count: filtered.length,
        since,
        results: filtered,
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          ...corsHeaders,
        },
      });
    }

    // Datacenters endpoint - return all known Cloudflare datacenter locations
    if (url.pathname === '/api/datacenters' && request.method === 'GET') {
      const datacenters = Object.entries(COLO_TO_CITY).map(([code, city]) => ({ code, city }));
      return new Response(JSON.stringify({
        count: datacenters.length,
        datacenters,
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=86400',
          ...corsHeaders,
        },
      });
    }

    // API endpoint for health checks
    if (url.pathname === '/api/check' && request.method === 'POST') {
      try {
        const body: HealthCheckRequest = await request.json();

        // Validate input
        if (!body.host || !body.port) {
          return new Response(
            JSON.stringify({ error: 'Missing required fields: host and port' }),
            {
              status: 400,
              headers: {
                'Content-Type': 'application/json',
                ...corsHeaders
              }
            }
          );
        }

        // Validate port range
        if (body.port < 1 || body.port > 65535) {
          return new Response(
            JSON.stringify({ error: 'Port must be between 1 and 65535' }),
            {
              status: 400,
              headers: {
                'Content-Type': 'application/json',
                ...corsHeaders
              }
            }
          );
        }

        // SSRF protection: block private/internal hosts
        const blocked = isBlockedHost(body.host);
        if (blocked) {
          return new Response(
            JSON.stringify({ error: `Blocked host: ${blocked}` }),
            {
              status: 400,
              headers: {
                'Content-Type': 'application/json',
                ...corsHeaders
              }
            }
          );
        }

        // Resolve DNS from this edge location (reveals geo-DNS differences)
        const resolvedIp = IP_RE.test(body.host) ? body.host : await workerDohResolve(body.host);

        const result = body.httpEnabled
          ? await testHttpPort(body)
          : body.tlsEnabled
            ? await testTlsPort(body)
            : await testTcpPort(body);

        const mode = body.httpEnabled ? 'http' : body.tlsEnabled ? 'tls' : 'tcp';
        console.log(`[check] ${mode} ${body.host}:${body.port} → ${result.success ? 'ok' : 'fail'} ${result.latencyMs}ms${result.error ? ' error=' + result.error : ''}${result.tcpMs !== undefined ? ' tcp=' + result.tcpMs : ''}${result.tlsHandshakeMs !== undefined ? ' tls=' + result.tlsHandshakeMs : ''}${result.httpMs !== undefined ? ' http=' + result.httpMs : ''}`);

        // Add Cloudflare metadata
        const cf = request.cf as any;
        const colo = cf?.colo || undefined;
        const enrichedResult: HealthCheckResult & { _debug?: any } = {
          ...result,
          cfRay: request.headers.get('cf-ray') || undefined,
          colo,
          coloCity: getColoCity(colo),
          clientTcpRtt: cf?.clientTcpRtt !== undefined ? Math.round(cf.clientTcpRtt) : undefined,
          resolvedIp: resolvedIp || undefined,
          _debug: {
            httpEnabled: body.httpEnabled,
            tlsEnabled: body.tlsEnabled,
            testType: body.httpEnabled ? 'testHttpPort' : body.tlsEnabled ? 'testTlsPort' : 'testTcpPort',
            rawTcpMs: result.tcpMs,
            rawTlsMs: result.tlsHandshakeMs,
            rawHttpMs: result.httpMs,
          },
        };

        // Cache for /api/results
        cacheResult(enrichedResult);

        return new Response(JSON.stringify(enrichedResult), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: error instanceof Error ? error.message : 'Invalid request'
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          }
        );
      }
    }

    // Batch health checks endpoint
    if (url.pathname === '/api/batch-check' && request.method === 'POST') {
      try {
        const body: { checks: HealthCheckRequest[] } = await request.json();

        if (!Array.isArray(body.checks) || body.checks.length === 0) {
          return new Response(
            JSON.stringify({ error: 'checks must be a non-empty array' }),
            {
              status: 400,
              headers: {
                'Content-Type': 'application/json',
                ...corsHeaders
              }
            }
          );
        }

        // Limit batch size to prevent abuse
        if (body.checks.length > 10) {
          return new Response(
            JSON.stringify({ error: 'Maximum 10 checks per batch' }),
            {
              status: 400,
              headers: {
                'Content-Type': 'application/json',
                ...corsHeaders
              }
            }
          );
        }

        // Validate each check in the batch
        for (const check of body.checks) {
          if (!check.host || !check.port) {
            return new Response(
              JSON.stringify({ error: 'Each check must have host and port' }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
            );
          }
          if (check.port < 1 || check.port > 65535) {
            return new Response(
              JSON.stringify({ error: `Invalid port ${check.port}: must be between 1 and 65535` }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
            );
          }
          const batchBlocked = isBlockedHost(check.host);
          if (batchBlocked) {
            return new Response(
              JSON.stringify({ error: `Blocked host ${check.host}: ${batchBlocked}` }),
              { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
            );
          }
        }

        // Execute all checks in parallel
        const results = await Promise.all(
          body.checks.map(check => check.httpEnabled ? testHttpPort(check) : check.tlsEnabled ? testTlsPort(check) : testTcpPort(check))
        );

        // Cache all batch results
        for (const r of results) cacheResult(r);

        return new Response(JSON.stringify({ results }), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders
          },
        });
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: error instanceof Error ? error.message : 'Invalid request'
          }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders
            }
          }
        );
      }
    }

    // Serve static assets (React app) from the ASSETS binding
    try {
      const assetResponse = await env.ASSETS.fetch(request);
      // Override any platform-injected CSP (e.g. Cloudflare's report-only connect-src 'none')
      // with one that allows the app's legitimate outbound connections.
      const contentType = assetResponse.headers.get('Content-Type') ?? '';
      if (contentType.includes('text/html')) {
        const cspConnectSrc = [
          "'self'",
          'https://*.healthchecks.ross.gg',
          'https://cdn.jsdelivr.net',
          'https://dns.google',
          'https://cloudflare-dns.com',
          'https://one.one.one.one',
        ].join(' ');
        const headers = new Headers(assetResponse.headers);
        headers.set('Content-Security-Policy', `connect-src ${cspConnectSrc}`);
        headers.delete('Content-Security-Policy-Report-Only');
        return new Response(assetResponse.body, { status: assetResponse.status, headers });
      }
      return assetResponse;
    } catch {
      // Fallback if assets aren't available
      return new Response('Global Health Checks Worker - Use /api/check or /api/batch-check', {
        headers: {
          'Content-Type': 'text/plain',
          ...corsHeaders
        },
      });
    }
  },
};
