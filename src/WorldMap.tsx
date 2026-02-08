import { useRef, useEffect, useState, useCallback } from 'react';
import { geoNaturalEarth1, geoPath, geoInterpolate, geoDistance } from 'd3-geo';
import { feature } from 'topojson-client';
import type { FeatureCollection } from 'geojson';
import { REGION_COORDINATES } from './regionCoordinates';

interface TestResult {
  region: string;
  regionName: string;
  status: 'pending' | 'connected' | 'failed';
  sent: number;
  received: number;
  latencies: number[];
  lastError?: string;
  colo?: string;
  coloCity?: string;
  cfPlacement?: string;
}

interface HomeLocation {
  lat: number;
  lng: number;
  city?: string;
  country?: string;
}

interface TargetLocation {
  lat: number;
  lng: number;
  city?: string;
  country?: string;
}

interface WorldMapProps {
  results: TestResult[];
  allRegions: string[];
  homeLocation: HomeLocation | null;
  targetLocation: TargetLocation | null;
}

/* ── Provider brand colors ── */
const PROVIDER_COLORS: Record<string, { dot: string; glow: string; rgb: string }> = {
  cloudflare: { dot: '#F38020', glow: 'rgba(243, 128, 32, 0.15)', rgb: '243,128,32' },
  aws:        { dot: '#FACC15', glow: 'rgba(250, 204, 21, 0.15)',  rgb: '250,204,21' },
  gcp:        { dot: '#34A853', glow: 'rgba(52, 168, 83, 0.15)',   rgb: '52,168,83' },
  azure:      { dot: '#0078D4', glow: 'rgba(0, 120, 212, 0.15)',   rgb: '0,120,212' },
};

function getProvider(regionCode: string): string {
  if (regionCode.startsWith('aws-')) return 'aws';
  if (regionCode.startsWith('gcp-')) return 'gcp';
  if (regionCode.startsWith('azure-')) return 'azure';
  return 'cloudflare';
}

/* ═══════════════════════════════════════════════════════
   Multi-hop packet-path animation system
   Home → Worker (Cloudflare edge) → Target
   ═══════════════════════════════════════════════════════ */

const DILATION = 10;        // 1ms latency → 10ms visual animation
const MIN_LEG_MS = 500;     // minimum animation time per leg
const MAX_PACKETS = 50;     // concurrent packet cap
const TRAIL_FADE = 1500;    // completed trail fade duration (ms)
const RIPPLE_DUR = 400;     // impact ripple duration (ms)

interface Leg {
  from: [number, number];   // [lng, lat]
  to: [number, number];
  dur: number;              // ms (dilated)
  interp: (t: number) => [number, number];
}

interface Packet {
  provider: string;
  failed: boolean;
  legs: Leg[];
  legIdx: number;
  legStart: number;
}

interface Trail {
  legs: Leg[];
  rgb: string;
  failed: boolean;
  end: number;
}

interface Ripple {
  coord: [number, number];
  start: number;
  rgb: string;
}

// Module-level animation state (single WorldMap instance)
const packets: Packet[] = [];
const trails: Trail[] = [];
const ripples: Ripple[] = [];

function spawnPacket(
  regionCode: string,
  latency: number,
  home: [number, number] | null,
  target: [number, number] | null,
  failed: boolean,
  now: number,
) {
  const worker = REGION_COORDINATES[regionCode];
  if (!worker) return;

  const legs: Leg[] = [];

  if (home && target) {
    // Full 2-hop path: Home → Worker → Target
    const d1 = geoDistance(home, worker) || 0.001;
    const d2 = geoDistance(worker, target) || 0.001;
    const total = d1 + d2;
    const anim = Math.max(latency * DILATION, MIN_LEG_MS * 2);
    legs.push({
      from: home, to: worker,
      dur: Math.max(MIN_LEG_MS, anim * d1 / total),
      interp: geoInterpolate(home, worker),
    });
    legs.push({
      from: worker, to: target,
      dur: Math.max(MIN_LEG_MS, anim * d2 / total),
      interp: geoInterpolate(worker, target),
    });
  } else if (home) {
    legs.push({
      from: home, to: worker,
      dur: Math.max(MIN_LEG_MS, latency * DILATION),
      interp: geoInterpolate(home, worker),
    });
  } else if (target) {
    legs.push({
      from: worker, to: target,
      dur: Math.max(MIN_LEG_MS, latency * DILATION),
      interp: geoInterpolate(worker, target),
    });
  }

  if (!legs.length) return;

  // Evict oldest packets if at capacity
  while (packets.length >= MAX_PACKETS) packets.shift();

  packets.push({ provider: getProvider(regionCode), failed, legs, legIdx: 0, legStart: now });
}

