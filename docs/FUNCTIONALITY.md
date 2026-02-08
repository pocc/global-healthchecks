# Functionality Reference

Every feature of the Handshake Speed API mapped to its curl equivalent.

## Authentication

All `/api/*` endpoints require a `secret` query parameter matching the `API_SECRET` environment variable, **except `/api/geo`** which is unauthenticated (it only returns the caller's own location).

```bash
# /api/geo - no secret needed
curl -s https://healthchecks.ross.gg/api/geo
# {"lat":30.27,"lng":-97.74,"city":"Austin","country":"US","colo":"IAH"}

# /api/check - requires secret
curl -s "https://healthchecks.ross.gg/api/check?secret=$SECRET" ...
```

**Setup:**
- Local dev: `.dev.vars` file with `API_SECRET=<value>` (read by `wrangler dev`)
- Frontend build: `.env` file with `VITE_API_SECRET=<value>` (embedded by Vite)
- Production: `wrangler secret put API_SECRET` (stored in Cloudflare)

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/geo` | GET | Returns caller's geolocation from Cloudflare edge (no auth) |
| `/api/datacenters` | GET | Returns all known Cloudflare datacenter locations (no auth) |
| `/api/check?secret=` | POST | Single health check (TCP, TLS, or HTTP) |
| `/api/batch-check?secret=` | POST | Batch health check (up to 10 checks in parallel) |
| `/api/results?secret=` | GET | Returns cached check results from this isolate (default: last 1s) |

---

## Layer 4: TCP Connectivity

### Basic TCP Ping

Opens a raw TCP socket and measures the three-way handshake (SYN, SYN-ACK, ACK).

| JSON Field | curl Equivalent | Default | Description |
|------------|----------------|---------|-------------|
| `host` | Target hostname in URL | (required) | Hostname or IP to connect to |
| `port` | Target port in URL | (required) | TCP port number (1-65535) |
| `timeout` | `-m, --max-time` | `5000` | Total operation timeout in ms |
| `connectTimeout` | `--connect-timeout` | `5000` | TCP handshake timeout in ms |

```bash
# curl equivalent: curl --connect-timeout 5 -m 10 amazon.com:443
curl -s -X POST "http://localhost:8799/api/check?secret=$SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"host":"amazon.com","port":443}'
# {"success":true,"latencyMs":95}

# With explicit timeouts
curl -s -X POST "http://localhost:8799/api/check?secret=$SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"host":"amazon.com","port":443,"connectTimeout":2000,"timeout":10000}'
# {"success":true,"latencyMs":61}
```

### TCP Keep-Alive

| JSON Field | curl Equivalent | Default | Description |
|------------|----------------|---------|-------------|
| `keepAlive` | `--keepalive` | `false` | Enable TCP keep-alive |
| `keepAliveInitialDelay` | `--keepalive-time` | `1000` | Initial keep-alive delay in ms |

```bash
# curl equivalent: curl --keepalive --keepalive-time 1 amazon.com:443
curl -s -X POST "http://localhost:8799/api/check?secret=$SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"host":"amazon.com","port":443,"keepAlive":true,"keepAliveInitialDelay":1000}'
```

### Idle Timeout

| JSON Field | curl Equivalent | Default | Description |
|------------|----------------|---------|-------------|
| `idleTimeout` | `--speed-time` | (none) | Socket idle timeout in ms (socket.setTimeout) |

```bash
# curl equivalent: curl --speed-time 5 amazon.com:443
curl -s -X POST "http://localhost:8799/api/check?secret=$SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"host":"amazon.com","port":443,"idleTimeout":5000}'
```

### Retry Logic

| JSON Field | curl Equivalent | Default | Description |
|------------|----------------|---------|-------------|
| `retries` | `--retry` | `0` | Number of retry attempts on failure |
| `retryBackoff` | `--retry-all-errors` | `false` | Use exponential backoff (2^n * 100ms + jitter) |

```bash
# curl equivalent: curl --retry 3 --retry-all-errors amazon.com:443
curl -s -X POST "http://localhost:8799/api/check?secret=$SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"host":"amazon.com","port":443,"retries":3,"retryBackoff":true}'
# {"success":true,"latencyMs":67}
```

---

## Layer 5/6: TLS Handshake

Enable with `"tlsEnabled": true`. Reports negotiated TLS version, cipher, and handshake timing.

### Basic TLS

| JSON Field | curl Equivalent | Default | Description |
|------------|----------------|---------|-------------|
| `tlsEnabled` | (implicit with https://) | `false` | Enable TLS handshake |
| `tlsServername` | `--resolve` / SNI | hostname | Server Name Indication override |

```bash
# curl equivalent: curl -so /dev/null -w '%{time_connect} %{time_appconnect}' https://amazon.com
curl -s -X POST "http://localhost:8799/api/check?secret=$SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"host":"amazon.com","port":443,"tlsEnabled":true}'
# {"success":true,"latencyMs":123,"tlsHandshakeMs":123}

# With SNI override
# curl equivalent: curl --resolve www.amazon.com:443:52.94.236.248 https://www.amazon.com
curl -s -X POST "http://localhost:8799/api/check?secret=$SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"host":"amazon.com","port":443,"tlsEnabled":true,"tlsServername":"www.amazon.com"}'
# {"success":true,"latencyMs":121,"tlsHandshakeMs":121}
```

### TLS Version Constraints

| JSON Field | curl Equivalent | Default | Description |
|------------|----------------|---------|-------------|
| `minTlsVersion` | `--tlsv1.2`, `--tls-max 1.3` | Auto | Min TLS version: `TLSv1`, `TLSv1.1`, `TLSv1.2`, `TLSv1.3` |
| `maxTlsVersion` | `--tls-max` | Auto | Max TLS version (same values) |

```bash
# curl equivalent: curl --tlsv1.2 https://amazon.com
curl -s -X POST "http://localhost:8799/api/check?secret=$SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"host":"amazon.com","port":443,"tlsEnabled":true,"minTlsVersion":"TLSv1.2"}'
# {"success":true,"latencyMs":152,"tlsHandshakeMs":152}

# curl equivalent: curl --tls-max 1.2 https://amazon.com
curl -s -X POST "http://localhost:8799/api/check?secret=$SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"host":"amazon.com","port":443,"tlsEnabled":true,"maxTlsVersion":"TLSv1.2"}'
```

### Cipher Suite Selection

| JSON Field | curl Equivalent | Default | Description |
|------------|----------------|---------|-------------|
| `ciphers` | `--ciphers` | (all) | Colon-separated OpenSSL cipher list |

```bash
# curl equivalent: curl --ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384 https://amazon.com
curl -s -X POST "http://localhost:8799/api/check?secret=$SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"host":"amazon.com","port":443,"tlsEnabled":true,"ciphers":"ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384"}'
# {"success":true,"latencyMs":118,"tlsHandshakeMs":118}
```

### Mutual TLS (mTLS)

| JSON Field | curl Equivalent | Default | Description |
|------------|----------------|---------|-------------|
| `clientCert` | `--cert` | (none) | PEM-encoded client certificate |
| `clientKey` | `--key` | (none) | PEM-encoded private key |

```bash
# curl equivalent: curl --cert client.pem --key client-key.pem https://mtls.example.com
curl -s -X POST "http://localhost:8799/api/check?secret=$SECRET" \
  -H 'Content-Type: application/json' \
  -d '{
    "host":"mtls.example.com","port":443,"tlsEnabled":true,
    "clientCert":"-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----",
    "clientKey":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
  }'
