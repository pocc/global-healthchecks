import { test, expect, Page } from '@playwright/test';

const HOME_LOCATION = { lat: 37.7749, lng: -122.4194, city: 'San Francisco', country: 'US', colo: 'SFO' };
const TARGET_LOCATION = { lat: 40.7128, lng: -74.0060, city: 'New York', country: 'US' };

/** Set up common route mocks for all tests */
async function setupMocks(page: Page) {
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

  // Health checks: respond with varying latency
  await page.route('**/api/check*', (route) => {
    const latencyMs = 100 + Math.floor(Math.random() * 400); // 100-500ms
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
          httpMs: latencyMs * 2,
        }),
      });
    }, 50);
  });
}

/** Set the speed slider to a specific value (0=1x, 50=~3.2x, 100=10x) */
async function setSpeedSlider(page: Page, sliderValue: number) {
  const speedButton = page.locator('button[title="Animation speed"]');
  await speedButton.click();
  await page.waitForTimeout(300);

  const slider = page.locator('input[type="range"]');
  await slider.fill(String(sliderValue));
  await page.waitForTimeout(200);
}

test.describe('Speed multiplier animation tests', () => {
  test('1x speed: animations play quickly', async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.text().includes('[WorldMap]')) {
        console.log('BROWSER:', msg.text());
      }
    });

    await setupMocks(page);
    await page.goto('/?hostname=8.8.8.8&port=53&debug');
    await page.waitForTimeout(2000);

    // Set speed to 1x (slider value = 0)
    await setSpeedSlider(page, 0);

    const runButton = page.locator('button', { hasText: /run/i }).first();
    await expect(runButton).toBeEnabled({ timeout: 10_000 });
    await runButton.click();

    // At 1x, animations complete in <1s (e.g. 200ms ping → sqrt(200)*10*1 = 141ms)
    await page.waitForTimeout(4000);

    const state1 = await page.evaluate(() => (window as any).__animState || {});
    const spawned1 = await page.evaluate(() => (window as any).__animTotalSpawned || 0);
    console.log(`1x: After 4s: spawned=${spawned1}, pkts=${state1.packets}, trails=${state1.trails}`);

    expect(spawned1).toBeGreaterThan(0);

    // Wait through several more rounds
    for (let round = 2; round <= 5; round++) {
      await page.waitForTimeout(6000);

      const state = await page.evaluate(() => (window as any).__animState || {});
      const spawned = await page.evaluate(() => (window as any).__animTotalSpawned || 0);
      console.log(
        `1x Round ${round}: spawned=${spawned}, pkts=${state.packets}, trails=${state.trails}, ` +
        `rAF=${state.rAFRunning}, lastDraw=${Date.now() - (state.lastDrawTime || 0)}ms ago`,
      );

      expect(spawned).toBeGreaterThan(spawned1);
    }

    const finalSpawned = await page.evaluate(() => (window as any).__animTotalSpawned || 0);
    expect(finalSpawned).toBeGreaterThan(spawned1 * 2);
  });

  test('10x speed (max): animations complete within round interval', async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.text().includes('[WorldMap]')) {
        console.log('BROWSER:', msg.text());
      }
    });

    await setupMocks(page);
    await page.goto('/?hostname=8.8.8.8&port=53&debug');
    await page.waitForTimeout(2000);

    // Set speed to 10x (slider value = 100, max)
    await setSpeedSlider(page, 100);

    const runButton = page.locator('button', { hasText: /run/i }).first();
    await expect(runButton).toBeEnabled({ timeout: 10_000 });
    await runButton.click();

    // At 10x, animations take ~1-3s (e.g. 200ms ping → sqrt(200)*10*10 = 1,414ms)
    // This fits comfortably within the 5s round interval.
    await page.waitForTimeout(6000);

    const state1 = await page.evaluate(() => (window as any).__animState || {});
    const spawned1 = await page.evaluate(() => (window as any).__animTotalSpawned || 0);
    console.log(`10x: After 6s: spawned=${spawned1}, pkts=${state1.packets}, trails=${state1.trails}, rAF=${state1.rAFRunning}`);

    expect(spawned1).toBeGreaterThan(0);
    expect(state1.rAFRunning).toBe(true);

    // Wait for more rounds
    await page.waitForTimeout(12000);

    const state2 = await page.evaluate(() => (window as any).__animState || {});
    const spawned2 = await page.evaluate(() => (window as any).__animTotalSpawned || 0);
    console.log(`10x: After 18s: spawned=${spawned2}, pkts=${state2.packets}, trails=${state2.trails}, rAF=${state2.rAFRunning}`);

    // Spawns should keep increasing across rounds
    expect(spawned2).toBeGreaterThan(spawned1);
    expect(state2.rAFRunning).toBe(true);

    // At 10x, max animation is ~3.2s for a 1000ms ping. With 5s rounds,
    // animations should complete before cleanup at 4.8s — verify no packet overflow.
    const roundSpawnLog: Record<string, number> = await page.evaluate(
      () => (window as any).__roundSpawnLog || {},
    );
    const rounds = Object.keys(roundSpawnLog).map(Number).sort((a, b) => a - b);
    console.log('10x per-round spawns:', rounds.map(rn => `R${rn}:${roundSpawnLog[rn]}`).join(', '));

    // Each round should have close to 143 spawns
    for (const rn of rounds.slice(0, -1)) { // exclude last (may be incomplete)
      expect(roundSpawnLog[rn], `Round ${rn} spawn count`).toBeGreaterThan(100);
    }

    // rAF should still be running
    const timeSinceLastDraw = await page.evaluate(() => Date.now() - ((window as any).__animState?.lastDrawTime || 0));
    expect(timeSinceLastDraw).toBeLessThan(1000);
  });

  test('mid-range (~3.2x): animations play at moderate speed', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/?hostname=8.8.8.8&port=53&debug');
    await page.waitForTimeout(2000);

    // Set speed to ~3.2x (slider value = 50, midpoint)
    await setSpeedSlider(page, 50);

    const runButton = page.locator('button', { hasText: /run/i }).first();
    await expect(runButton).toBeEnabled({ timeout: 10_000 });
    await runButton.click();

    // At ~3.2x, 200ms ping → sqrt(200)*10*3.16 = 446ms animation
    // Very comfortable within 5s round interval
    await page.waitForTimeout(8000);

    const spawned = await page.evaluate(() => (window as any).__animTotalSpawned || 0);
    const state = await page.evaluate(() => (window as any).__animState || {});
    console.log(`~3.2x: spawned=${spawned}, pkts=${state.packets}, trails=${state.trails}, rAF=${state.rAFRunning}`);

    expect(spawned).toBeGreaterThan(0);
    expect(state.rAFRunning).toBe(true);
  });
});
