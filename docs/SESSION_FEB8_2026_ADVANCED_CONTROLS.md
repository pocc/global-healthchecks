# Session: Advanced Controls, URL Sync & L4/TLS Features
## Date: February 8, 2026 (Continuation)

## Overview

This session added URL query string synchronization, TLS Advanced options (mTLS, CA bundles, OCSP, cert pinning), Layer 4 TCP controls (timeouts, keep-alive, retry logic), and several UX refinements.

## Features Implemented

### 1. URL Query String Synchronization

All configuration state is now synced bidirectionally with the URL query string, enabling shareable/bookmarkable configs.

**Reading from URL on init:**
- All `useState` calls read from `URLSearchParams` with sensible defaults
- Advanced sections auto-expand if their params are present in the URL

**Writing to URL on change:**
- `useEffect` watches all config state and calls `window.history.replaceState()`
- Only non-default values are included to keep URLs clean
- Removed the previous URL update from `runTest()` (the effect handles it)

**Query parameter mapping:**

| Param | State | Default |
|-------|-------|---------|
| `hostname` | host | `amazon.com` |
| `port` | port | `443` |
| `layer` | layer | `l4` |
| `connectTimeout` | connectTimeout | `5000` |
| `totalTimeout` | totalTimeout | `10000` |
| `idleTimeout` | idleTimeout | (empty) |
| `keepAlive` | tcpKeepAlive | `false` |
| `keepAliveDelay` | keepAliveDelay | `1000` |
| `retries` | retryCount | `0` |
| `backoff` | retryBackoff | `false` |
| `doh` | dohProvider | `https://cloudflare-dns.com/dns-query` |
| `dns` | dnsRecordType | `A` |
| `sni` | tlsServername | (matches hostname) |
| `minTls` | minTlsVersion | (empty/Auto) |
| `maxTls` | maxTlsVersion | (empty/Auto) |
| `ciphers` | selectedCiphers | (empty = all) |
| `method` | httpMethod | `HEAD` |
| `path` | httpPath | `/` |
| `expect` | expectedStatus | `200` |
| `headers` | httpHeadersRaw | base64-encoded if non-default |
| `redirects` | followRedirects | `false` |
| `maxRedirects` | maxRedirects | `5` |
| `auth` | httpAuthType | `none` |
| `user` | httpAuthUser | (empty) |
| `ocsp` | ocspStapling | `false` |
| `pin` | pinnedPublicKey | (empty) |

### 2. TLS Advanced Collapsible

Cipher suites moved from the main TLS section into a new "Advanced" collapsible, alongside new features:

**Restructured TLS Configuration UI:**
1. Servername (SNI) - text input
2. Min/Max TLS Version - 2-column grid
3. Advanced (collapsible):
   - Cipher Suites (with sub-collapsible, expanded by default)
   - Mutual TLS (mTLS) - Client Certificate + Private Key textareas (PEM)
   - Custom Trust Store - CA Bundle textarea (PEM)
   - OCSP Stapling - checkbox
   - Certificate Pinning - SHA-256 public key hash input

**Worker implementation:**
- `clientCert` and `clientKey` passed as `cert`/`key` to `tls.connect()` options
- `caBundlePem` passed as `ca` option, enables `rejectUnauthorized` when present
- Certificate pinning: compares `socket.getPeerCertificate().fingerprint256` against provided hash after TLS handshake, fails with descriptive error on mismatch
- Applied to both `testTlsPort` and `testHttpPort`

### 3. Layer 4 TCP Controls

Added a TCP configuration section visible in both L4 and L7 modes:

**Always visible:**
- Connect Timeout (ms) - default 5000, like `curl --connect-timeout`
- Total Timeout (ms) - default 10000, like `curl -m/--max-time`

**Advanced collapsible:**
- Idle Timeout - `socket.setTimeout()` for idle detection
- TCP Keep-Alive - enable/disable with configurable initial delay (ms)
- Retry Logic - configurable retry count with optional exponential backoff + jitter

**Worker implementation:**
- `testTcpPort` refactored into `singleTcpAttempt` + retry wrapper
- Retry loop uses exponential backoff: `2^attempt * 100ms` base + random jitter (0-50% of base)
- `connectTimeout` used for the TCP handshake timeout promise

### 4. UX Refinements

- **DoH default changed**: Cloudflare DNS is now the default DoH provider (was Google). Button order: Cloudflare, Google, Quad9.
- **"Last" column removed**: Redundant with Avg/Best/Worst and per-phase TCP/TLS/TTFB columns. Removed from table headers, body cells, CSV export, and colSpan calculations.
- **Em dashes replaced**: All `---` (em dashes) and `&mdash;` HTML entities replaced with standard punctuation (commas, colons, hyphens) across App.tsx, worker.ts, and WorldMap.tsx.
- **Curly apostrophes replaced**: `&rsquo;` entities replaced with standard apostrophes.

## Files Modified

- `src/App.tsx` - All frontend changes (state, URL sync, UI restructure)
- `src/worker.ts` - TLS options (mTLS, CA, pinning), TCP retry logic, interface updates
- `src/WorldMap.tsx` - Em dash cleanup

## HealthCheckRequest Interface (current)

```typescript
interface HealthCheckRequest {
  host: string;
  port: number;
  timeout?: number;
  connectTimeout?: number;
  idleTimeout?: number;
  keepAlive?: boolean;
  keepAliveInitialDelay?: number;
  retries?: number;
  retryBackoff?: boolean;
  region?: string;
  tlsEnabled?: boolean;
  tlsServername?: string;
  minTlsVersion?: string;
  maxTlsVersion?: string;
  ciphers?: string;
  clientCert?: string;
  clientKey?: string;
  caBundlePem?: string;
  ocspStapling?: boolean;
  pinnedPublicKey?: string;
  httpEnabled?: boolean;
  httpMethod?: string;
  httpPath?: string;
  httpHeaders?: Record<string, string>;
  followRedirects?: boolean;
  maxRedirects?: number;
}
```