```

### Custom Trust Store (CA Bundle)

| JSON Field | curl Equivalent | Default | Description |
|------------|----------------|---------|-------------|
| `caBundlePem` | `--cacert` | (system default) | PEM-encoded CA bundle for certificate verification |

```bash
# curl equivalent: curl --cacert /path/to/ca-bundle.pem https://internal.example.com
curl -s -X POST "http://localhost:8799/api/check?secret=$SECRET" \
  -H 'Content-Type: application/json' \
  -d '{
    "host":"internal.example.com","port":443,"tlsEnabled":true,
    "caBundlePem":"-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
  }'
```

When a custom CA is provided, `rejectUnauthorized` is enabled to validate the server certificate against it.

### OCSP Stapling

| JSON Field | curl Equivalent | Default | Description |
|------------|----------------|---------|-------------|
| `ocspStapling` | `--cert-status` | `false` | Request OCSP stapling |

```bash
# curl equivalent: curl --cert-status https://amazon.com
curl -s -X POST "http://localhost:8799/api/check?secret=$SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"host":"amazon.com","port":443,"tlsEnabled":true,"ocspStapling":true}'
```

Note: OCSP stapling is a request flag. The actual `requestOCSP` socket option is not available in CF Workers runtime; this field is reserved for future support.

### Certificate Pinning

| JSON Field | curl Equivalent | Default | Description |
|------------|----------------|---------|-------------|
| `pinnedPublicKey` | `--pinnedpubkey` | (none) | SHA-256 hash of expected public key |

```bash
# curl equivalent: curl --pinnedpubkey 'sha256//AAAA...' https://amazon.com
curl -s -X POST "http://localhost:8799/api/check?secret=$SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"host":"amazon.com","port":443,"tlsEnabled":true,"pinnedPublicKey":"sha256//YourExpectedHashHere"}'
```

Compares `socket.getPeerCertificate().fingerprint256` against the provided hash after TLS handshake. Fails with a descriptive error on mismatch.

---

## Layer 7: HTTP Request

Enable with `"httpEnabled": true` (also requires `"tlsEnabled": true`). Sends an HTTP request over the TLS connection and reports per-phase timing (TCP, TLS, TTFB).

### Basic HTTP

| JSON Field | curl Equivalent | Default | Description |
|------------|----------------|---------|-------------|
| `httpEnabled` | (implicit with URL) | `false` | Enable HTTP request |
| `httpMethod` | `-X, --request` | `HEAD` | HTTP method: GET, HEAD, POST, OPTIONS |
| `httpPath` | URL path | `/` | Request path |

```bash
# curl equivalent: curl -I https://amazon.com/
curl -s -X POST "http://localhost:8799/api/check?secret=$SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"host":"amazon.com","port":443,"tlsEnabled":true,"httpEnabled":true,"httpMethod":"HEAD","httpPath":"/"}'
# {"success":true,"tcpMs":128,"tlsHandshakeMs":126,"httpMs":58,"httpStatusCode":301,"httpStatusText":"Moved Permanently","httpVersion":"HTTP/1.1"}

