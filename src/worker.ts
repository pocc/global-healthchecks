/**
 * Global Health Checks Worker
 * Uses Cloudflare Workers Sockets API (cloudflare:sockets) for TCP, TLS, and HTTP checks.
 * STARTTLS approach gives per-phase timing: tcpMs, tlsHandshakeMs, httpMs.
 */

import { connect } from 'cloudflare:sockets';
import { getColoCity, COLO_TO_CITY } from './coloMapping';
import { isBlockedHost } from './utils/ssrf';

interface HealthCheckRequest {
  host: string;
  port: number;
  timeout?: number;
  connectTimeout?: number; // TCP connect timeout (ms)
  retries?: number; // number of retry attempts
  retryBackoff?: boolean; // use exponential backoff
  region?: string;
  tlsEnabled?: boolean;
  tlsServername?: string; // HTTP Host header (defaults to host); SNI is always host
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
  tlsVersion?: string;
  tlsCipher?: string;
  tlsHandshakeMs?: number;
  httpStatusCode?: number;
  httpStatusText?: string;
  httpVersion?: string;
  httpMs?: number; // time to first byte after request sent
  redirectCount?: number;
  redirectUrl?: string; // final redirect destination (if followed)
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


interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
}

/**
 * Main worker fetch handler
 */
export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Add CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Expose-Headers': 'cf-placement, cf-ray',
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
          url: `https://ipwho.is/${encodeURIComponent(ip)}`,
          parse: (d: any) => d.success !== false && d.latitude && d.longitude
            ? { lat: d.latitude, lng: d.longitude, city: d.city, country: d.country }
            : null,
        },
        {
          url: `https://freeipapi.com/api/json/${encodeURIComponent(ip)}`,
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
          _debug: {
            httpEnabled: body.httpEnabled,
            tlsEnabled: body.tlsEnabled,
            testType: body.httpEnabled ? 'testHttpPort' : body.tlsEnabled ? 'testTlsPort' : 'testTcpPort',
            rawTcpMs: result.tcpMs,
            rawTlsMs: result.tlsHandshakeMs,
            rawHttpMs: result.httpMs,
          },
        };

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
          // Target geolocation from the browser (src/utils/targetGeo.ts)
          'https://ipwho.is',
          'https://get.geojs.io',
        ].join(' ');
        const headers = new Headers(assetResponse.headers);
        headers.set('Content-Security-Policy', `connect-src ${cspConnectSrc}`);
        headers.delete('Content-Security-Policy-Report-Only');
        return new Response(assetResponse.body, { status: assetResponse.status, headers });
      }
      return assetResponse;
    } catch {
      // Fallback if assets aren't available
      return new Response('Global Health Checks Worker - Use POST /api/check', {
        headers: {
          'Content-Type': 'text/plain',
          ...corsHeaders
        },
      });
    }
  },
};
