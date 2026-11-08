import { test, expect, Page } from '@playwright/test';

/**
 * Tests the speed slider against the LIVE production site to observe:
 * 1. Are all 143 pings present at each speed?
 * 2. Do animations overlap / get killed at high multipliers?
 * 3. Are there packet issues at max (10x)?
 */

const PROD_URL = 'https://healthchecks.ross.gg';
const EXPECTED_REGIONS = 143;

/** Set the speed slider to a specific value (0=1x, 50=~3.2x, 100=10x) */
async function setSpeedSlider(page: Page, sliderValue: number) {
  // Open the speed panel
  const speedButton = page.locator('button[title="Animation speed"]');
  await speedButton.click();
  await page.waitForTimeout(500);

  // Set range input value via native input setter + dispatch events (React controlled input)
  const slider = page.locator('input[type="range"]');
  await slider.waitFor({ state: 'visible', timeout: 5000 });
  await page.evaluate((val) => {
    const input = document.querySelector('input[type="range"]') as HTMLInputElement;
    if (!input) throw new Error('Range input not found');
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value',
    )!.set!;
    nativeInputValueSetter.call(input, val);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, String(sliderValue));
  await page.waitForTimeout(300);

  // Close panel
  await speedButton.click();
  await page.waitForTimeout(200);
}

interface SpeedTestResult {
  sliderValue: number;
  label: string;
  roundSpawnLog: Record<string, number>;
  worldMapLogs: { time: number; text: string }[];
  animState: { packets: number; trails: number; ripples: number; rAFRunning: boolean };
  totalSpawned: number;
}

async function runAtSpeed(
  page: Page,
  sliderValue: number,
  label: string,
  rounds: number,
  startTime: number,
): Promise<SpeedTestResult> {
  const worldMapLogs: { time: number; text: string }[] = [];

  const handler = (msg: import('@playwright/test').ConsoleMessage) => {
    const text = msg.text();
    if (text.includes('[WorldMap]') && text.includes('spawnCount')) {
      worldMapLogs.push({ time: Date.now() - startTime, text });
    }
  };
  page.on('console', handler);

  // Reset spawn tracking
  await page.evaluate(() => {
    (window as any).__animTotalSpawned = 0;
    (window as any).__roundSpawnLog = {};
  });

  // Set the speed
  await setSpeedSlider(page, sliderValue);
  console.log(`\n--- Testing at ${label} (slider=${sliderValue}) for ${rounds} rounds ---`);

  // Wait for rounds to complete
  const waitMs = rounds * 5000 + 3000; // rounds * 5s + buffer
  await page.waitForTimeout(waitMs);

  const roundSpawnLog: Record<string, number> = await page.evaluate(
    () => (window as any).__roundSpawnLog || {},
  );
  const totalSpawned: number = await page.evaluate(
    () => (window as any).__animTotalSpawned || 0,
  );
  const animState = await page.evaluate(() => (window as any).__animState || {});

  page.off('console', handler);

  return { sliderValue, label, roundSpawnLog, worldMapLogs, animState, totalSpawned };
}