# curl equivalent: curl https://amazon.com/
curl -s -X POST "http://localhost:8799/api/check?secret=$SECRET" \
  -H 'Content-Type: application/json' \
  -d '{"host":"amazon.com","port":443,"tlsEnabled":true,"httpEnabled":true,"httpMethod":"GET","httpPath":"/"}'
# {"success":true,"tcpMs":132,"tlsHandshakeMs":132,"httpMs":55,"httpStatusCode":301}
```

### Custom HTTP Headers

| JSON Field | curl Equivalent | Default | Description |
|------------|----------------|---------|-------------|
| `httpHeaders` | `-H, --header` | (none) | Key-value map of HTTP headers |

```bash
# curl equivalent: curl -H 'User-Agent: curl/8.0' -H 'Accept: */*' https://amazon.com
curl -s -X POST "http://localhost:8799/api/check?secret=$SECRET" \
  -H 'Content-Type: application/json' \
  -d '{
    "host":"amazon.com","port":443,"tlsEnabled":true,"httpEnabled":true,
    "httpMethod":"HEAD","httpPath":"/",
    "httpHeaders":{"User-Agent":"curl/8.0","Accept":"*/*"}
  }'
# {"success":true,"tcpMs":113,"tlsHandshakeMs":113,"httpMs":57,"httpStatusCode":301}
```

### Follow Redirects

| JSON Field | curl Equivalent | Default | Description |
|------------|----------------|---------|-------------|
| `followRedirects` | `-L, --location` | `false` | Follow 3xx redirects |
| `maxRedirects` | `--max-redirs` | `5` | Maximum number of redirects to follow |

```bash
# curl equivalent: curl -L --max-redirs 5 https://google.com
curl -s -X POST "http://localhost:8799/api/check?secret=$SECRET" \
  -H 'Content-Type: application/json' \
  -d '{
    "host":"google.com","port":443,"tlsEnabled":true,"httpEnabled":true,
    "httpMethod":"GET","httpPath":"/",
    "followRedirects":true,"maxRedirects":5
  }'
# {"success":true,"tcpMs":107,"tlsHandshakeMs":106,"httpMs":96,"httpStatusCode":200,"redirectCount":1,"redirectUrl":"https://www.google.com/"}
```

---

## Response Fields

Every response includes these core fields:

| Field | Description |
|-------|-------------|
| `success` | `true` if connection succeeded (HTTP: status < 500) |
| `host` | Target hostname |
| `port` | Target port |
| `latencyMs` | Total operation time in ms |
| `error` | Error message (on failure) |
| `timestamp` | Unix timestamp in ms |
| `colo` | Cloudflare data center IATA code (e.g., `IAH`) |
| `coloCity` | Human-readable city name (e.g., `Houston, TX`) |
| `cfRay` | Cloudflare Ray ID |
| `cfPlacement` | Worker placement info (for targeted placement endpoints) |

Additional fields by mode:

| Field | Mode | Description |
|-------|------|-------------|
| `tcpMs` | TLS, HTTP | TCP three-way handshake time in ms |
| `tlsVersion` | TLS, HTTP | Negotiated TLS version (e.g., `TLSv1.3`) |
| `tlsCipher` | TLS, HTTP | Negotiated cipher suite name |
| `tlsHandshakeMs` | TLS, HTTP | TLS handshake time in ms |
| `httpStatusCode` | HTTP | HTTP response status code |
| `httpStatusText` | HTTP | HTTP status text (e.g., `OK`) |
| `httpVersion` | HTTP | HTTP version (e.g., `HTTP/1.1`) |
| `httpMs` | HTTP | Time to first byte after request sent |
| `redirectCount` | HTTP | Number of redirects followed |
| `redirectUrl` | HTTP | Final redirect destination URL |

---

## Validation & Error Cases

```bash
# Missing host/port
curl -s -X POST "http://localhost:8799/api/check?secret=$SECRET" \
  -H 'Content-Type: application/json' -d '{"host":"","port":443}'
