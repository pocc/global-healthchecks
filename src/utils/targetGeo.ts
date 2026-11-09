import type { TargetLocation } from '../types';

type Fetch = typeof fetch;

interface GeoProvider {
  name: string;
  url: (ip: string) => string;
  parse: (data: unknown) => TargetLocation | null;
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

const toLocation = (lat: unknown, lng: unknown, city: unknown, country: unknown): TargetLocation | null => {
  const la = num(lat);
  const lo = num(lng);
  if (la === null || lo === null || (la === 0 && lo === 0)) return null;
  return {
    lat: la,
    lng: lo,
    city: typeof city === 'string' && city ? city : undefined,
    country: typeof country === 'string' && country ? country : undefined,
  };
};

/**
 * Geo-IP providers called directly from the browser. Both send
 * `Access-Control-Allow-Origin: *` and need no key. They must also be listed in the
 * Worker's CSP connect-src (src/worker.ts). Calling from the browser spreads rate
 * limits across users instead of pooling them on Cloudflare's egress IPs, which these
 * providers block or challenge (issue #1).
 */
export const GEO_PROVIDERS: GeoProvider[] = [
  {
    name: 'ipwho.is',
    url: (ip) => `https://ipwho.is/${encodeURIComponent(ip)}`,
    parse: (d) => {
      const r = d as { success?: boolean; latitude?: unknown; longitude?: unknown; city?: unknown; country?: unknown };
      return r?.success === false ? null : toLocation(r?.latitude, r?.longitude, r?.city, r?.country);
    },
  },
  {
    name: 'geojs.io',
    url: (ip) => `https://get.geojs.io/v1/ip/geo/${encodeURIComponent(ip)}.json`,
    parse: (d) => {
      const r = d as { latitude?: unknown; longitude?: unknown; city?: unknown; country?: unknown };
      return toLocation(r?.latitude, r?.longitude, r?.city, r?.country);
    },
  },
  {
    // Last resort: the Worker proxy (same origin, so no CORS or CSP changes needed)
    name: '/api/geo-lookup',
    url: (ip) => `/api/geo-lookup?ip=${encodeURIComponent(ip)}`,
    parse: (d) => {
      const r = d as { lat?: unknown; lng?: unknown; city?: unknown; country?: unknown };
      return toLocation(r?.lat, r?.lng, r?.city, r?.country);
    },
  },
];

/**
 * Locate an IP for the world map, trying each provider in order.
 * Returns null if every provider fails. Rethrows AbortError so callers can bail out.
 */
export async function lookupTargetGeo(
  ip: string,
  signal?: AbortSignal,
  fetchImpl: Fetch = fetch,
  providers: GeoProvider[] = GEO_PROVIDERS,
): Promise<TargetLocation | null> {
  for (const provider of providers) {
    try {
      const res = await fetchImpl(provider.url(ip), { signal });
      if (!res.ok) continue;
      const result = provider.parse(await res.json());
      if (result) return result;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') throw err;
      // Network/CORS/parse error: try the next provider
    }
  }
  return null;
}
