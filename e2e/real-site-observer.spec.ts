import { test, expect } from '@playwright/test';

/**
 * Observes the REAL production website (no mocking, no dev server)
 * to detect timing anomalies in ping batch animations.
 */

const PROD_URL = 'https://healthchecks.ross.gg';

test.describe('Production site observation', () => {
  test('observe real L4 ping timing (1.1.1.1:53)', async ({ page }) => {
    test.setTimeout(300_000);

    const worldMapLogs: { time: number; text: string }[] = [];
    const startTime = Date.now();

    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('[WorldMap]') && text.includes('spawnCount')) {
        worldMapLogs.push({ time: Date.now() - startTime, text });
      }
    });

    await page.goto(`${PROD_URL}/?hostname=1.1.1.1&port=53&debug`);
    await page.waitForTimeout(3000);

    const runButton = page.locator('button', { hasText: /run/i }).first();
    await expect(runButton).toBeEnabled({ timeout: 15_000 });
    await runButton.click();

    console.log('Observing production L4 (TCP) for 60s...');
    await page.waitForTimeout(60000);

    const stopButton = page.locator('button', { hasText: /stop/i }).first();
    await stopButton.click();
    await page.waitForTimeout(3000);

    const roundSpawnLog: Record<string, number> = await page.evaluate(
      () => (window as any).__roundSpawnLog || {}
    );

    analyzeAndReport(worldMapLogs, roundSpawnLog, 'PROD L4 TCP (1.1.1.1:53)');
  });

  test('observe real L7 ping timing (1.1.1.1:443 HTTPS)', async ({ page }) => {
    test.setTimeout(300_000);

    const worldMapLogs: { time: number; text: string }[] = [];
    const startTime = Date.now();

    page.on('console', (msg) => {
      const text = msg.text();
      if (text.includes('[WorldMap]') && text.includes('spawnCount')) {
        worldMapLogs.push({ time: Date.now() - startTime, text });
      }
    });

    await page.goto(`${PROD_URL}/?hostname=1.1.1.1&port=443&layer=l7&debug`);
    await page.waitForTimeout(3000);

    const runButton = page.locator('button', { hasText: /run/i }).first();
    await expect(runButton).toBeEnabled({ timeout: 15_000 });
    await runButton.click();

    console.log('Observing production L7 (HTTPS) for 60s...');
    await page.waitForTimeout(60000);

    const stopButton = page.locator('button', { hasText: /stop/i }).first();
    await stopButton.click();
    await page.waitForTimeout(3000);

    const roundSpawnLog: Record<string, number> = await page.evaluate(
      () => (window as any).__roundSpawnLog || {}
    );

    analyzeAndReport(worldMapLogs, roundSpawnLog, 'PROD L7 HTTPS (1.1.1.1:443)');
  });
});

function analyzeAndReport(
  worldMapLogs: { time: number; text: string }[],
  roundSpawnLog: Record<string, number>,
  label: string,
) {
  const spawnEvents: { time: number; spawnCount: number }[] = [];
  worldMapLogs.forEach(log => {
    const m = log.text.match(/spawnCount:\s*(\d+)/);
    if (m && parseInt(m[1]) > 0) {
      spawnEvents.push({ time: log.time, spawnCount: parseInt(m[1]) });
    }
  });

  // Group into bursts (2s gap threshold)
  const bursts: { startTime: number; events: typeof spawnEvents; totalSpawns: number }[] = [];
  if (spawnEvents.length > 0) {
    let cur = { startTime: spawnEvents[0].time, events: [spawnEvents[0]], totalSpawns: spawnEvents[0].spawnCount };
    for (let i = 1; i < spawnEvents.length; i++) {
      if (spawnEvents[i].time - spawnEvents[i - 1].time > 2000) {
        bursts.push(cur);
        cur = { startTime: spawnEvents[i].time, events: [spawnEvents[i]], totalSpawns: spawnEvents[i].spawnCount };
      } else {
        cur.events.push(spawnEvents[i]);
        cur.totalSpawns += spawnEvents[i].spawnCount;
      }
    }
    bursts.push(cur);
  }

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`${label} — PRODUCTION SITE OBSERVATION`);
  console.log(`${'═'.repeat(70)}`);
  console.log(`Spawn events: ${spawnEvents.length} | Bursts: ${bursts.length}\n`);

  bursts.forEach((burst, i) => {
    const gap = i > 0 ? burst.startTime - bursts[i - 1].startTime : 0;
    const subEvents = burst.events.map(e => e.spawnCount).join('+');
    const gapStr = i > 0 ? ` (gap: ${gap}ms, drift: ${gap - 5000}ms)` : '';
    console.log(`  Burst ${i + 1}: ${burst.totalSpawns} spawns [${subEvents}] @ +${burst.startTime}ms${gapStr}`);
  });

  // Check for close gaps
  const closeGaps: string[] = [];
  for (let i = 1; i < bursts.length; i++) {
    const gap = bursts[i].startTime - bursts[i - 1].startTime;
    if (gap < 3000) {
      closeGaps.push(`Burst ${i}→${i + 1}: ${gap}ms apart (${bursts[i - 1].totalSpawns} spawns, then ${bursts[i].totalSpawns} spawns)`);
    }
  }

  if (closeGaps.length > 0) {
    console.log('\n  *** CLOSE GAP ANOMALIES ***');
    closeGaps.forEach(g => console.log(`  ${g}`));
  } else {
    console.log('\n  No close-gap anomalies detected.');
  }

  // Round spawn log
  const roundNumbers = Object.keys(roundSpawnLog).map(Number).sort((a, b) => a - b);
  if (roundNumbers.length > 0) {
    console.log('\n  Per-round spawn counts:');
    roundNumbers.forEach(rn => {
      const count = roundSpawnLog[rn];
      const delta = count - 143;
      const flag = Math.abs(delta) > 5 ? ` *** ${delta > 0 ? '+' : ''}${delta}` : '';
      console.log(`    Round ${rn}: ${count}${flag}`);
    });
  } else {
    console.log('\n  (No __roundSpawnLog — production may not have the debug tracking code yet)');
  }

  console.log(`${'═'.repeat(70)}\n`);

  // Soft assertions
  for (let i = 0; i < bursts.length - 1; i++) {
    const gap = bursts[i + 1].startTime - bursts[i].startTime;
    if (gap < 2000 && bursts[i].totalSpawns < 20) {
      expect.soft(false, `Straggler: ${bursts[i].totalSpawns} spawns then ${bursts[i + 1].totalSpawns} spawns ${gap}ms later`).toBe(true);
    }
  }
}