function analyzeResult(result: SpeedTestResult) {
  const { label, sliderValue, roundSpawnLog, worldMapLogs, animState, totalSpawned } = result;
  const roundNumbers = Object.keys(roundSpawnLog).map(Number).sort((a, b) => a - b);
  const spawnTotal = roundNumbers.reduce((sum, rn) => sum + roundSpawnLog[rn], 0);

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`${label} (slider=${sliderValue}) — LIVE SITE RESULTS`);
  console.log(`${'═'.repeat(70)}`);
  console.log(`Total spawned: ${totalSpawned} (log sum: ${spawnTotal}) | Rounds: ${roundNumbers.length}`);
  console.log(`Animation state: packets=${animState.packets}, trails=${animState.trails}, rAF=${animState.rAFRunning}`);

  let hasStraggler = false;
  let maxDelta = 0;

  roundNumbers.forEach(rn => {
    const count = roundSpawnLog[rn];
    const delta = count - EXPECTED_REGIONS;
    if (Math.abs(delta) > maxDelta) maxDelta = Math.abs(delta);
    if (count < EXPECTED_REGIONS * 0.5) hasStraggler = true;
    const status = Math.abs(delta) <= 10 ? 'OK' : count < EXPECTED_REGIONS * 0.5 ? 'STRAGGLER' : 'WARN';
    console.log(`  Round ${rn}: ${count} spawns (${delta >= 0 ? '+' : ''}${delta}) [${status}]`);
  });

  // Check WorldMap logs for speedMult and packet overflow
  const speedMultLogs = worldMapLogs
    .map(l => {
      const m = l.text.match(/speedMult:\s*([\d.]+)/);
      return m ? parseFloat(m[1]) : null;
    })
    .filter(Boolean);

  const packetCountLogs = worldMapLogs
    .map(l => {
      const m = l.text.match(/packets\.length:\s*(\d+)/);
      return m ? parseInt(m[1]) : null;
    })
    .filter((v): v is number => v !== null);

  if (packetCountLogs.length > 0) {
    const maxPackets = Math.max(...packetCountLogs);
    console.log(`\n  Max concurrent packets: ${maxPackets} (limit: 300)`);
    if (maxPackets >= 280) {
      console.log(`  *** NEAR PACKET LIMIT — eviction likely ***`);
    }
  }

  if (speedMultLogs.length > 0) {
    console.log(`  Speed multiplier in use: ${speedMultLogs[0]}`);
  }

  console.log(`\n  Max per-round delta: ±${maxDelta}`);
  console.log(`  Has extreme straggler: ${hasStraggler}`);
  console.log(`${'═'.repeat(70)}`);

  return { hasStraggler, maxDelta, spawnTotal, roundCount: roundNumbers.length, maxPackets: packetCountLogs.length > 0 ? Math.max(...packetCountLogs) : 0 };
}

test.describe('Live site slider speed testing', () => {
  test('observe pings at 1x, ~3.2x, ~5.6x, and 10x speeds', async ({ page }) => {
    test.setTimeout(300_000); // 5 minutes

    await page.goto(`${PROD_URL}/?hostname=1.1.1.1&port=53&debug`);
    await page.waitForTimeout(3000);

    // Start the test
    const runButton = page.locator('button', { hasText: /run/i }).first();
    await expect(runButton).toBeEnabled({ timeout: 15_000 });
    await runButton.click();

    const startTime = Date.now();

    // Wait for first round to establish baseline
    await page.waitForTimeout(7000);

    // Test at different speeds (test is already running, just change the slider)
    const results: SpeedTestResult[] = [];

    // 1x speed (slider=0)
    results.push(await runAtSpeed(page, 0, '1x', 3, startTime));

    // ~3.2x speed (slider=50) — midpoint
    results.push(await runAtSpeed(page, 50, '~3.2x', 3, startTime));

    // ~5.6x speed (slider=75)
    results.push(await runAtSpeed(page, 75, '~5.6x', 3, startTime));

    // 10x speed (slider=100) — max
    results.push(await runAtSpeed(page, 100, '10x', 3, startTime));

    // Stop the test
    const stopButton = page.locator('button', { hasText: /stop/i }).first();
    await stopButton.click();
    await page.waitForTimeout(3000);

    // Analyze all results
    console.log('\n\n' + '▓'.repeat(70));
    console.log('FULL ANALYSIS — ALL SPEED LEVELS');
    console.log('▓'.repeat(70));

    const analyses = results.map(r => ({ ...analyzeResult(r), label: r.label }));

    // Summary table
    console.log('\n\nSUMMARY TABLE');
    console.log('─'.repeat(70));
    console.log('Speed   | Rounds | Total Spawns | Max Δ | Straggler | Max Pkts');
    console.log('─'.repeat(70));
    analyses.forEach(a => {
      console.log(
        `${a.label.padEnd(8)}| ${String(a.roundCount).padEnd(7)}| ${String(a.spawnTotal).padEnd(13)}| ±${String(a.maxDelta).padEnd(4)} | ${a.hasStraggler ? 'YES ***' : 'no'.padEnd(9)} | ${a.maxPackets}`,
      );
    });
    console.log('─'.repeat(70));

    // Soft assertions — flag issues without hard-failing on production variance
    for (const a of analyses) {
      expect.soft(a.hasStraggler, `${a.label}: no extreme straggler rounds`).toBe(false);
      if (a.roundCount > 0) {
        expect.soft(a.roundCount, `${a.label}: observed at least 2 rounds`).toBeGreaterThanOrEqual(2);
      }
    }
  });
});