# {"error":"Missing required fields: host and port"}

# Invalid port range
curl -s -X POST "http://localhost:8799/api/check?secret=$SECRET" \
  -H 'Content-Type: application/json' -d '{"host":"amazon.com","port":99999}'
# {"error":"Port must be between 1 and 65535"}

# Connection timeout (closed port)
curl -s -X POST "http://localhost:8799/api/check?secret=$SECRET" \
  -H 'Content-Type: application/json' -d '{"host":"amazon.com","port":12345,"connectTimeout":3000}'
# {"success":false,"latencyMs":3000,"error":"Connection timeout"}
```

---

## Batch Checks

Send up to 10 checks in parallel:

```bash
curl -s -X POST "http://localhost:8799/api/batch-check?secret=$SECRET" \
  -H 'Content-Type: application/json' \
  -d '{
    "checks": [
      {"host":"amazon.com","port":443},
      {"host":"google.com","port":443},
      {"host":"github.com","port":443}
    ]
  }'
# {"results":[...]}
```

---

## Complete HealthCheckRequest Interface

```typescript
interface HealthCheckRequest {
  // Target
  host: string;                    // hostname or IP
  port: number;                    // 1-65535

  // Timeouts (L4)
  timeout?: number;                // total timeout (ms), like curl -m/--max-time
  connectTimeout?: number;         // TCP handshake timeout (ms), like curl --connect-timeout
  idleTimeout?: number;            // socket idle timeout (ms), like curl --speed-time

  // TCP options (L4)
  keepAlive?: boolean;             // like curl --keepalive
  keepAliveInitialDelay?: number;  // like curl --keepalive-time
  retries?: number;                // like curl --retry
  retryBackoff?: boolean;          // exponential backoff (2^n * 100ms + jitter)

  // Worker routing
  region?: string;                 // cloud region for targeted placement

  // TLS options (L5/L6)
  tlsEnabled?: boolean;            // enable TLS handshake
  tlsServername?: string;          // SNI override, like curl --resolve
  minTlsVersion?: string;         // like curl --tlsv1.2
  maxTlsVersion?: string;         // like curl --tls-max
  ciphers?: string;               // like curl --ciphers (colon-separated)
  clientCert?: string;            // like curl --cert (PEM)
  clientKey?: string;             // like curl --key (PEM)
  caBundlePem?: string;           // like curl --cacert (PEM)
  ocspStapling?: boolean;         // like curl --cert-status
  pinnedPublicKey?: string;       // like curl --pinnedpubkey (sha256//hash)

  // HTTP options (L7)
  httpEnabled?: boolean;           // enable HTTP request
  httpMethod?: string;             // like curl -X/--request
  httpPath?: string;               // URL path
  httpHeaders?: Record<string, string>; // like curl -H/--header
  followRedirects?: boolean;       // like curl -L/--location
  maxRedirects?: number;           // like curl --max-redirs
}
```

---

## Curl Flag Quick Reference

| curl Flag | JSON Field | Category |
|-----------|-----------|----------|
| `--connect-timeout` | `connectTimeout` | L4 TCP |
| `-m, --max-time` | `timeout` | L4 TCP |
| `--speed-time` | `idleTimeout` | L4 TCP |
| `--keepalive` | `keepAlive` | L4 TCP |
| `--keepalive-time` | `keepAliveInitialDelay` | L4 TCP |
| `--retry` | `retries` | L4 TCP |
| `--retry-all-errors` | `retryBackoff` | L4 TCP |
| `--tlsv1.2` | `minTlsVersion` | L5/L6 TLS |
| `--tls-max` | `maxTlsVersion` | L5/L6 TLS |
| `--ciphers` | `ciphers` | L5/L6 TLS |
| `--resolve` (SNI) | `tlsServername` | L5/L6 TLS |
| `--cert` | `clientCert` | L5/L6 TLS |
| `--key` | `clientKey` | L5/L6 TLS |
| `--cacert` | `caBundlePem` | L5/L6 TLS |
| `--cert-status` | `ocspStapling` | L5/L6 TLS |
| `--pinnedpubkey` | `pinnedPublicKey` | L5/L6 TLS |
| `-X, --request` | `httpMethod` | L7 HTTP |
| `-H, --header` | `httpHeaders` | L7 HTTP |
| `-L, --location` | `followRedirects` | L7 HTTP |
| `--max-redirs` | `maxRedirects` | L7 HTTP |
