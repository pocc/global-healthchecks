import { test, expect } from '@playwright/test';

const HOME_LOCATION = { lat: 37.7749, lng: -122.4194, city: 'San Francisco', country: 'US', colo: 'SFO' };
const TARGET_LOCATION = { lat: 40.7128, lng: -74.0060, city: 'New York', country: 'US' };
const EXPECTED_REGIONS = 143;

async function setupMocks(page: import('@playwright/test').Page) {
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
}

async function setSpeed100x(page: import('@playwright/test').Page) {
  const speedButton = page.locator('button[title="Animation speed"]');
  await speedButton.click();
  const slider = page.locator('input[type="range"]');
  await slider.fill('100');
}

test.describe('Round transition cleanup', () => {
  test('clears previous round packets before new round responses arrive', async ({ page }) => {
    test.setTimeout(120_000);

    await setupMocks(page);

    let requestCount = 0;

    // Round 1 returns quickly so packets are queued.
    // Round 2 is intentionally delayed so we can verify the clear window.
    await page.route('**/api/check*', (route) => {
      requestCount += 1;
      const round = Math.ceil(requestCount / EXPECTED_REGIONS);
      const delay = round === 2 ? 1200 : 50;

      setTimeout(() => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            latencyMs: 200,
            colo: 'SFO',
            coloCity: 'San Francisco',
            tcpMs: 200,
          }),
        });
      }, delay);
    });

    await page.goto('/?hostname=8.8.8.8&port=53&debug');
    await page.waitForTimeout(2000);
    await setSpeed100x(page);

    const runButton = page.locator('button', { hasText: /run/i }).first();
    await expect(runButton).toBeEnabled({ timeout: 10_000 });
    await runButton.click();

    // Round 1: packets should be queued before replay starts.
    await expect.poll(async () => {
      return page.evaluate(() => (window as any).__animState?.packets || 0);
    }, { timeout: 10_000 }).toBeGreaterThan(50);

    // Wait until round 2 requests have started.
    await expect.poll(() => requestCount, { timeout: 10_000 }).toBeGreaterThan(EXPECTED_REGIONS);

    // On round transition, map should be wiped immediately.
    await expect.poll(async () => {
      const state = await page.evaluate(() => (window as any).__animState || {});
      return (state.packets || 0) + (state.trails || 0) + (state.ripples || 0);
    }, { timeout: 1500 }).toBe(0);

    // Once round 2 responses land, packets should appear again.
    await expect.poll(async () => {
      return page.evaluate(() => (window as any).__animState?.packets || 0);
    }, { timeout: 10_000 }).toBeGreaterThan(50);
  });
});

