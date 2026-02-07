import { http, HttpResponse } from 'msw';

// Mock API handlers
export const handlers = [
  // Mock successful health check
  http.post('/api/check', async ({ request }) => {
    const body = await request.json() as { host: string; port: number; timeout?: number };

    return HttpResponse.json({
      success: true,
      host: body.host,
      port: body.port,
      latencyMs: 45,
      timestamp: Date.now(),
      cfRay: 'mock-ray-123',
      colo: 'SFO',
    });
  }),

  // Mock failed health check
  http.post('/api/check-fail', async ({ request }) => {
    const body = await request.json() as { host: string; port: number };

    return HttpResponse.json({
      success: false,
      host: body.host,
      port: body.port,
      latencyMs: 5000,
      error: 'Connection timeout',
      timestamp: Date.now(),
    });
  }),

  // Mock batch checks
  http.post('/api/batch-check', async () => {
    return HttpResponse.json({
      results: [
        {
          success: true,
          host: 'example.com',
          port: 80,
          latencyMs: 30,
          timestamp: Date.now(),
        },
        {
          success: true,
          host: 'example.com',
          port: 443,
          latencyMs: 35,
          timestamp: Date.now(),
        },
      ],
    });
  }),
];
