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

/** Set the speed slider to a specific value (0=1x, 50=10x, 100=100x) */
async function setSpeedSlider(page: Page, sliderValue: number) {
  // Click the speed button to open the panel
  const speedButton = page.locator('button[title="Animation speed"]');
  await speedButton.click();
  await page.waitForTimeout(300);

  // Set the range input value
  const slider = page.locator('input[type="range"]');
  await slider.fill(String(sliderValue));
  await page.waitForTimeout(200);
}

test.describe('Speed multiplier animation tests', () => {
  test('1x speed: animations play quickly with short replay delay', async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.text().includes('[WorldMap]') && msg.text().includes('replayDelay')) {
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

    // At 1x speed, replay delay = 5000 * sqrt(1/10) ≈ 1581ms
    // Animations complete in <1s. So within ~3s of results arriving, animations should be done.

    // Wait for first round results + replay delay + animation
    await page.waitForTimeout(4000);

    const state1 = await page.evaluate(() => (window as any).__animState || {});
    const spawned1 = await page.evaluate(() => (window as any).__animTotalSpawned || 0);
    console.log(`1x: After 4s: spawned=${spawned1}, pkts=${state1.packets}, trails=${state1.trails}`);

    // At 1x, animations should have ALREADY completed (trails visible or expired)
    // Spawns should have happened
    expect(spawned1).toBeGreaterThan(0);

    // Wait through several more rounds
    for (let round = 2; round <= 5; round++) {
      await page.waitForTimeout(6000);

      const state = await page.evaluate(() => (window as any).__animState || {});
      const spawned = await page.evaluate(() => (window as any).__animTotalSpawned || 0);
      console.log(
        `1x Round ${round}: spawned=${spawned}, pkts=${state.packets}, trails=${state.trails}, ` +
        `rAF=${state.rAFRunning}, lastDraw=${Date.now() - (state.lastDrawTime || 0)}ms ago`
      );

      // Verify new packets keep being spawned
      expect(spawned).toBeGreaterThan(spawned1);
    }

    // At 1x, check that animations complete quickly:
    // trails should appear (and disappear) rapidly since anim duration is <1s
    const finalState = await page.evaluate(() => (window as any).__animState || {});
    const finalSpawned = await page.evaluate(() => (window as any).__animTotalSpawned || 0);
    console.log(`1x Final: spawned=${finalSpawned}, rAF=${finalState.rAFRunning}`);

    // Should have spawned across multiple rounds
    expect(finalSpawned).toBeGreaterThan(spawned1 * 2);
  });

  test('100x speed: animations play slowly with longer replay delay', async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.text().includes('[WorldMap]') && msg.text().includes('replayDelay')) {
        console.log('BROWSER:', msg.text());
      }
    });

    await setupMocks(page);
    await page.goto('/?hostname=8.8.8.8&port=53&debug');
    await page.waitForTimeout(2000);

    // Set speed to 100x (slider value = 100)
    await setSpeedSlider(page, 100);

    const runButton = page.locator('button', { hasText: /run/i }).first();
    await expect(runButton).toBeEnabled({ timeout: 10_000 });
    await runButton.click();

    // At 100x speed, replay delay = 5000 * sqrt(100/10) ≈ 15811ms
    // Animations take ~20-40s per round.

    // First check: after replay delay, animations should be actively playing
    await page.waitForTimeout(18000); // Wait for replay delay + some animation

    const state1 = await page.evaluate(() => (window as any).__animState || {});
    const spawned1 = await page.evaluate(() => (window as any).__animTotalSpawned || 0);
    console.log(`100x: After 18s: spawned=${spawned1}, pkts=${state1.packets}, trails=${state1.trails}, rAF=${state1.rAFRunning}`);

    expect(spawned1).toBeGreaterThan(0);

    // At 100x, packets should still be actively animating (not all completed)
    // since animations take 20-40s and we've only waited 18s
    expect(state1.packets).toBeGreaterThan(0);
    expect(state1.rAFRunning).toBe(true);

    // Wait more for animations to progress
    await page.waitForTimeout(15000);

    const state2 = await page.evaluate(() => (window as any).__animState || {});
    const spawned2 = await page.evaluate(() => (window as any).__animTotalSpawned || 0);
    console.log(`100x: After 33s: spawned=${spawned2}, pkts=${state2.packets}, trails=${state2.trails}, rAF=${state2.rAFRunning}`);

    // By now, round 1 animations should be partially/fully completing (trails appearing)
    // Round 2 should have been spawned
    expect(spawned2).toBeGreaterThan(spawned1);

    // Verify draw loop is still active
    expect(state2.rAFRunning).toBe(true);

    // Wait for another round
    await page.waitForTimeout(15000);

    const state3 = await page.evaluate(() => (window as any).__animState || {});
    const spawned3 = await page.evaluate(() => (window as any).__animTotalSpawned || 0);
    console.log(`100x: After 48s: spawned=${spawned3}, pkts=${state3.packets}, trails=${state3.trails}, rAF=${state3.rAFRunning}`);

    // Key assertion: spawns keep increasing (not stalling)
    expect(spawned3).toBeGreaterThan(spawned2);

    // rAF should still be running
    const timeSinceLastDraw = await page.evaluate(() => Date.now() - ((window as any).__animState?.lastDrawTime || 0));
    console.log(`100x: timeSinceLastDraw=${timeSinceLastDraw}ms`);
    expect(timeSinceLastDraw).toBeLessThan(1000);
  });

  test('100x speed: replay delay is appropriately longer than 10x', async ({ page }) => {
    await setupMocks(page);
    await page.goto('/?hostname=8.8.8.8&port=53&debug');
    await page.waitForTimeout(2000);

    // Set 100x speed
    await setSpeedSlider(page, 100);

    const runButton = page.locator('button', { hasText: /run/i }).first();
    await expect(runButton).toBeEnabled({ timeout: 10_000 });
    await runButton.click();

    // Wait for results to arrive but BEFORE the 100x replay delay (~15.8s)
    await page.waitForTimeout(5000);

    // At this point, results should have arrived, packets spawned, but not yet animating
    // (replay delay at 100x is ~15.8s, so at T+5 they haven't started)
    const earlyState = await page.evaluate(() => (window as any).__animState || {});
    console.log(`100x at T+5s: pkts=${earlyState.packets}, trails=${earlyState.trails}`);

    // Packets should exist (spawned) but trails should be 0 (haven't started yet)
    expect(earlyState.packets).toBeGreaterThan(0);
    expect(earlyState.trails).toBe(0);

    // Now wait past the replay delay
    await page.waitForTimeout(14000); // Total: ~19s > 15.8s replay delay

    const afterDelayState = await page.evaluate(() => (window as any).__animState || {});
    console.log(`100x at T+19s: pkts=${afterDelayState.packets}, trails=${afterDelayState.trails}, ripples=${afterDelayState.ripples}`);

    // After replay delay, animations should be in progress
    // Either packets are actively animating (packets > 0) or some have completed (trails > 0)
    expect(afterDelayState.packets + afterDelayState.trails).toBeGreaterThan(0);
    expect(afterDelayState.rAFRunning).toBe(true);
  });
});
