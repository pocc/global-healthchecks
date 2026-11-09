# API

Base URL: `https://healthchecks.ross.gg` or any location host `https://<env>.healthchecks.ross.gg` (see [METHODOLOGY.md](METHODOLOGY.md#where-checks-run)). No authentication. CORS is open (`*`) and exposes `cf-placement` and `cf-ray`.

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/check` | POST | One TCP, TLS or HTTP check |
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
| `host` | string | required | all | Hostname, IPv4, or IPv6 **in brackets** (`[2001:db8::1]`). Private, loopback, link-local, CGNAT, multicast and other reserved ranges are rejected in any notation (e.g. `127.1`, `0x7f.0.0.1`), as are `.localhost`, `.internal`, `.local` and `.home.arpa` names. |
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

Any other fields are ignored. TLS version, cipher suites, client certificates, custom CAs, pinning, keep-alive and idle timeouts can't be set; see [LIMITATIONS.md](LIMITATIONS.md).

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

## `GET /api/geo`

```json
{ "lat": 30.27, "lng": -97.74, "city": "Austin", "country": "US", "colo": "AUS" }
```

## `GET /api/geo-lookup?ip=<ip>`

Returns `{ "lat", "lng", "city", "country" }`. Tries ipwho.is, then freeipapi.com, then reallyfreegeoip.org; returns `503` if all fail. Successful responses are cached for 1 hour.

These providers often refuse requests from Cloudflare's network, so the web UI looks up target locations directly from the browser (ipwho.is, then geojs.io) and only falls back to this endpoint.

## `GET /api/datacenters`

```json
{ "count": 352, "datacenters": [ { "code": "ACC", "city": "Accra, Ghana" }, … ] }
```

The list comes from the Worker's built-in table and can lag behind Cloudflare's current locations. Cached 24 hours.