/* Draw a great-circle arc on projected Canvas */
function drawArc(
  ctx: CanvasRenderingContext2D,
  proj: (c: [number, number]) => [number, number] | null,
  interp: (t: number) => [number, number],
  endT: number,
  color: string,
  width: number,
) {
  const N = 48;
  ctx.beginPath();
  let on = false;
  let px = 0;
  for (let i = 0; i <= N; i++) {
    const p = proj(interp((i / N) * endT));
    if (!p) { on = false; continue; }
    // Break line at antimeridian wrapping
    if (on && Math.abs(p[0] - px) > 100) { ctx.stroke(); ctx.beginPath(); on = false; }
    if (!on) { ctx.moveTo(p[0], p[1]); on = true; } else { ctx.lineTo(p[0], p[1]); }
    px = p[0];
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

export default function WorldMap({ results, allRegions, homeLocation, targetLocation }: WorldMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [land, setLand] = useState<FeatureCollection | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const animFrameRef = useRef<number>(0);
  const prevSentRef = useRef<Map<string, number>>(new Map());

  // Fetch world topology once
  useEffect(() => {
    fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json')
      .then(res => res.json())
      .then((topo: unknown) => {
        const t = topo as any;
        const geojson = feature(t, t.objects.land) as unknown as FeatureCollection;
        setLand(geojson);
      })
      .catch(() => {});
  }, []);

  // Track result updates → spawn packet animations
  useEffect(() => {
    const now = Date.now();
    const home: [number, number] | null = homeLocation
      ? [homeLocation.lng, homeLocation.lat]
      : null;
    const target: [number, number] | null = targetLocation
      ? [targetLocation.lng, targetLocation.lat]
      : null;
    results.forEach(r => {
      const prev = prevSentRef.current.get(r.region) || 0;
      if (r.sent > prev) {
        const lat = r.latencies.length > 0 ? r.latencies[r.latencies.length - 1] : 100;
        spawnPacket(r.region, lat, home, target, r.status === 'failed', now);
        prevSentRef.current.set(r.region, r.sent);
      }
    });
  }, [results, homeLocation, targetLocation]);

  // Handle resize
  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      const { width } = entries[0].contentRect;
      setDimensions({ width, height: Math.round(width * 0.52) });
    });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !dimensions.width) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = dimensions;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const projection = geoNaturalEarth1()
      .fitSize([width - 20, height - 20], { type: 'Sphere' } as any)
      .translate([width / 2, height / 2]);

    const proj = (c: [number, number]) => projection(c) as [number, number] | null;

    // Background
    ctx.fillStyle = '#0c1222';
    ctx.fillRect(0, 0, width, height);

    // Globe outline
    const pathGen = geoPath(projection, ctx);
    ctx.beginPath();
    pathGen({ type: 'Sphere' } as any);
    ctx.fillStyle = '#0f1729';
    ctx.fill();

    // Land (slightly dimmer for NOC feel)
    if (land) {
      ctx.beginPath();
      pathGen(land as any);
      ctx.fillStyle = '#162038';
      ctx.strokeStyle = '#243150';
      ctx.lineWidth = 0.5;
      ctx.fill();
      ctx.stroke();
    }

    // Graticule
    const graticule = {
      type: 'MultiLineString' as const,
      coordinates: [
        ...Array.from({ length: 13 }, (_, i) => {
          const lng = -180 + i * 30;
          return Array.from({ length: 181 }, (_, j) => [lng, -90 + j]);
        }),
        ...Array.from({ length: 7 }, (_, i) => {
          const lat = -90 + i * 30;
          return Array.from({ length: 361 }, (_, j) => [-180 + j, lat]);
        }),
      ],
    };
    ctx.beginPath();
    pathGen(graticule as any);
    ctx.strokeStyle = '#182240';
    ctx.lineWidth = 0.3;
    ctx.stroke();

    const now = Date.now();

    /* ── Cleanup expired trails & ripples ── */
    while (trails.length && now - trails[0].end > TRAIL_FADE) trails.shift();
    while (ripples.length && now - ripples[0].start > RIPPLE_DUR) ripples.shift();

    /* ── Draw fading completed trails ── */
    trails.forEach(trail => {
      const fade = Math.max(0, 1 - (now - trail.end) / TRAIL_FADE);
      const c = trail.failed ? '239,68,68' : trail.rgb;
      trail.legs.forEach((l, i) => {
        const legC = i === 0 ? '255,255,255' : c;
        drawArc(ctx, proj, l.interp, 1, `rgba(${legC},${(0.1 * fade).toFixed(3)})`, 0.5);
      });
    });

    /* ── Advance & draw active packets ── */
    const done: number[] = [];
    packets.forEach((pkt, idx) => {
      const leg = pkt.legs[pkt.legIdx];
      const progress = Math.min(1, (now - pkt.legStart) / leg.dur);
      const colors = PROVIDER_COLORS[pkt.provider];
      const rgb = colors?.rgb || '255,255,255';

      // Check if leg is complete
      if (progress >= 1) {
        // Impact ripple at destination
        ripples.push({ coord: leg.to, start: now, rgb: pkt.failed ? '239,68,68' : rgb });

        if (pkt.legIdx < pkt.legs.length - 1) {
          // Advance to next leg
          pkt.legIdx++;
          pkt.legStart = now;
        } else {
          // All legs done → completed trail
          done.push(idx);
          trails.push({ legs: pkt.legs, rgb, failed: pkt.failed, end: now });
          return;
        }
      }

      // Draw already-completed legs as faint ghosting lines
      for (let i = 0; i < pkt.legIdx; i++) {
        const l = pkt.legs[i];
        const legC = i === 0 ? '255,255,255' : rgb;
        drawArc(ctx, proj, l.interp, 1, `rgba(${legC},0.12)`, 0.6);
      }

      // Current leg
      const curLeg = pkt.legs[pkt.legIdx];
      const curProgress = Math.min(1, (now - pkt.legStart) / curLeg.dur);
      const isFirst = pkt.legIdx === 0;
      const pRgb = isFirst ? '255,255,255' : (pkt.failed ? '239,68,68' : rgb);

      // Full arc guideline (very dim)
      drawArc(ctx, proj, curLeg.interp, 1, `rgba(${pRgb},0.05)`, 0.4);

      // Traversed portion (brighter — the "ghost trail" behind the particle)
      drawArc(ctx, proj, curLeg.interp, curProgress, `rgba(${pRgb},0.22)`, 0.8);

      // Particle
      const pos = curLeg.interp(curProgress);
      const pp = proj(pos);
      if (pp) {
        // Glow halo
        ctx.beginPath();
        ctx.arc(pp[0], pp[1], 5, 0, 2 * Math.PI);
        ctx.fillStyle = `rgba(${pRgb},0.12)`;
        ctx.fill();
        // Core
        ctx.beginPath();
        ctx.arc(pp[0], pp[1], 1.8, 0, 2 * Math.PI);
        ctx.fillStyle = `rgba(${pRgb},0.85)`;
        ctx.fill();
      }
    });

    // Remove completed packets (reverse order preserves indices)
    for (let i = done.length - 1; i >= 0; i--) packets.splice(done[i], 1);

    /* ── Impact ripples ── */
    ripples.forEach(r => {
      const t = (now - r.start) / RIPPLE_DUR;
      const p = proj(r.coord);
      if (!p) return;
      const radius = 3 + t * 10;
      const alpha = 0.5 * (1 - t);
      ctx.beginPath();
      ctx.arc(p[0], p[1], radius, 0, 2 * Math.PI);
      ctx.strokeStyle = `rgba(${r.rgb},${alpha.toFixed(3)})`;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    });

    /* ── Region dots ── */
    const resultMap = new Map<string, TestResult>();
    results.forEach(r => resultMap.set(r.region, r));

    allRegions.forEach(regionCode => {
      const coords = REGION_COORDINATES[regionCode];
      if (!coords) return;

      const p = proj(coords);
      if (!p) return;

      const provider = getProvider(regionCode);
      const colors = PROVIDER_COLORS[provider];
      const result = resultMap.get(regionCode);

      // Dot glow (provider-colored) for connected regions
      if (result && result.status === 'connected') {
        ctx.beginPath();
        ctx.arc(p[0], p[1], 6, 0, 2 * Math.PI);
        ctx.fillStyle = colors.glow;
        ctx.fill();
      }

      // Main dot
      const dotRadius = result && result.sent > 0 ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.arc(p[0], p[1], dotRadius, 0, 2 * Math.PI);

      if (!result || result.sent === 0) {
        ctx.fillStyle = '#475569';
      } else if (result.status === 'connected') {
        ctx.fillStyle = colors.dot;
      } else if (result.status === 'failed') {
        ctx.fillStyle = '#ef4444';
      } else {
        ctx.fillStyle = '#94a3b8';
      }
      ctx.fill();
    });

    /* ── Home marker (white diamond) ── */
    if (homeLocation) {
      const hp = proj([homeLocation.lng, homeLocation.lat]);
      if (hp) {
        ctx.beginPath();
        ctx.arc(hp[0], hp[1], 10, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(hp[0], hp[1], 6, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(hp[0], hp[1] - 5);
        ctx.lineTo(hp[0] + 4, hp[1]);
        ctx.lineTo(hp[0], hp[1] + 5);
        ctx.lineTo(hp[0] - 4, hp[1]);
        ctx.closePath();
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }

    /* ── Target marker (red crosshair) ── */
    if (targetLocation) {
      const tp = proj([targetLocation.lng, targetLocation.lat]);
      if (tp) {
        ctx.beginPath();
        ctx.arc(tp[0], tp[1], 10, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(239,68,68,0.1)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(tp[0], tp[1], 5, 0, 2 * Math.PI);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        const L = 9, G = 5;
        ctx.beginPath();
        ctx.moveTo(tp[0], tp[1] - G); ctx.lineTo(tp[0], tp[1] - L);
        ctx.moveTo(tp[0], tp[1] + G); ctx.lineTo(tp[0], tp[1] + L);
        ctx.moveTo(tp[0] - G, tp[1]); ctx.lineTo(tp[0] - L, tp[1]);
        ctx.moveTo(tp[0] + G, tp[1]); ctx.lineTo(tp[0] + L, tp[1]);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(tp[0], tp[1], 1.5, 0, 2 * Math.PI);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
      }
    }

    /* ── Legend (bottom-left) ── */
    const legendX = 12;
    let legendY = height - 12;
    const items: { color: string; label: string; shape: 'dot' | 'diamond' | 'crosshair' }[] = [];

    const tl = targetLocation?.city ? `Target (${targetLocation.city})` : 'Target';
    items.unshift({ color: '#ef4444', label: tl, shape: 'crosshair' });
    const hl = homeLocation?.city ? `You (${homeLocation.city})` : 'You';
    items.unshift({ color: '#ffffff', label: hl, shape: 'diamond' });
    items.unshift({ color: '#0078D4', label: 'Azure', shape: 'dot' });
    items.unshift({ color: '#34A853', label: 'GCP', shape: 'dot' });
    items.unshift({ color: '#FACC15', label: 'AWS', shape: 'dot' });
    items.unshift({ color: '#F38020', label: 'Cloudflare', shape: 'dot' });

    ctx.font = '9px system-ui, sans-serif';
    ctx.textAlign = 'left';

    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i];
      const iy = legendY;

      if (item.shape === 'diamond') {
        ctx.beginPath();
        ctx.moveTo(legendX + 4, iy - 4);
        ctx.lineTo(legendX + 7, iy);
        ctx.lineTo(legendX + 4, iy + 4);
        ctx.lineTo(legendX + 1, iy);
        ctx.closePath();
        ctx.fillStyle = item.color;
        ctx.fill();
      } else if (item.shape === 'crosshair') {
        ctx.beginPath();
        ctx.arc(legendX + 4, iy, 3, 0, 2 * Math.PI);
        ctx.strokeStyle = item.color;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(legendX + 4, iy - 5);
        ctx.lineTo(legendX + 4, iy + 5);
        ctx.moveTo(legendX - 1, iy);
        ctx.lineTo(legendX + 9, iy);
        ctx.strokeStyle = item.color;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(legendX + 4, iy, 3, 0, 2 * Math.PI);
        ctx.fillStyle = item.color;
        ctx.fill();
      }

      ctx.fillStyle = '#94a3b8';
      ctx.fillText(item.label, legendX + 12, iy + 3);
      legendY -= 14;
    }

    /* ── Continue animation loop if there are active elements ── */
    if (packets.length || trails.length || ripples.length) {
      animFrameRef.current = requestAnimationFrame(draw);
    }
  }, [land, dimensions, results, allRegions, homeLocation, targetLocation]);

  // Render on state changes
  useEffect(() => {
    cancelAnimationFrame(animFrameRef.current);
    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [draw]);

  return (
    <div ref={containerRef} className="w-full bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 overflow-hidden">
      <canvas
        ref={canvasRef}
        style={{ width: dimensions.width || '100%', height: dimensions.height || 'auto', display: 'block' }}
      />
    </div>
  );
}
