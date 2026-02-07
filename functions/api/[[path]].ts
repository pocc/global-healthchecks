/**
 * Cloudflare Pages Function for API routes
 * Handles /api/* requests using Sockets API
 */

// Type declarations for Cloudflare Workers Sockets API
declare function connect(
  address: { hostname: string; port: number },
  options?: { secureTransport?: string; allowHalfOpen?: boolean }
): {
  opened: Promise<void>;
  close(): Promise<void>;
};

interface HealthCheckRequest {
  host: string;
  port: number;
  timeout?: number;
  region?: string;
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
}

async function testTcpPort(
  request: HealthCheckRequest
): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const timeout = request.timeout || 5000;

  try {
    const socket = connect(
      {
        hostname: request.host,
        port: request.port,
      },
      {
        secureTransport: request.port === 443 ? 'on' : 'off',
      }
    );

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Connection timeout')), timeout)
    );

    await Promise.race([socket.opened, timeoutPromise]);
    await socket.close();

    const latencyMs = Date.now() - startTime;

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
      error: error instanceof Error ? error.message : 'Connection failed',
      timestamp: Date.now(),
    };
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export async function onRequest(context: {
  request: Request;
  env: Record<string, string>;
}): Promise<Response> {
  const { request } = context;
  const url = new URL(request.url);

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Single health check: POST /api/check
  if (url.pathname === '/api/check' && request.method === 'POST') {
    try {
      const body = (await request.json()) as HealthCheckRequest;

      if (!body.host || !body.port) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields: host, port' }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }

      const result = await testTcpPort(body);

      return new Response(JSON.stringify(result), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Invalid request',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }
  }

  // Batch health check: POST /api/batch-check
  if (url.pathname === '/api/batch-check' && request.method === 'POST') {
    try {
      const body = (await request.json()) as { checks: HealthCheckRequest[] };

      if (!body.checks || !Array.isArray(body.checks)) {
        return new Response(
          JSON.stringify({ error: 'Missing required field: checks (array)' }),
          {
            status: 400,
            headers: {
              'Content-Type': 'application/json',
              ...corsHeaders,
            },
          }
        );
      }

      const results = await Promise.all(body.checks.map((check) => testTcpPort(check)));

      return new Response(JSON.stringify({ results }), {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error instanceof Error ? error.message : 'Invalid request',
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        }
      );
    }
  }

  // Unknown API route
  return new Response(
    JSON.stringify({ error: 'Unknown API endpoint' }),
    {
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    }
  );
}
