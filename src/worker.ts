/**
 * Global Health Checks Worker
 * Uses Cloudflare Workers Sockets API to test TCP port connectivity
 * with region hints for geo-distributed testing
 */

// Declare the connect function from Cloudflare Workers Sockets API
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
  region?: string; // Cloudflare region hint (e.g., 'enam', 'weur', 'apac')
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
  colo?: string; // Cloudflare data center code
}

/**
 * Test TCP connectivity to a host:port using Sockets API
 */
async function testTcpPort(
  request: HealthCheckRequest
): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const timeout = request.timeout || 5000;

  try {
    // Connect using Cloudflare Workers Sockets API
    const socket = connect(
      {
        hostname: request.host,
        port: request.port,
      },
      {
        // Securely allow connection (adjust as needed for your use case)
        secureTransport: 'off',
        allowHalfOpen: false,
      }
    );

    // Set up timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout')), timeout);
    });

    // Wait for connection or timeout
    await Promise.race([
      socket.opened,
      timeoutPromise,
    ]);

    const latencyMs = Date.now() - startTime;

    // Close the connection
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
 * Main worker fetch handler
 */
export default {
  async fetch(request: Request, _env: any, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Add CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
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

        const result = await testTcpPort(body);

        // Add Cloudflare metadata
        const enrichedResult: HealthCheckResult = {
          ...result,
          cfRay: request.headers.get('cf-ray') || undefined,
          colo: (request.cf as any)?.colo || undefined,
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
          body.checks.map(check => testTcpPort(check))
        );

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

    // Serve static assets (React app)
    // In production, you'd serve the built React app from dist/
    return new Response('Global Health Checks Worker - Use /api/check or /api/batch-check', {
      headers: {
        'Content-Type': 'text/plain',
        ...corsHeaders
      },
    });
  },
};
