import { useRef, useEffect, useState, useCallback } from 'react';
import { geoNaturalEarth1, geoPath } from 'd3-geo';
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

// Brand colors per cloud provider
const PROVIDER_COLORS: Record<string, { dot: string; glow: string; pulse: string }> = {
  cloudflare: { dot: '#F38020', glow: 'rgba(243, 128, 32, 0.15)', pulse: 'rgba(243, 128, 32, __ALPHA__)' },
  aws:        { dot: '#FACC15', glow: 'rgba(250, 204, 21, 0.15)',  pulse: 'rgba(250, 204, 21, __ALPHA__)' },
  gcp:        { dot: '#34A853', glow: 'rgba(52, 168, 83, 0.15)',  pulse: 'rgba(52, 168, 83, __ALPHA__)' },
  azure:      { dot: '#0078D4', glow: 'rgba(0, 120, 212, 0.15)',  pulse: 'rgba(0, 120, 212, __ALPHA__)' },
};

function getProvider(regionCode: string): string {
  if (regionCode.startsWith('aws-')) return 'aws';
  if (regionCode.startsWith('gcp-')) return 'gcp';
  if (regionCode.startsWith('azure-')) return 'azure';
  return 'cloudflare';
}

// Track when each result was last updated for pulse animation
const lastUpdatedMap = new Map<string, number>();

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
      .catch(() => {
        // If CDN fails, we'll render dots without land
      });
  }, []);

  // Track result updates for pulse animation
  useEffect(() => {
    const now = Date.now();
    results.forEach(r => {
      const prevSent = prevSentRef.current.get(r.region) || 0;
      if (r.sent > prevSent) {
        lastUpdatedMap.set(r.region, now);
        prevSentRef.current.set(r.region, r.sent);
      }
    });
  }, [results]);

  // Handle resize
  useEffect(() => {
    const observer = new ResizeObserver(entries => {
      const { width } = entries[0].contentRect;
      // Natural Earth 1 has roughly a 2:1 aspect ratio
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

    // Background
    ctx.fillStyle = '#0c1222';
    ctx.fillRect(0, 0, width, height);

    // Draw globe outline
    const pathGen = geoPath(projection, ctx);
    ctx.beginPath();
    pathGen({ type: 'Sphere' } as any);
    ctx.fillStyle = '#0f1729';
    ctx.fill();

    // Draw land
    if (land) {
      ctx.beginPath();
      pathGen(land as any);
      ctx.fillStyle = '#1a2640';
      ctx.strokeStyle = '#2a3a5c';
      ctx.lineWidth = 0.5;
      ctx.fill();
      ctx.stroke();
    }

    // Draw graticule (subtle grid lines)
    const graticule = {
      type: 'MultiLineString' as const,
      coordinates: [
        // Longitude lines every 30 degrees
        ...Array.from({ length: 13 }, (_, i) => {
          const lng = -180 + i * 30;
          return Array.from({ length: 181 }, (_, j) => [lng, -90 + j]);
        }),
        // Latitude lines every 30 degrees
        ...Array.from({ length: 7 }, (_, i) => {
          const lat = -90 + i * 30;
          return Array.from({ length: 361 }, (_, j) => [-180 + j, lat]);
        }),
      ],
    };
    ctx.beginPath();
    pathGen(graticule as any);
    ctx.strokeStyle = '#1a2640';
    ctx.lineWidth = 0.3;
    ctx.stroke();

    const now = Date.now();

    // Build result lookup
    const resultMap = new Map<string, TestResult>();
    results.forEach(r => resultMap.set(r.region, r));

    // Draw dots for all regions
    allRegions.forEach(regionCode => {
      const coords = REGION_COORDINATES[regionCode];
      if (!coords) return;

      const projected = projection(coords);
      if (!projected) return;
      const [x, y] = projected;

      const provider = getProvider(regionCode);
      const colors = PROVIDER_COLORS[provider];
      const result = resultMap.get(regionCode);
      const lastUpdated = lastUpdatedMap.get(regionCode) || 0;
      const elapsed = now - lastUpdated;

      // Pulse ring animation (1.5s duration)
      if (result && elapsed < 1500 && result.sent > 0) {
        const progress = elapsed / 1500;
        const ringRadius = 3 + progress * 18;
        const alpha = 0.6 * (1 - progress);

        ctx.beginPath();
        ctx.arc(x, y, ringRadius, 0, 2 * Math.PI);
        if (result.status === 'connected') {
          ctx.strokeStyle = colors.pulse.replace('__ALPHA__', String(alpha));
        } else {
          ctx.strokeStyle = `rgba(239, 68, 68, ${alpha})`;
        }
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Dot glow (provider-colored)
      if (result && result.status === 'connected') {
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, 2 * Math.PI);
        ctx.fillStyle = colors.glow;
        ctx.fill();
      }

      // Main dot
      const dotRadius = result && result.sent > 0 ? 2.5 : 1.5;
      ctx.beginPath();
      ctx.arc(x, y, dotRadius, 0, 2 * Math.PI);

      if (!result || result.sent === 0) {
        ctx.fillStyle = '#475569'; // slate-600
      } else if (result.status === 'connected') {
        ctx.fillStyle = colors.dot;
      } else if (result.status === 'failed') {
        ctx.fillStyle = '#ef4444'; // red-500
      } else {
        ctx.fillStyle = '#94a3b8'; // slate-400
      }
      ctx.fill();
    });

    // Draw home marker
    if (homeLocation) {
      const homeProjected = projection([homeLocation.lng, homeLocation.lat]);
      if (homeProjected) {
        const [hx, hy] = homeProjected;

        // Outer glow
        ctx.beginPath();
        ctx.arc(hx, hy, 10, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.fill();

        // Inner glow
        ctx.beginPath();
        ctx.arc(hx, hy, 6, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fill();

        // Diamond shape for home
        ctx.beginPath();
        ctx.moveTo(hx, hy - 5);
        ctx.lineTo(hx + 4, hy);
        ctx.lineTo(hx, hy + 5);
        ctx.lineTo(hx - 4, hy);
        ctx.closePath();
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#64748b'; // slate-500
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }

    // Draw target marker (crosshair)
    if (targetLocation) {
      const targetProjected = projection([targetLocation.lng, targetLocation.lat]);
      if (targetProjected) {
        const [tx, ty] = targetProjected;

        // Outer glow
        ctx.beginPath();
        ctx.arc(tx, ty, 10, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(239, 68, 68, 0.1)';
        ctx.fill();

        // Crosshair circle
        ctx.beginPath();
        ctx.arc(tx, ty, 5, 0, 2 * Math.PI);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Crosshair lines (extending beyond the circle)
        const lineLen = 9;
        const gap = 5;
        ctx.beginPath();
        // Top
        ctx.moveTo(tx, ty - gap);
        ctx.lineTo(tx, ty - lineLen);
        // Bottom
        ctx.moveTo(tx, ty + gap);
        ctx.lineTo(tx, ty + lineLen);
        // Left
        ctx.moveTo(tx - gap, ty);
        ctx.lineTo(tx - lineLen, ty);
        // Right
        ctx.moveTo(tx + gap, ty);
        ctx.lineTo(tx + lineLen, ty);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Center dot
        ctx.beginPath();
        ctx.arc(tx, ty, 1.5, 0, 2 * Math.PI);
        ctx.fillStyle = '#ef4444';
        ctx.fill();
      }
    }

    // Draw legend (bottom-left corner)
    const legendX = 12;
    let legendY = height - 12;
    const legendItems: { color: string; label: string; shape?: 'dot' | 'diamond' | 'crosshair' }[] = [];

    const tl = targetLocation?.city ? `Target (${targetLocation.city})` : 'Target';
    legendItems.unshift({ color: '#ef4444', label: tl, shape: 'crosshair' });
    const hl = homeLocation?.city ? `You (${homeLocation.city})` : 'You';
    legendItems.unshift({ color: '#ffffff', label: hl, shape: 'diamond' });
    legendItems.unshift({ color: '#0078D4', label: 'Azure', shape: 'dot' });
    legendItems.unshift({ color: '#34A853', label: 'GCP', shape: 'dot' });
    legendItems.unshift({ color: '#FACC15', label: 'AWS', shape: 'dot' });
    legendItems.unshift({ color: '#F38020', label: 'Cloudflare', shape: 'dot' });

    ctx.font = '9px system-ui, sans-serif';
    ctx.textAlign = 'left';

    // Draw from bottom up
    for (let i = legendItems.length - 1; i >= 0; i--) {
      const item = legendItems[i];
      const iy = legendY;

      if (item.shape === 'diamond') {
        // Yellow diamond
        ctx.beginPath();
        ctx.moveTo(legendX + 4, iy - 4);
        ctx.lineTo(legendX + 7, iy);
        ctx.lineTo(legendX + 4, iy + 4);
        ctx.lineTo(legendX + 1, iy);
        ctx.closePath();
        ctx.fillStyle = item.color;
        ctx.fill();
      } else if (item.shape === 'crosshair') {
        // Crosshair icon
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
        // Colored dot
        ctx.beginPath();
        ctx.arc(legendX + 4, iy, 3, 0, 2 * Math.PI);
        ctx.fillStyle = item.color;
        ctx.fill();
      }

      ctx.fillStyle = '#94a3b8';
      ctx.fillText(item.label, legendX + 12, iy + 3);
      legendY -= 14;
    }

    // Continue animation loop if there are recent pulses
    const hasActivePulses = Array.from(lastUpdatedMap.values()).some(t => now - t < 1500);
    if (hasActivePulses) {
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
