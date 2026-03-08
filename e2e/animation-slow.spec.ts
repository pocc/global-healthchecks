import { test, expect } from '@playwright/test';

const HOME_LOCATION = { lat: 37.7749, lng: -122.4194, city: 'San Francisco', country: 'US', colo: 'SFO' };
const TARGET_LOCATION = { lat: 40.7128, lng: -74.0060, city: 'New York', country: 'US' };

/**
 * Test with slow/staggered health check responses to reproduce the animation
 * stop bug. Real-world conditions have:
 * - Variable response times (100ms to 10s+)
 * - Results arriving over a 5-10s window per round
 * - Overlap between rounds (round N+1 starts while round N responses still arriving)
 */
test('animations survive slow staggered responses across many rounds', async ({ page }) => {
  page.on('console', (msg) => {
    if (msg.text().includes('[WorldMap]')) {
      console.log('BROWSER:', msg.text());
    }
  });

  // Mock topojson
  await page.route('**/cdn.jsdelivr.net/**', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        type: 'Topology',
        objects: { land: { type: 'GeometryCollection', geometries: [{ type: 'Polygon', arcs: [[0]] }] } },
        arcs: [[[0, 0], [9999, 0], [0, 9999], [-9999, 0], [0, -9999]]],
        transform: { scale: [0.036003600360036005, 0.017361589674592462], translate: [-180, -89.99892578124998] },
      }),
    });
  });

  await page.route('**/api/geo', (route, request) => {
    if (request.url().includes('geo-lookup')) return route.continue();
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(HOME_LOCATION) });
  });

  await page.route('**/api/geo-lookup*', (route) => {
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TARGET_LOCATION) });
  });

  await page.route('**/dns.google/resolve*', (route) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ Answer: [{ type: 16, data: '"15169 | 8.8.8.0/24 | US | arin | 2023-12-25"' }] }),
    });
  });

  // Mock health checks with SLOW and STAGGERED responses
  // Simulate real-world: some regions fast (100ms), some very slow (3-6s)
  let responseDelay = 0;
  await page.route('**/api/check*', (route) => {
    // Stagger responses: every Nth request is slow
    responseDelay++;
    const delay = responseDelay % 7 === 0 ? 3000 : // Every 7th: 3s delay
                  responseDelay % 5 === 0 ? 2000 : // Every 5th: 2s delay
                  responseDelay % 3 === 0 ? 1000 : // Every 3rd: 1s delay
                  100;                              // Rest: 100ms

    // Latency values vary (affects animation duration)
    const latencyMs = 200 + Math.floor(Math.random() * 800); // 200-1000ms

    setTimeout(() => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          latencyMs,
          colo: 'SFO',
          coloCity: 'San Francisco',
          tcpMs: latencyMs,
          httpMs: latencyMs * 3, // Simulate L7 with higher TTFB
        }),
      });
    }, delay);
  });

  await page.goto('/?hostname=8.8.8.8&port=53&debug');
  await page.waitForTimeout(2000);

  const runButton = page.locator('button', { hasText: /run/i }).first();
  await expect(runButton).toBeEnabled({ timeout: 10_000 });
  await runButton.click();

  // Monitor animation state over 8 rounds (40+ seconds)
  const stateLog: any[] = [];

  for (let i = 0; i < 16; i++) {
    await page.waitForTimeout(5000);

    const state = await page.evaluate(() => {
      const s = (window as any).__animState || {};
      return {
        packets: s.packets || 0,
        trails: s.trails || 0,
        ripples: s.ripples || 0,
        rAFRunning: s.rAFRunning || false,
        totalSpawned: (window as any).__animTotalSpawned || 0,
        lastDrawTime: s.lastDrawTime || 0,
        timeSinceLastDraw: Date.now() - (s.lastDrawTime || 0),
      };
    });

    stateLog.push(state);
    console.log(
      `T+${(i + 1) * 5}s: spawned=${state.totalSpawned}, pkts=${state.packets}, ` +
      `trails=${state.trails}, rAF=${state.rAFRunning}, ` +
      `lastDraw=${state.timeSinceLastDraw}ms ago`
    );
  }

  // Check that animations kept running throughout
  // The key failure mode: totalSpawned stops increasing AND lastDraw becomes stale
  let animationStopDetected = false;
  for (let i = 1; i < stateLog.length; i++) {
    const prev = stateLog[i - 1];
    const curr = stateLog[i];

    // If spawned count didn't increase AND the rAF hasn't run recently
    if (curr.totalSpawned === prev.totalSpawned && curr.timeSinceLastDraw > 3000) {
      animationStopDetected = true;
      console.log(`ANIMATION STOPPED at T+${(i + 1) * 5}s!`);
      console.log('Previous state:', prev);
      console.log('Current state:', curr);
      break;
    }

    // Also check if spawns stopped even if rAF is running
    if (i >= 3 && curr.totalSpawned === stateLog[i - 3].totalSpawned) {
      console.log(`WARNING: No new spawns for 15s at T+${(i + 1) * 5}s`);
    }
  }

  if (animationStopDetected) {
    console.log('BUG REPRODUCED: Animation loop stopped mid-test');
  }

  // Verify total spawns increased across the full run
  const firstSpawned = stateLog[0].totalSpawned;
  const lastSpawned = stateLog[stateLog.length - 1].totalSpawned;
  console.log(`Total: first=${firstSpawned}, last=${lastSpawned}`);
  expect(lastSpawned).toBeGreaterThan(firstSpawned * 2);

  // Verify the draw loop was active recently at the end
  const finalState = stateLog[stateLog.length - 1];
  expect(finalState.timeSinceLastDraw).toBeLessThan(5000);
});
