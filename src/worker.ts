/**
 * Global Health Checks Worker
 * Uses Cloudflare Workers Sockets API to test TCP port connectivity
 * and node:tls for TLS handshake testing with version/cipher controls
 */

import { connect } from 'cloudflare:sockets';
import * as tls from 'node:tls';
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

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout')), connectMs);
    });

    await Promise.race([socket.opened, timeoutPromise]);
    const latencyMs = Date.now() - startTime;
    await socket.close();

    return {
      success: true,
      host: request.host,
      port: request.port,
      region: request.region,
      latencyMs,
      timestamp: Date.now(),
    };
  } catch (error) {
    return {
      success: false,
      host: request.host,
      port: request.port,
      region: request.region,
      latencyMs: Date.now() - startTime,
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
 * Test TLS handshake using node:tls compatibility layer.
 * Reports negotiated TLS version, cipher, and handshake timing.
 */
async function testTlsPort(
  request: HealthCheckRequest
): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const timeout = request.timeout || 5000;

  return new Promise((resolve) => {
    let resolved = false;
    let tcpMs: number | undefined;

    const done = (result: HealthCheckResult) => {
      if (resolved) return;
      resolved = true;
      resolve(result);
    };

    const sni = request.tlsServername || request.host;
    const opts: tls.ConnectionOptions = {
      host: request.host,
      port: request.port,
      ...(request.caBundlePem ? { rejectUnauthorized: true } : {}), // validate only if custom CA provided
      servername: sni,           // SNI
    };

    if (request.minTlsVersion) {
      opts.minVersion = request.minTlsVersion as tls.SecureVersion;
    }
    if (request.maxTlsVersion) {
      opts.maxVersion = request.maxTlsVersion as tls.SecureVersion;
    }
    if (request.ciphers) {
      opts.ciphers = request.ciphers;
    }
    // mTLS: client certificate + key
    if (request.clientCert) {
      opts.cert = request.clientCert;
    }
    if (request.clientKey) {
      opts.key = request.clientKey;
    }
    // Custom trust store
    if (request.caBundlePem) {
      opts.ca = request.caBundlePem;
    }
    const socket = tls.connect(opts, () => {
      const totalMs = Date.now() - startTime;
      const tlsHandshakeMs = tcpMs !== undefined ? totalMs - tcpMs : totalMs;

      // Certificate pinning check
      if (request.pinnedPublicKey) {
        try {
          const cert = socket.getPeerCertificate();
          if (cert?.fingerprint256) {
            const serverPin = `sha256//${cert.fingerprint256.replace(/:/g, '')}`;
            if (serverPin !== request.pinnedPublicKey) {
              done({
                success: false,
                host: request.host,
                port: request.port,
                region: request.region,
                latencyMs: totalMs,
                error: `Certificate pin mismatch: expected ${request.pinnedPublicKey}, got ${serverPin}`,
                timestamp: Date.now(),
                tcpMs,
                tlsVersion: socket.getProtocol() || undefined,
                tlsCipher: socket.getCipher()?.name || undefined,
                tlsHandshakeMs,
              });
              socket.destroy();
              return;
            }
          }
        } catch {
          // pinning check failed -continue anyway
        }
      }

      done({
        success: true,
        host: request.host,
        port: request.port,
        region: request.region,
        latencyMs: totalMs,
        timestamp: Date.now(),
        tcpMs,
        tlsVersion: socket.getProtocol() || undefined,
        tlsCipher: socket.getCipher()?.name || undefined,
        tlsHandshakeMs,
      });
      socket.destroy();
    });

    socket.on('connect', () => {
      tcpMs = Date.now() - startTime;
    });

    socket.on('error', (error: Error) => {
      done({
        success: false,
        host: request.host,
        port: request.port,
        region: request.region,
        latencyMs: Date.now() - startTime,
        error: error.message,
        timestamp: Date.now(),
      });
      socket.destroy();
    });

    setTimeout(() => {
      done({
        success: false,
        host: request.host,
        port: request.port,
        region: request.region,
        latencyMs: Date.now() - startTime,
        error: 'Connection timeout',
        timestamp: Date.now(),
      });
      socket.destroy();
    }, timeout);
  });
}

/**
 * Test full HTTPS request over node:tls with per-phase timing.
 * Establishes TLS connection, sends HTTP request manually,
 * reports TCP, TLS, and HTTP TTFB timings separately.
 * Optionally follows 3xx redirects up to maxRedirects.
 */
async function testHttpPort(
  request: HealthCheckRequest,
  redirectCount = 0
): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const timeout = request.timeout || 5000;

  return new Promise((resolve) => {
    let resolved = false;
    let tcpMs: number | undefined;
    let tlsMs: number | undefined;
    let httpSentAt: number | undefined;

    const done = (result: HealthCheckResult) => {
      if (resolved) return;
      resolved = true;
      resolve(result);
    };

    const sni = request.tlsServername || request.host;
    const opts: tls.ConnectionOptions = {
      host: request.host,
      port: request.port,
      ...(request.caBundlePem ? { rejectUnauthorized: true } : {}), // validate only if custom CA provided
      servername: sni,
    };

    if (request.minTlsVersion) {
      opts.minVersion = request.minTlsVersion as tls.SecureVersion;
    }
    if (request.maxTlsVersion) {
      opts.maxVersion = request.maxTlsVersion as tls.SecureVersion;
    }
    if (request.ciphers) {
      opts.ciphers = request.ciphers;
    }
    if (request.clientCert) {
      opts.cert = request.clientCert;
    }
    if (request.clientKey) {
      opts.key = request.clientKey;
    }
    if (request.caBundlePem) {
      opts.ca = request.caBundlePem;
    }

    const socket = tls.connect(opts, () => {
      const now = Date.now();
      tlsMs = tcpMs !== undefined ? now - startTime - tcpMs : now - startTime;

      // Certificate pinning check
      if (request.pinnedPublicKey) {
        try {
          const cert = socket.getPeerCertificate();
          if (cert?.fingerprint256) {
            const serverPin = `sha256//${cert.fingerprint256.replace(/:/g, '')}`;
            if (serverPin !== request.pinnedPublicKey) {
              done({
                success: false,
                host: request.host,
                port: request.port,
                region: request.region,
                latencyMs: now - startTime,
                error: `Certificate pin mismatch: expected ${request.pinnedPublicKey}, got ${serverPin}`,
                timestamp: Date.now(),
                tcpMs,
                tlsVersion: socket.getProtocol() || undefined,
                tlsCipher: socket.getCipher()?.name || undefined,
                tlsHandshakeMs: tlsMs,
              });
              socket.destroy();
              return;
            }
          }
        } catch {
          // pinning check failed -continue anyway
        }
      }

      // Build and send HTTP request -use SNI for Host header too
      const method = request.httpMethod || 'HEAD';
      const path = request.httpPath || '/';
      const lines = [
        `${method} ${path} HTTP/1.1`,
        `Host: ${sni}`,
      ];
      if (request.httpHeaders) {
        for (const [key, value] of Object.entries(request.httpHeaders)) {
          lines.push(`${key}: ${value}`);
        }
      }
      lines.push('Connection: close', '', '');

      httpSentAt = Date.now();
      socket.write(lines.join('\r\n'));
    });

    socket.on('connect', () => {
      tcpMs = Date.now() - startTime;
    });

    let firstData = true;
    socket.on('data', (chunk: Buffer) => {
      if (!firstData) return;
      firstData = false;

      const httpMs = httpSentAt ? Date.now() - httpSentAt : undefined;
      const responseStart = chunk.toString('utf-8', 0, Math.min(chunk.length, 2048));

      // Parse "HTTP/1.1 200 OK"
      const statusMatch = responseStart.match(/^(HTTP\/[\d.]+)\s+(\d{3})\s*(.*)/);
      const httpVersion = statusMatch?.[1] || undefined;
      const statusCode = statusMatch ? parseInt(statusMatch[2]) : undefined;
      const statusText = statusMatch?.[3]?.trim() || undefined;

      // Follow 3xx redirects if enabled
      const maxRedir = request.maxRedirects ?? 5;
      if (request.followRedirects && statusCode && statusCode >= 300 && statusCode < 400 && redirectCount < maxRedir) {
        const locationMatch = responseStart.match(/\r\nLocation:\s*(\S+)/i);
        if (locationMatch) {
          socket.destroy();
          const location = locationMatch[1];
          try {
            // Resolve Location (may be relative or absolute)
            const base = `https://${sni}:${request.port}${request.httpPath || '/'}`;
            const redirectUrl = new URL(location, base);
            const redirectHost = redirectUrl.hostname;
            const redirectPort = parseInt(redirectUrl.port) || (redirectUrl.protocol === 'https:' ? 443 : 80);
            const redirectPath = redirectUrl.pathname + redirectUrl.search;

            testHttpPort({
              ...request,
              host: redirectHost,
              port: redirectPort,
              httpPath: redirectPath,
              tlsServername: redirectHost,
            }, redirectCount + 1).then((result) => {
              done({
                ...result,
                // Preserve original request's host/port for reporting
                host: request.host,
                port: request.port,
                redirectCount: redirectCount + 1,
                redirectUrl: redirectUrl.href,
              });
            });
          } catch {
            // Bad Location URL -report as-is
            done({
              success: false,
              host: request.host,
              port: request.port,
              region: request.region,
              latencyMs: Date.now() - startTime,
              error: `Bad redirect URL: ${location}`,
              timestamp: Date.now(),
              tcpMs,
              redirectCount,
            });
          }
          return;
        }
      }

      done({
        success: statusCode !== undefined && statusCode < 500,
        host: request.host,
        port: request.port,
        region: request.region,
        latencyMs: Date.now() - startTime,
        timestamp: Date.now(),
        tcpMs,
        tlsVersion: socket.getProtocol() || undefined,
        tlsCipher: socket.getCipher()?.name || undefined,
        tlsHandshakeMs: tlsMs,
        httpMs,
        httpStatusCode: statusCode,
        httpStatusText: statusText,
        httpVersion,
        ...(redirectCount > 0 && { redirectCount }),
      });
      socket.destroy();
    });

    socket.on('error', (error: Error) => {
      done({
        success: false,
        host: request.host,
        port: request.port,
        region: request.region,
        latencyMs: Date.now() - startTime,
        error: error.message,
        timestamp: Date.now(),
        tcpMs,
        ...(redirectCount > 0 && { redirectCount }),
      });
      socket.destroy();
    });

    setTimeout(() => {
      done({
        success: false,
        host: request.host,
        port: request.port,
        region: request.region,
        latencyMs: Date.now() - startTime,
        error: 'Connection timeout',
        timestamp: Date.now(),
        tcpMs,
        ...(redirectCount > 0 && { redirectCount }),
      });
      socket.destroy();
    }, timeout);
  });
}

interface Env {
  API_SECRET: string;
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

    // Authenticate API requests (all /api/ routes except CORS preflight and /api/geo)
    if (url.pathname.startsWith('/api/') && url.pathname !== '/api/geo' && url.pathname !== '/api/datacenters') {
      const secret = url.searchParams.get('secret');
      if (!env.API_SECRET || secret !== env.API_SECRET) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized: invalid or missing secret parameter' }),
          {
            status: 401,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }
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

        const result = body.httpEnabled
          ? await testHttpPort(body)
          : body.tlsEnabled
            ? await testTlsPort(body)
            : await testTcpPort(body);

        // Add Cloudflare metadata
        const colo = (request.cf as any)?.colo || undefined;
        const enrichedResult: HealthCheckResult = {
          ...result,
          cfRay: request.headers.get('cf-ray') || undefined,
          colo,
          coloCity: getColoCity(colo),
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
      return await env.ASSETS.fetch(request);
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
