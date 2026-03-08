import { test, expect } from '@playwright/test';

/**
 * Validates ping batch timing behavior:
 * 1. Requests fire in clean batches of 143 every 5 seconds
 * 2. Every request produces exactly one animation spawn (no lost/duplicate spawns)
 * 3. Per-round animation counts are close to 143 (small variance from late responses is OK)
 * 4. No extreme straggler batches (the "10 of 143" bug)
 *
 * Uses window.__roundSpawnLog[roundNumber] exposed by WorldMap in debug mode.
 */

const HOME_LOCATION = { lat: 37.7749, lng: -122.4194, city: 'San Francisco', country: 'US', colo: 'SFO' };
const TARGET_LOCATION = { lat: 40.7128, lng: -74.0060, city: 'New York', country: 'US' };

const EXPECTED_REGIONS = 143;
const ROUND_INTERVAL_MS = 5000;

function setupCommonMocks(page: import('@playwright/test').Page) {
  return Promise.all([
    page.route('**/cdn.jsdelivr.net/**', (route) => {
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
    }),
    page.route('**/api/geo', (route, request) => {
      if (request.url().includes('geo-lookup')) return route.continue();
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(HOME_LOCATION),
      });
    }),
    page.route('**/api/geo-lookup*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(TARGET_LOCATION),
      });
    }),
    page.route('**/dns.google/resolve*', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          Answer: [{ type: 16, data: '"15169 | 8.8.8.0/24 | US | arin | 2023-12-25"' }],
        }),
      });
    }),
  ]);
}

