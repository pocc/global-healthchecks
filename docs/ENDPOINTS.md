# API Endpoints Reference

Complete reference for all HTTP endpoints exposed by the Handshake Speed worker.

## Authentication

All `/api/*` endpoints require a `secret` query parameter, **except `/api/geo` and `/api/datacenters`**.

| Header | Value |
|--------|-------|
| `Content-Type` | `application/json` (for POST requests) |

Authentication failures return:
```json
{ "error": "Unauthorized: invalid or missing secret parameter" }
```

---

## `GET /api/geo`

Returns the caller's geolocation as seen by the Cloudflare edge. **No authentication required.**

### Request

No query parameters or body needed.

```bash
curl -s https://healthchecks.ross.gg/api/geo
```

### Response

```json
{
  "lat": 30.27,
  "lng": -97.74,
  "city": "Austin",
  "country": "US",
  "colo": "IAH"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `lat` | `number \| null` | Latitude from `request.cf.latitude` |
| `lng` | `number \| null` | Longitude from `request.cf.longitude` |
| `city` | `string \| null` | City from `request.cf.city` |
| `country` | `string \| null` | Country code from `request.cf.country` |
| `colo` | `string \| null` | Cloudflare datacenter IATA code from `request.cf.colo` |

### Headers

| Header | Value |
|--------|-------|
| `Cache-Control` | `no-store` |
| `Access-Control-Allow-Origin` | `*` |

---

## `POST /api/check?secret=<SECRET>`

Execute a single health check (TCP, TLS, or HTTP) from the Cloudflare edge.

### Request Body — `HealthCheckRequest`

#### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `host` | `string` | Hostname or IPv4 address to connect to |
| `port` | `number` | TCP port number (1–65535) |

#### TCP Options (Layer 4)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `timeout` | `number` | `5000` | Total operation timeout in ms |
| `connectTimeout` | `number` | `5000` | TCP handshake timeout in ms |
| `idleTimeout` | `number` | — | Socket idle timeout in ms |
| `keepAlive` | `boolean` | `false` | Enable TCP keep-alive |
| `keepAliveInitialDelay` | `number` | `1000` | Keep-alive initial delay in ms |
| `retries` | `number` | `0` | Retry attempts on failure |
| `retryBackoff` | `boolean` | `false` | Exponential backoff (2^n × 100ms + jitter) |
| `region` | `string` | — | Cloud region hint (for Smart Placement) |

#### TLS Options (Layer 5/6)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `tlsEnabled` | `boolean` | `false` | Enable TLS handshake |
| `tlsServername` | `string` | `host` | SNI servername override |
| `minTlsVersion` | `string` | auto | Min TLS: `TLSv1`, `TLSv1.1`, `TLSv1.2`, `TLSv1.3` |
| `maxTlsVersion` | `string` | auto | Max TLS version (same values) |
| `ciphers` | `string` | all | Colon-separated OpenSSL cipher list |
| `clientCert` | `string` | — | PEM client certificate (mTLS) |
| `clientKey` | `string` | — | PEM private key (mTLS) |
| `caBundlePem` | `string` | — | PEM CA bundle (custom trust store) |
| `ocspStapling` | `boolean` | `false` | Request OCSP stapling |
| `pinnedPublicKey` | `string` | — | SHA-256 hash for cert pinning |

#### HTTP Options (Layer 7)

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `httpEnabled` | `boolean` | `false` | Enable HTTP request |
| `httpMethod` | `string` | `HEAD` | HTTP method: `GET`, `HEAD`, `POST`, `OPTIONS` |
| `httpPath` | `string` | `/` | Request path |
| `httpHeaders` | `Record<string, string>` | — | Custom HTTP headers |
| `followRedirects` | `boolean` | `false` | Follow 3xx redirects |
| `maxRedirects` | `number` | `5` | Maximum redirects to follow |

### Response — `HealthCheckResult`

#### Core Fields (always present)

| Field | Type | Description |
|-------|------|-------------|
| `success` | `boolean` | `true` if connection succeeded (HTTP: status < 500) |
| `host` | `string` | Target hostname |
| `port` | `number` | Target port |
| `latencyMs` | `number` | Total operation time in ms |
| `error` | `string?` | Error message (on failure only) |
| `timestamp` | `number` | Unix timestamp in ms |
| `colo` | `string?` | Cloudflare datacenter IATA code |
| `coloCity` | `string?` | Human-readable city name |
| `cfRay` | `string?` | Cloudflare Ray ID |

#### TLS Fields (when `tlsEnabled` or `httpEnabled`)

| Field | Type | Description |
|-------|------|-------------|
| `tcpMs` | `number` | TCP three-way handshake time in ms |
| `tlsVersion` | `string` | Negotiated TLS version (e.g. `TLSv1.3`) |
| `tlsCipher` | `string` | Negotiated cipher suite name |
| `tlsHandshakeMs` | `number` | TLS handshake time in ms |

#### HTTP Fields (when `httpEnabled`)

| Field | Type | Description |
|-------|------|-------------|
| `httpStatusCode` | `number` | HTTP response status code |
| `httpStatusText` | `string` | HTTP status text (e.g. `OK`) |
| `httpVersion` | `string` | HTTP version (e.g. `HTTP/1.1`) |
| `httpMs` | `number` | Time to first byte after request sent |
| `redirectCount` | `number` | Number of redirects followed |
| `redirectUrl` | `string` | Final redirect destination URL |

### Error Responses

| Status | Condition | Body |
|--------|-----------|------|
| 401 | Missing/invalid `secret` | `{ "error": "Unauthorized: invalid or missing secret parameter" }` |
| 400 | Missing `host` or `port` | `{ "error": "Missing required fields: host and port" }` |
| 400 | Port out of range | `{ "error": "Port must be between 1 and 65535" }` |
| 400 | Malformed JSON | `{ "error": "<parse error message>" }` |

### Examples

```bash
# TCP only
curl -s -X POST "https://healthchecks.ross.gg/api/check?secret=$SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"host":"amazon.com","port":443}'

