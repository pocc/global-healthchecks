import type { TestResult } from '../types';

interface LatencyStatsProps {
  results: TestResult[];
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.ceil(p * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function msColor(ms: number): string {
  if (ms < 100) return 'text-green-400';
  if (ms < 250) return 'text-yellow-400';
  return 'text-red-400';
}

export default function LatencyStats({ results }: LatencyStatsProps) {
  const connected = results.filter(
    (r): r is TestResult & { lastMs: number } =>
      r.status === 'connected' && r.lastMs !== undefined
  );

  if (connected.length < 2) return null;

  const values = connected.map(r => r.lastMs);
  const sorted = [...values].sort((a, b) => a - b);

  const min = sorted[0];
  const median = sorted.length % 2 === 1
    ? sorted[Math.floor(sorted.length / 2)]
    : Math.round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2);
  const p95 = percentile(sorted, 0.95);
  const max = sorted[sorted.length - 1];

  const fastest = connected.reduce((a, b) => a.lastMs < b.lastMs ? a : b);
  const slowest = connected.reduce((a, b) => a.lastMs > b.lastMs ? a : b);

  return (
    <div className="mt-2 px-3 py-2 bg-slate-900/40 border border-slate-700/50 rounded-lg text-xs">
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        <span className="text-slate-400">
          Min: <span className={`font-mono font-semibold ${msColor(min)}`}>{min}ms</span>
        </span>
        <span className="text-slate-400">
          Median: <span className={`font-mono font-semibold ${msColor(median)}`}>{median}ms</span>
        </span>
        <span className="text-slate-400">
          P95: <span className={`font-mono font-semibold ${msColor(p95)}`}>{p95}ms</span>
        </span>
        <span className="text-slate-400">
          Max: <span className={`font-mono font-semibold ${msColor(max)}`}>{max}ms</span>
        </span>
        <span className="ml-auto text-slate-500">
          Fastest: <span className="text-green-400 font-medium">{fastest.regionName}</span>
          <span className="font-mono text-green-400"> {fastest.lastMs}ms</span>
        </span>
        <span className="text-slate-500">
          Slowest: <span className="text-red-400 font-medium">{slowest.regionName}</span>
          <span className="font-mono text-red-400"> {slowest.lastMs}ms</span>
        </span>
      </div>
    </div>
  );
}
