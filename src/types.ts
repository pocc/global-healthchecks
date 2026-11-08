export interface TestResult {
  region: string;
  regionName: string;
  status: 'pending' | 'connected' | 'failed';
  sent: number;
  received: number;
  latencies: number[];
  pingHistory: Array<{ ms: number | null; ts: number }>;
  lastError?: string;
  colo?: string;
  coloCity?: string;
  cfPlacement?: string;
  lastMs?: number; // most recent latencyMs (edge → origin)
  fetchMs?: number; // browser-side fetch duration (includes routing overhead)
  tcpMs?: number;
  /** Not currently populated — cloudflare:sockets connect() does not expose TLS session details */
  tlsVersion?: string;
  /** Not currently populated — cloudflare:sockets connect() does not expose TLS session details */
  tlsCipher?: string;
  tlsHandshakeMs?: number;
  httpStatusCode?: number;
  httpStatusText?: string;
  httpVersion?: string;
  httpMs?: number;
  resolvedIp?: string;
}

export interface HomeLocation {
  lat: number;
  lng: number;
  city?: string;
  country?: string;
  colo?: string;
}

export interface TargetLocation {
  lat: number;
  lng: number;
  city?: string;
  country?: string;
}

export type Continent = 'North America' | 'South America' | 'Europe' | 'Asia Pacific' | 'Middle East' | 'Africa' | 'Oceania';
