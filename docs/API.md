# API

Base URL: `https://healthchecks.ross.gg` or any location host `https://<env>.healthchecks.ross.gg` (see [METHODOLOGY.md](METHODOLOGY.md#where-checks-run)). No authentication. CORS is open (`*`) and exposes `cf-placement` and `cf-ray`.

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/check` | POST | One TCP, TLS or HTTP check |
| `/api/batch-check` | POST | Up to 10 checks in parallel from the same location |
| `/api/geo` | GET | Caller's location as seen by Cloudflare |
| `/api/geo-lookup?ip=` | GET | Approximate location of an IP (proxied to public geo-IP services) |
| `/api/datacenters` | GET | Cloudflare colo codes and cities known to this Worker |

## `POST /api/check`

Mode is chosen by flags: `httpEnabled` → HTTP over TLS, else `tlsEnabled` → TLS, else TCP.

```bash
# TCP
curl -s -X POST https://healthchecks.ross.gg/api/check \
  -H 'Content-Type: application/json' -d '{"host":"github.com","port":22}'

# TLS
curl -s -X POST https://healthchecks.ross.gg/api/check \
  -H 'Content-Type: application/json' -d '{"host":"github.com","port":443,"tlsEnabled":true}'

# HTTP, follow redirects
curl -s -X POST https://healthchecks.ross.gg/api/check \
  -H 'Content-Type: application/json' \
  -d '{"host":"google.com","port":443,"httpEnabled":true,"followRedirects":true}'
```

### Request fields

| Field | Type | Default | Applies to | Notes |
|---|---|---|---|---|
| `host` | string | required | all | Hostname, IPv4, or IPv6 **in brackets** (`[2001:db8::1]`). Private/internal ranges rejected. |
| `port` | number | required | all | 1–65535 |
| `timeout` | number (ms) | `5000` | all | TLS/HTTP: per phase. TCP: fallback for `connectTimeout`. |
| `connectTimeout` | number (ms) | `timeout` | TCP | |
| `retries` | number | `0` | TCP | Retries on failure |
| `retryBackoff` | boolean | `false` | TCP | `2^n × 100 ms` + jitter instead of fixed 100 ms |
| `tlsEnabled` | boolean | `false` | TLS | |
| `httpEnabled` | boolean | `false` | HTTP | Implies TLS |
| `httpMethod` | string | `GET` | HTTP | `GET`, `HEAD`, `POST`, `OPTIONS`; anything else → `GET` |
| `httpPath` | string | `/` | HTTP | |
| `httpHeaders` | object | — | HTTP | `Host`, `Connection`, `Content-Length`, `Transfer-Encoding` are ignored |
| `tlsServername` | string | `host` | HTTP | Sets the `Host` header only. SNI is always `host`. |
| `followRedirects` | boolean | `false` | HTTP | Each hop is a new connection |
| `maxRedirects` | number | `5` | HTTP | |
| `region` | string | — | all | Echoed back in the result; not used |

Accepted but **ignored** because the Sockets API doesn't support them (see [LIMITATIONS.md](LIMITATIONS.md)): `idleTimeout`, `keepAlive`, `keepAliveInitialDelay`, `minTlsVersion`, `maxTlsVersion`, `ciphers`, `clientCert`, `clientKey`, `caBundlePem`, `ocspStapling`, `pinnedPublicKey`.

### Response fields

| Field | When | Meaning |
|---|---|---|
| `success` | always | TCP/TLS: connection opened. HTTP: status < 500. |
| `latencyMs` | always | TCP: = `tcpMs`. TLS: TCP + TLS. HTTP: whole check (final hop only if redirects were followed). |
| `error` | on failure | e.g. `proxy request failed, cannot connect to the specified address`, `Connection timeout`, `TLS connection timeout`, `Response timeout`, `Redirect to blocked host: …` |
| `tcpMs` | see note | TCP connect time, including DNS for hostnames |
| `tlsHandshakeMs` | TLS, HTTP success | TLS handshake time |
| `httpMs` | HTTP success | Time to first byte |
| `httpStatusCode`, `httpStatusText`, `httpVersion` | HTTP success | From the status line |
| `redirectCount`, `redirectUrl` | HTTP + redirects | Timings are for the final hop |
| `colo`, `coloCity` | always | Data center your API request entered Cloudflare through (not where a placed Worker ran; use the `cf-placement` header) |
| `cfRay` | always | Ray ID of the API request |
| `clientTcpRtt` | HTTP/1 and HTTP/2 clients | Your RTT to Cloudflare's edge (ms) |
| `timestamp` | always | Unix ms |
| `_debug` | always | Internal; may change without notice |

`tcpMs` note: in TCP and TLS mode it is always present; on failure it is the time until the error. In HTTP mode it is omitted if the TCP connection failed.

### Errors

| Status | Cause |
|---|---|
| 400 | Missing `host`/`port`, port out of range, blocked host, malformed JSON |

Connection failures are **not** HTTP errors: they return 200 with `success: false` and `error`.

## `POST /api/batch-check`

```bash
curl -s -X POST https://healthchecks.ross.gg/api/batch-check \
  -H 'Content-Type: application/json' \
  -d '{"checks":[{"host":"github.com","port":443},{"host":"github.com","port":22}]}'
```

Body: `{ "checks": [ <check request>, … ] }`, 1–10 items. Returns `{ "results": [ … ] }` in the same order. Results don't include `colo`, `cfRay` or `clientTcpRtt`; read `cf-ray` from the response headers instead.

Checks share one Worker invocation, which can only have 6 connections opening at once, so larger batches queue and later results include the wait. For accurate timings, use one `/api/check` per target. See [LIMITATIONS.md](LIMITATIONS.md#platform).

## `GET /api/geo`

```json
{ "lat": 30.27, "lng": -97.74, "city": "Austin", "country": "US", "colo": "AUS" }
```

## `GET /api/geo-lookup?ip=<ip>`

Returns `{ "lat", "lng", "city", "country" }`. Tries ipwho.is, then freeipapi.com, then reallyfreegeoip.org; returns `503` if all fail. Successful responses are cached for 1 hour.

## `GET /api/datacenters`

```json
{ "count": 334, "datacenters": [ { "code": "ACC", "city": "Accra, Ghana" }, … ] }
```

The list comes from the Worker's built-in table and can lag behind Cloudflare's current locations. Cached 24 hours.
