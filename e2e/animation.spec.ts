import { test, expect } from '@playwright/test';

// Mock data
const HOME_LOCATION = { lat: 37.7749, lng: -122.4194, city: 'San Francisco', country: 'US', colo: 'SFO' };
const TARGET_LOCATION = { lat: 40.7128, lng: -74.0060, city: 'New York', country: 'US' };

// A handful of region codes (enough to reproduce but not 143)
const TEST_REGIONS = ['us', 'eu', 'jp', 'au', 'ca'];

test.describe('WorldMap ping animations', () => {
  test('animations continue after multiple ping rounds', async ({ page }) => {
    // Collect console logs for debugging
    const consoleLogs: string[] = [];
    page.on('console', (msg) => {
      if (msg.text().includes('[WorldMap]') || msg.text().includes('__anim')) {
        consoleLogs.push(msg.text());
      }
    });

    // Mock the world atlas topojson (provide a minimal valid topojson)
    await page.route('**/cdn.jsdelivr.net/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          type: 'Topology',
          objects: {
            land: {
              type: 'GeometryCollection',
              geometries: [{ type: 'Polygon', arcs: [[0]] }],
            },
          },
          arcs: [[[0, 0], [9999, 0], [0, 9999], [-9999, 0], [0, -9999]]],
          transform: { scale: [0.036003600360036005, 0.017361589674592462], translate: [-180, -89.99892578124998] },
        }),
      });
    });

    // Mock home geo endpoint
    await page.route('**/api/geo', (route, request) => {
      if (request.url().includes('geo-lookup')) return route.continue();
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(HOME_LOCATION),
      });
    });

    // Mock target geo lookup
    await page.route('**/api/geo-lookup*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(TARGET_LOCATION),
      });
    });

    // Mock ASN lookups via dns.google
    await page.route('**/dns.google/resolve*', (route) => {
      const url = new URL(route.request().url());
      const name = url.searchParams.get('name') || '';

      if (name.includes('origin.asn.cymru.com') || name.includes('origin6.asn.cymru.com')) {
        // Return Google's ASN (not Cloudflare)
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            Answer: [{ type: 16, data: '"15169 | 8.8.8.0/24 | US | arin | 2023-12-25"' }],
          }),
        });
      } else if (name.includes('.asn.cymru.com')) {
        // ASN name lookup
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            Answer: [{ type: 16, data: '"15169 | US | arin | 2000-03-30 | GOOGLE, US"' }],
          }),
        });
      } else {
        route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      }
    });

    // Track health check round count
    let checkCallCount = 0;

    // Mock health check endpoints (both localhost and regional)
    await page.route('**/api/check*', (route) => {
      checkCallCount++;
      // Simulate varying latency (50-200ms)
      const latencyMs = 50 + Math.floor(Math.random() * 150);
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
          }),
        });
      }, 50); // Small delay to simulate network
    });

    // Navigate with IP host (skips DNS resolution complexity)
    await page.goto('/?hostname=8.8.8.8&port=53&debug');

    // Wait for the page to load and validation to complete
    await page.waitForTimeout(2000);

    // Verify the Run button is enabled (validation passed)
    const runButton = page.locator('button', { hasText: /run/i }).first();
    await expect(runButton).toBeEnabled({ timeout: 10_000 });

    // Click Run to start the test
    await runButton.click();

    // Wait for the first round of health checks
    await page.waitForTimeout(2000);

    // Get initial spawn count
    const initialSpawned = await page.evaluate(() => (window as any).__animTotalSpawned || 0);
    console.log(`After first round: totalSpawned=${initialSpawned}`);
    expect(initialSpawned).toBeGreaterThan(0);

    // Track spawn counts across multiple rounds
    const roundSpawnCounts: number[] = [initialSpawned];

    // Wait for several more rounds (5s interval each)
    for (let round = 2; round <= 6; round++) {
      await page.waitForTimeout(6000); // 5s interval + 1s buffer

      const spawned = await page.evaluate(() => (window as any).__animTotalSpawned || 0);
      const animState = await page.evaluate(() => (window as any).__animState || {});

      console.log(
        `Round ${round}: totalSpawned=${spawned}, ` +
        `packets=${animState.packets}, trails=${animState.trails}, ` +
        `ripples=${animState.ripples}, rAFRunning=${animState.rAFRunning}, ` +
        `checkCalls=${checkCallCount}`
      );

      roundSpawnCounts.push(spawned);

      // Verify new packets were spawned this round
      const prevSpawned = roundSpawnCounts[round - 2];
      const newSpawns = spawned - prevSpawned;
      expect(newSpawns).toBeGreaterThan(0);
    }

    // Verify that animations are still being drawn (rAF running or recently ran)
    const finalState = await page.evaluate(() => {
      const state = (window as any).__animState || {};
      return {
        ...state,
        totalSpawned: (window as any).__animTotalSpawned || 0,
      };
    });

    console.log('Final animation state:', finalState);
    console.log('Spawn counts per round:', roundSpawnCounts);

    // Total spawns should be roughly proportional to number of rounds × regions
    expect(finalState.totalSpawned).toBeGreaterThan(initialSpawned * 3);
  });

  test('rAF loop restarts after stopping between rounds', async ({ page }) => {
    // This test checks the specific scenario where the animation loop stops
    // between rounds and verifies it properly restarts when new results arrive

    // Setup same mocks as above
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
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(HOME_LOCATION),
      });
    });

    await page.route('**/api/geo-lookup*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(TARGET_LOCATION),
      });
    });

    await page.route('**/dns.google/resolve*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          Answer: [{ type: 16, data: '"15169 | 8.8.8.0/24 | US | arin | 2023-12-25"' }],
        }),
      });
    });

    await page.route('**/api/check*', (route) => {
      const latencyMs = 80;
      setTimeout(() => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, latencyMs, colo: 'SFO', coloCity: 'San Francisco', tcpMs: latencyMs }),
        });
      }, 30);
    });

    await page.goto('/?hostname=8.8.8.8&port=53&debug');
    await page.waitForTimeout(2000);

    const runButton = page.locator('button', { hasText: /run/i }).first();
    await expect(runButton).toBeEnabled({ timeout: 10_000 });
    await runButton.click();

    // Wait for round 1 animations to fully complete (including trail fade)
    // Round 1 results arrive ~0-2s, animations start at +5s, last ~1s, trails fade in ~1.6s
    // Total: ~8.6s for all animations from round 1 to complete
    await page.waitForTimeout(9000);

    // Check that the rAF loop stopped (all animations from round 1 should be done)
    const stateAfterRound1 = await page.evaluate(() => (window as any).__animState || {});
    console.log('State after round 1 animations complete:', stateAfterRound1);

    // By now round 2 should have started and spawned packets
    // The rAF loop should be running (either from round 2 packets or restarted by effect)
    const spawned = await page.evaluate(() => (window as any).__animTotalSpawned || 0);
    console.log('Total spawned after ~9s:', spawned);

    // Wait for round 3
    await page.waitForTimeout(6000);

    const spawnedAfterRound3 = await page.evaluate(() => (window as any).__animTotalSpawned || 0);
    console.log('Total spawned after round 3:', spawnedAfterRound3);

    // Verify spawns keep increasing
    expect(spawnedAfterRound3).toBeGreaterThan(spawned);

    // Check that draw is still being called recently
    const finalState = await page.evaluate(() => {
      const state = (window as any).__animState || {};
      return {
        ...state,
        timeSinceLastDraw: Date.now() - (state.lastDrawTime || 0),
      };
    });
    console.log('Final state:', finalState);

    // If the rAF loop is working, lastDrawTime should be very recent
    // Allow up to 3s grace period (trail fade + gap between rounds)
    // If animations stopped, lastDrawTime would be from round 1 (~9s ago)
    expect(finalState.timeSinceLastDraw).toBeLessThan(5000);
  });
});
