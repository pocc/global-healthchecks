import { test, expect } from '@playwright/test';

/**
 * Monitor the demo (idle) world animation for 50 cycles to verify
 * that ALL regions are spawned every 5 seconds without drift or drops.
 *
 * DEMO_CYCLE_MS = 5000 → 50 iterations ≈ 250 s + startup buffer.
 */

const ITERATIONS = 50;
const CYCLE_MS = 5000; // matches DEMO_CYCLE_MS in WorldMap.tsx
const POLL_INTERVAL = 1000; // check every second
const TOTAL_TIMEOUT = (ITERATIONS + 2) * CYCLE_MS + 30_000; // generous timeout

test.describe('Demo animation – 50 iteration soak test', () => {
  test.setTimeout(TOTAL_TIMEOUT);

  test('spawns all regions every 5s for 50 consecutive cycles', async ({ page }) => {
    // Minimal topojson mock so the map renders
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

    // Home geo
    await page.route('**/api/geo', (route, request) => {
      if (request.url().includes('geo-lookup')) return route.continue();
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ lat: 37.7749, lng: -122.4194, city: 'San Francisco', country: 'US', colo: 'SFO' }),
      });
    });

    // Target geo lookup
    await page.route('**/api/geo-lookup*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ lat: 40.7128, lng: -74.0060, city: 'New York', country: 'US' }),
      });
    });

    // ASN lookups
    await page.route('**/dns.google/resolve*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          Answer: [{ type: 16, data: '"15169 | 8.8.8.0/24 | US | arin | 2023-12-25"' }],
        }),
      });
    });

    // Load page with debug flag – do NOT click Run so demo stays active
    await page.goto('/?hostname=8.8.8.8&port=53&debug');

    // Wait for the first demo batch to fire (up to 10 s)
    await page.waitForFunction(
      () => ((window as any).__animTotalSpawned || 0) > 0,
      { timeout: 15_000 },
    );

    // Read the region count from the first batch
    const firstSpawned: number = await page.evaluate(() => (window as any).__animTotalSpawned || 0);
    const regionCount = firstSpawned; // first batch = 1× all regions
    console.log(`Region count (from first batch): ${regionCount}`);
    expect(regionCount).toBeGreaterThanOrEqual(5); // sanity

    // Now monitor subsequent batches
    interface Sample { ts: number; total: number }
    const samples: Sample[] = [{ ts: Date.now(), total: firstSpawned }];

    // We already saw batch 1. Need 49 more.
    let batchesSeen = 1;
    let prevTotal = firstSpawned;
    const maxWait = Date.now() + (ITERATIONS + 1) * CYCLE_MS + 20_000;

    while (batchesSeen < ITERATIONS && Date.now() < maxWait) {
      await page.waitForTimeout(POLL_INTERVAL);

      const total: number = await page.evaluate(() => (window as any).__animTotalSpawned || 0);
      if (total > prevTotal) {
        const delta = total - prevTotal;
        const now = Date.now();
        const elapsed = now - samples[samples.length - 1].ts;

        samples.push({ ts: now, total });
        batchesSeen++;
        prevTotal = total;

        // Log every batch
        console.log(
          `Batch ${batchesSeen}/${ITERATIONS}: ` +
          `+${delta} spawns (expected ~${regionCount}), ` +
          `interval=${elapsed}ms (expected ~${CYCLE_MS}ms), ` +
          `cumulative=${total}`,
        );

        // Each batch should spawn exactly regionCount packets
        expect(delta).toBe(regionCount);

        // Interval should be ~5s (allow 3–8s for scheduling jitter)
        if (batchesSeen > 1) {
          expect(elapsed).toBeGreaterThanOrEqual(3000);
          expect(elapsed).toBeLessThanOrEqual(8000);
        }
      }
    }

    // Final assertions
    expect(batchesSeen).toBe(ITERATIONS);

    const totalExpected = regionCount * ITERATIONS;
    const finalTotal: number = await page.evaluate(() => (window as any).__animTotalSpawned || 0);
    console.log(`\nFinal: ${finalTotal} total spawns, expected ${totalExpected}`);
    expect(finalTotal).toBe(totalExpected);

    // Check animation loop is still alive
    const animState = await page.evaluate(() => (window as any).__animState || {});
    console.log('Final animState:', animState);
    expect(animState.demoActive).toBe(true);
  });
});
