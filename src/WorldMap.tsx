import { useRef, useEffect, useState, useCallback } from 'react';
import { geoNaturalEarth1, geoPath, geoInterpolate } from 'd3-geo';
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

/* ── Hub groups for co-located datacenters ("Flower Petal" layout) ── */
interface HubGroup {
  coord: [number, number]; // [lng, lat]
  members: string[];       // region codes sharing this location
}

const HUB_GROUPS: HubGroup[] = [];
const REGION_HUB: Record<string, number> = {};   // region code → hub index
const REGION_ANGLE: Record<string, number> = {};  // region code → petal angle (radians)

(() => {
  const groups = new Map<string, { coord: [number, number]; codes: string[] }>();
  for (const [code, coord] of Object.entries(REGION_COORDINATES)) {
    const key = `${coord[0]},${coord[1]}`;
    if (!groups.has(key)) groups.set(key, { coord, codes: [] });
    groups.get(key)!.codes.push(code);
  }
  let idx = 0;
  for (const { coord, codes } of groups.values()) {
    if (codes.length < 2) continue;
    HUB_GROUPS.push({ coord, members: codes });
    const n = codes.length;
    codes.forEach((code, i) => {
      REGION_HUB[code] = idx;
      REGION_ANGLE[code] = (2 * Math.PI * i) / n - Math.PI / 2;
    });
    idx++;
  }
})();

const HUB_R = 6;         // normal petal offset (px)
const HUB_R_HOVER = 14;  // expanded on hover (px)

const PROVIDER_LABELS: Record<string, string> = {
  cloudflare: 'Cloudflare',
  aws: 'AWS',
  gcp: 'GCP',
  azure: 'Azure',
};

/* ═══════════════════════════════════════════════════════
   Multi-hop packet-path animation system
   Home → Worker (Cloudflare edge) → Target
   ═══════════════════════════════════════════════════════ */