test.describe('Ping batch timing validation', () => {
  test('100+ pings: clean batches, no straggler animations', async ({ page }) => {
    test.setTimeout(300_000);

    await setupCommonMocks(page);

    const requestTimestamps: number[] = [];

    // Simulate realistic latency with some very slow responses that
    // cross the 5-second round boundary
    await page.route('**/api/check*', (route) => {
      requestTimestamps.push(Date.now());

      const rand = Math.random();
      let delay: number;
      if (rand < 0.85) {
        delay = 30 + Math.floor(Math.random() * 170);       // 85%: 30-200ms
      } else if (rand < 0.93) {
        delay = 200 + Math.floor(Math.random() * 1800);     // 8%: 200-2000ms
      } else {
        delay = 3500 + Math.floor(Math.random() * 2000);    // 7%: 3500-5500ms
      }

      setTimeout(() => {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            latencyMs: delay,
            colo: 'SFO',
            coloCity: 'San Francisco',
            tcpMs: delay,
          }),
        });
      }, delay);
    });

    await page.goto('/?hostname=8.8.8.8&port=53&debug');
    await page.waitForTimeout(2000);

    const runButton = page.locator('button', { hasText: /run/i }).first();
    await expect(runButton).toBeEnabled({ timeout: 10_000 });

    const testStartTime = Date.now();
    await runButton.click();

    // Run 15 rounds. Wait = 14 intervals + 8s buffer for slow final responses.
    const TARGET_ROUNDS = 15;
    const waitMs = (TARGET_ROUNDS - 1) * ROUND_INTERVAL_MS + 8000;
    console.log(`Waiting ${waitMs}ms for ${TARGET_ROUNDS} rounds with realistic latency...`);
    await page.waitForTimeout(waitMs);

    const stopButton = page.locator('button', { hasText: /stop/i }).first();
    await stopButton.click();

    // Extra wait for any stragglers
    await page.waitForTimeout(6000);

    // ═══════════════════════════════════════════════════════════
    // Collect data
    // ═══════════════════════════════════════════════════════════

    const roundSpawnLog: Record<string, number> = await page.evaluate(
      () => (window as any).__roundSpawnLog || {}
    );
    const totalSpawned: number = await page.evaluate(
      () => (window as any).__animTotalSpawned || 0
    );

    // ═══════════════════════════════════════════════════════════
    // REQUEST-SIDE ANALYSIS
    // ═══════════════════════════════════════════════════════════

    requestTimestamps.sort((a, b) => a - b);
    const GAP_THRESHOLD = 2000;
    const requestRounds: { start: number; count: number }[] = [];
    let curRound = { start: requestTimestamps[0], count: 1 };
    for (let i = 1; i < requestTimestamps.length; i++) {
      if (requestTimestamps[i] - requestTimestamps[i - 1] > GAP_THRESHOLD) {
        requestRounds.push(curRound);
        curRound = { start: requestTimestamps[i], count: 1 };
      } else {
        curRound.count++;
      }
    }
    requestRounds.push(curRound);

    console.log(`\n${'═'.repeat(70)}`);
    console.log('REQUEST-SIDE ANALYSIS');
    console.log(`${'═'.repeat(70)}`);
    console.log(`Total requests: ${requestTimestamps.length} | Rounds: ${requestRounds.length}`);
    requestRounds.forEach((r, i) => {
      const rel = r.start - testStartTime;
      console.log(`  Round ${i + 1}: ${r.count} requests @ +${rel}ms`);
    });

    // Inter-round gap analysis
    console.log('\nInter-round gaps:');
    for (let i = 1; i < requestRounds.length; i++) {
      const gap = requestRounds[i].start - requestRounds[i - 1].start;
      console.log(`  ${i}→${i + 1}: ${gap}ms (drift: ${gap - ROUND_INTERVAL_MS}ms)`);
    }

    // ═══════════════════════════════════════════════════════════
    // ANIMATION SPAWN ANALYSIS
    // ═══════════════════════════════════════════════════════════

    const roundNumbers = Object.keys(roundSpawnLog).map(Number).sort((a, b) => a - b);
    const spawnTotal = roundNumbers.reduce((sum, rn) => sum + roundSpawnLog[rn], 0);

    console.log(`\n${'═'.repeat(70)}`);
    console.log('ANIMATION SPAWN LOG (per round)');
    console.log(`${'═'.repeat(70)}`);
    console.log(`Total spawned: ${totalSpawned} (log sum: ${spawnTotal}) | Rounds: ${roundNumbers.length}`);

    let maxDelta = 0;
    let hasExtremeStraggler = false;

    roundNumbers.forEach(rn => {
      const count = roundSpawnLog[rn];
      const delta = count - EXPECTED_REGIONS;
      if (Math.abs(delta) > maxDelta) maxDelta = Math.abs(delta);
      // A round with < 50% of expected is an extreme straggler (the bug)
      if (count < EXPECTED_REGIONS * 0.5) hasExtremeStraggler = true;
      const status = Math.abs(delta) <= 10 ? 'OK' : (count < EXPECTED_REGIONS * 0.5 ? 'STRAGGLER' : 'WARN');
      console.log(`  Round ${rn}: ${count} spawns (${delta >= 0 ? '+' : ''}${delta}) [${status}]`);
    });

    console.log(`\nMax per-round delta: ±${maxDelta}`);
    console.log(`Total spawns: ${spawnTotal} | Expected: ${requestTimestamps.length}`);

    console.log(`\n${'═'.repeat(70)}`);
    console.log(hasExtremeStraggler ? 'RESULT: EXTREME STRAGGLER DETECTED (BUG)' :
      maxDelta <= 10 ? 'RESULT: ALL CLEAN' : 'RESULT: HIGH VARIANCE');
    console.log(`${'═'.repeat(70)}\n`);

    // ═══════════════════════════════════════════════════════════
    // ASSERTIONS
    // ═══════════════════════════════════════════════════════════

    // 1. Request side: exactly 143 per round, ~5s intervals
    for (const r of requestRounds) {
      expect(r.count, 'Request round should have 143 pings').toBe(EXPECTED_REGIONS);
    }
    for (let i = 1; i < requestRounds.length; i++) {
      const gap = requestRounds[i].start - requestRounds[i - 1].start;
      expect(gap, `Inter-round gap ${gap}ms`).toBeGreaterThan(4500);
      expect(gap, `Inter-round gap ${gap}ms`).toBeLessThan(5500);
    }

    // 2. Total spawns must equal total requests (no lost/duplicate animations)
    //    Allow small tolerance for the last round where some responses may not
    //    have arrived before we stopped
    expect(spawnTotal, 'Total spawns should roughly match total requests')
      .toBeGreaterThanOrEqual(requestTimestamps.length - EXPECTED_REGIONS);
    expect(spawnTotal, 'No duplicate spawns')
      .toBeLessThanOrEqual(requestTimestamps.length);

    // 3. No extreme straggler batches (the "10 of 143" bug)
    //    Every round must have at least 50% of expected spawns
    expect(hasExtremeStraggler, 'No extreme straggler rounds').toBe(false);

    // 4. Per-round variance should be small (±10 max for non-last rounds)
    //    Late responses from round N get attributed to round N+1,
    //    which is correct visual behavior (they animate with the next batch).
    //    The last round is excluded because stopping the test mid-round
    //    naturally causes missing responses.
    const nonLastRounds = roundNumbers.slice(0, -1);
    let maxDeltaNonLast = 0;
    for (const rn of nonLastRounds) {
      const delta = Math.abs(roundSpawnLog[rn] - EXPECTED_REGIONS);
      if (delta > maxDeltaNonLast) maxDeltaNonLast = delta;
    }
    console.log(`Max per-round delta (excluding last): ±${maxDeltaNonLast}`);
    expect(maxDeltaNonLast, `Max per-round delta ±${maxDeltaNonLast} should be ≤ 10`).toBeLessThanOrEqual(10);

    // 5. Observed enough rounds
    expect(roundNumbers.length).toBeGreaterThanOrEqual(TARGET_ROUNDS - 2);
  });
});