# TLS handshake
curl -s -X POST "https://healthchecks.ross.gg/api/check?secret=$SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"host":"amazon.com","port":443,"tlsEnabled":true}'

# Full HTTP with redirects
curl -s -X POST "https://healthchecks.ross.gg/api/check?secret=$SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"host":"google.com","port":443,"tlsEnabled":true,"httpEnabled":true,"httpMethod":"GET","followRedirects":true}'
```

---

## `GET /api/results?secret=<SECRET>`

Returns cached health check results from the current worker isolate. Results are stored in-memory for 60 seconds.

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `secret` | `string` | (required) | API secret |
| `since` | `number` | `Date.now() - 1000` | Unix timestamp (ms) — return results stored after this time |

### Response

```json
{
  "colo": "IAH",
  "coloCity": "Houston, TX",
  "count": 3,
  "since": 1770581400000,
  "results": [
    { "success": true, "host": "amazon.com", "port": 443, "latencyMs": 89, ... },
    { "success": true, "host": "google.com", "port": 443, "latencyMs": 72, ... }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `colo` | `string` | Datacenter that served this request |
| `coloCity` | `string` | Human-readable city name |
| `count` | `number` | Number of results returned |
| `since` | `number` | The `since` cutoff used |
| `results` | `HealthCheckResult[]` | Array of cached check results |

### Notes

- Results are per-isolate (not shared across datacenters). See [IMPOSSIBLE.md](IMPOSSIBLE.md#cross-datacenter-result-aggregation).
- Default window is 1 second. Pass `since=0` to get all cached results (up to 60s).
- Both `/api/check` and `/api/batch-check` results are cached.

```bash
# Get results from the last second
curl -s "https://healthchecks.ross.gg/api/results?secret=$SECRET"

# Get all cached results (last 60 seconds)
curl -s "https://healthchecks.ross.gg/api/results?secret=$SECRET&since=0"
```

---

## `GET /api/datacenters`

Returns all known Cloudflare datacenter locations. **No authentication required.**

### Response

```json
{
  "count": 333,
  "datacenters": [
    { "code": "IAH", "city": "Houston, TX" },
    { "code": "DFW", "city": "Dallas, TX" },
    ...
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `count` | `number` | Total number of datacenters |
| `datacenters` | `{ code: string; city: string }[]` | IATA code and city for each datacenter |

### Headers

| Header | Value |
|--------|-------|
| `Cache-Control` | `public, max-age=86400` (24h cache) |

```bash
curl -s https://healthchecks.ross.gg/api/datacenters
```

---

## `POST /api/batch-check?secret=<SECRET>`

Execute multiple health checks in parallel from the same Cloudflare edge.

### Request Body

```json
{
  "checks": [
    { "host": "amazon.com", "port": 443 },
    { "host": "google.com", "port": 443 },
    { "host": "github.com", "port": 22 }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| `checks` | `HealthCheckRequest[]` | Array of 1–10 check requests |

### Response

```json
{
  "results": [
    { "success": true, "host": "amazon.com", "port": 443, "latencyMs": 95, ... },
    { "success": true, "host": "google.com", "port": 443, "latencyMs": 87, ... },
    { "success": true, "host": "github.com", "port": 22, "latencyMs": 78, ... }
  ]
}
```

### Error Responses

| Status | Condition | Body |
|--------|-----------|------|
| 401 | Missing/invalid `secret` | `{ "error": "Unauthorized: ..." }` |
| 400 | Empty or non-array `checks` | `{ "error": "checks must be a non-empty array" }` |
| 400 | More than 10 checks | `{ "error": "Maximum 10 checks per batch" }` |
| 400 | Malformed JSON | `{ "error": "<parse error message>" }` |

---

## CORS

All API responses include CORS headers:

| Header | Value |
|--------|-------|
| `Access-Control-Allow-Origin` | `*` |
| `Access-Control-Allow-Methods` | `GET, POST, OPTIONS` |
| `Access-Control-Allow-Headers` | `Content-Type` |
| `Access-Control-Expose-Headers` | `cf-placement, cf-ray` |

`OPTIONS` requests are handled with a 200 and the above headers.

---

## Static Assets

Any request not matching `/api/*` is served by the `ASSETS` binding (Cloudflare Pages static assets — the React frontend).