const REPLAY_DELAY = 5000;  // 5s after pings sent, replay all results
const MIN_LEG_MS = 16;      // ~1 frame minimum per leg
const MAX_PACKETS = 300;    // 2 concurrent rounds of 143 regions
const TRAIL_FADE = 1500;    // completed trail fade duration (ms)
const RIPPLE_DUR = 400;     // impact ripple duration (ms)
const SPEED_MULT = 100;     // duration = sqrt(latency) * SPEED_MULT

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
  startAt: number,
) {
  const worker = REGION_COORDINATES[regionCode];
  if (!worker) return;

  const legs: Leg[] = [];
  const totalDur = Math.sqrt(latency) * SPEED_MULT;
  const halfLat = Math.max(MIN_LEG_MS, totalDur / 2);

  if (home && target) {
    // Full 2-hop: Home → Worker → Target, each leg = latency/2
    legs.push({
      from: home, to: worker,
      dur: halfLat,
      interp: geoInterpolate(home, worker),
    });
    legs.push({
      from: worker, to: target,
      dur: halfLat,
      interp: geoInterpolate(worker, target),
    });
  } else if (home) {
    legs.push({
      from: home, to: worker,
      dur: Math.max(MIN_LEG_MS, Math.sqrt(latency) * SPEED_MULT),
      interp: geoInterpolate(home, worker),
    });
  } else if (target) {
    legs.push({
      from: worker, to: target,
      dur: Math.max(MIN_LEG_MS, Math.sqrt(latency) * SPEED_MULT),
      interp: geoInterpolate(worker, target),
    });
  }

  if (!legs.length) return;

  // Evict oldest packets if at capacity
  while (packets.length >= MAX_PACKETS) packets.shift();

  // legStart = startAt so packet sits dormant until the replay moment
  packets.push({ provider: getProvider(regionCode), failed, legs, legIdx: 0, legStart: startAt });
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
  const roundStartRef = useRef<number>(0);
  const mouseRef = useRef<[number, number] | null>(null);

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

  // Track result updates → spawn packet animations with 5s batch delay
  useEffect(() => {
    const now = Date.now();
    const home: [number, number] | null = homeLocation
      ? [homeLocation.lng, homeLocation.lat]
      : null;
    const target: [number, number] | null = targetLocation
      ? [targetLocation.lng, targetLocation.lat]
      : null;

    // Check if any new results arrived
    let hasNew = false;
    results.forEach(r => {
      if (r.sent > (prevSentRef.current.get(r.region) || 0)) hasNew = true;
    });
    if (!hasNew) return;

    // Detect new round: >4s since last round → new batch
    if (now - roundStartRef.current > 4000) {
      roundStartRef.current = now;
    }
    // All packets in this round replay at roundStart + 5s
    const startAt = roundStartRef.current + REPLAY_DELAY;

    results.forEach(r => {
      const prev = prevSentRef.current.get(r.region) || 0;
      if (r.sent > prev) {
        const lat = r.latencies.length > 0 ? r.latencies[r.latencies.length - 1] : 100;
        spawnPacket(r.region, lat, home, target, r.status === 'failed', startAt);
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
      const elapsed = now - pkt.legStart;
      if (elapsed < 0) return; // batch hasn't started yet — waiting for 5s replay
      const progress = Math.min(1, elapsed / leg.dur);
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

    /* ── Region dots (Flower Petal layout for co-located) ── */
    const resultMap = new Map<string, TestResult>();
    results.forEach(r => resultMap.set(r.region, r));

    // Determine which hub (if any) the mouse is hovering over
    const mouse = mouseRef.current;
    let hoveredHub = -1;
    if (mouse) {
      for (let hi = 0; hi < HUB_GROUPS.length; hi++) {
        const center = proj(HUB_GROUPS[hi].coord);
        if (!center) continue;
        const dx = mouse[0] - center[0];
        const dy = mouse[1] - center[1];
        if (dx * dx + dy * dy < 20 * 20) { hoveredHub = hi; break; }
      }
    }

    // Draw connecting circles for multi-provider hubs
    HUB_GROUPS.forEach((hub, hi) => {
      const center = proj(hub.coord);
      if (!center) return;
      const r = hi === hoveredHub ? HUB_R_HOVER : HUB_R;
      ctx.beginPath();
      ctx.arc(center[0], center[1], r, 0, 2 * Math.PI);
      ctx.strokeStyle = hi === hoveredHub ? 'rgba(148,163,184,0.4)' : 'rgba(100,116,139,0.2)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    });

    // Draw dots, track hovered dot for tooltip
    const tooltipBox = { value: null as { x: number; y: number; name: string; provider: string } | null };

    allRegions.forEach(regionCode => {
      const coords = REGION_COORDINATES[regionCode];
      if (!coords) return;

      const p = proj(coords);
      if (!p) return;

      // Apply hub petal offset
      let px = p[0], py = p[1];
      const hubIdx = REGION_HUB[regionCode];
      if (hubIdx !== undefined) {
        const r = hubIdx === hoveredHub ? HUB_R_HOVER : HUB_R;
        const angle = REGION_ANGLE[regionCode];
        px += Math.cos(angle) * r;
        py += Math.sin(angle) * r;
      }

      const provider = getProvider(regionCode);
      const colors = PROVIDER_COLORS[provider];
      const result = resultMap.get(regionCode);

      // Dot glow (provider-colored) for connected regions
      if (result && result.status === 'connected') {
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, 2 * Math.PI);
        ctx.fillStyle = colors.glow;
        ctx.fill();
      }

      // Main dot (circle for all providers)
      const dotRadius = result && result.sent > 0 ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.arc(px, py, dotRadius, 0, 2 * Math.PI);

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

      // Check if mouse is over this dot
      if (mouse) {
        const dx = mouse[0] - px;
        const dy = mouse[1] - py;
        if (dx * dx + dy * dy < 8 * 8) {
          const name = result?.regionName || regionCode;
          tooltipBox.value = { x: px, y: py, name, provider: PROVIDER_LABELS[provider] || provider };
        }
      }
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

    /* ── Hover tooltip ── */
    const tooltip = tooltipBox.value;
    if (tooltip) {
      ctx.font = '10px system-ui, sans-serif';
      const line1 = tooltip.name;
      const line2 = tooltip.provider;
      const tw = Math.max(ctx.measureText(line1).width, ctx.measureText(line2).width) + 12;
      const th = 30;
      const tx = Math.min(tooltip.x + 10, width - tw - 4);
      const ty = Math.max(tooltip.y - th - 6, 4);

      ctx.fillStyle = 'rgba(15,23,42,0.92)';
      ctx.beginPath();
      ctx.roundRect(tx, ty, tw, th, 4);
      ctx.fill();
      ctx.strokeStyle = 'rgba(148,163,184,0.3)';
      ctx.lineWidth = 0.5;
      ctx.stroke();

      ctx.fillStyle = '#e2e8f0';
      ctx.textAlign = 'left';
      ctx.fillText(line1, tx + 6, ty + 12);
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(line2, tx + 6, ty + 24);
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
        onMouseMove={(e) => {
          mouseRef.current = [e.nativeEvent.offsetX, e.nativeEvent.offsetY];
          if (!packets.length && !trails.length && !ripples.length) {
            cancelAnimationFrame(animFrameRef.current);
            animFrameRef.current = requestAnimationFrame(draw);
          }
        }}
        onMouseLeave={() => {
          mouseRef.current = null;
          if (!packets.length && !trails.length && !ripples.length) {
            cancelAnimationFrame(animFrameRef.current);
            animFrameRef.current = requestAnimationFrame(draw);
          }
        }}
        style={{ width: dimensions.width || '100%', height: dimensions.height || 'auto', display: 'block', cursor: 'crosshair' }}
      />
    </div>
  );
}
