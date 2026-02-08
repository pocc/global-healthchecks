# Impossible / Limited Features

Features that are not possible or have significant limitations due to the Cloudflare Workers runtime, the `cloudflare:sockets` API, or the `node:tls` compatibility layer.

---

## Networking

### IPv6 Connections

**Status:** Not supported

The `cloudflare:sockets` `connect()` API does not support IPv6 addresses. Passing an IPv6 address (e.g. `2001:4860:4860::8888`) results in:

```
"proxy request failed, cannot connect to the specified address. It looks like you might be trying to connect to a HTTP-based service — consider using fetch instead"
```

DNS resolution to AAAA records works (via DoH in the frontend), but the worker cannot open a TCP socket to an IPv6 address.

**Workaround:** Use IPv4 addresses or hostnames that resolve to IPv4.

### UDP Connections

**Status:** Not supported

Cloudflare Workers Sockets API only supports TCP. There is no UDP socket primitive. This means:
- DNS over UDP cannot be tested (we use DoH instead)
- QUIC/HTTP3 testing is not possible
- Any UDP-based protocol (TFTP, SNMP over UDP, etc.) cannot be tested

### Connecting to Internal/Private IPs

**Status:** Blocked by Cloudflare

Connections to `localhost`, `127.0.0.1`, `0.0.0.0`, `10.x.x.x`, `192.168.x.x`, and other RFC 1918 private addresses are blocked by Cloudflare's proxy layer:

```
"proxy request failed, cannot connect to the specified address..."
```

This is a security measure to prevent SSRF attacks from Workers.

### Connecting to Cloudflare IPs (AS13335)

**Status:** Blocked by Cloudflare

Connections to IP addresses within Cloudflare's own network (AS13335) are blocked. This prevents testing sites behind Cloudflare's CDN by IP. The worker detects this via ASN lookup and warns the user before attempting.

### Raw Socket Options (SO_REUSEADDR, TCP_NODELAY, etc.)

**Status:** Not exposed

The `cloudflare:sockets` API does not expose low-level socket options. `keepAlive` and `keepAliveInitialDelay` are accepted in the API but the underlying socket behavior is managed by Cloudflare's proxy layer.

---

## TLS

### `rejectUnauthorized` (Certificate Validation)

**Status:** Partially working

In the Cloudflare Workers runtime, `rejectUnauthorized: false` is the effective default — the `node:tls` compatibility layer does not validate server certificates against the system trust store by default. Setting `rejectUnauthorized: true` without a custom CA bundle may not work as expected.

When a custom `caBundlePem` is provided, `rejectUnauthorized: true` is set, and the certificate is validated against the custom CA. Without a custom CA, certificates are not validated.

### `maxTlsVersion` Constraints in Miniflare (Local Dev)

**Status:** Limited in local development

In the local Miniflare/workerd environment, `maxVersion` on TLS connections may not be enforced the same way as in production. Setting `maxTlsVersion: "TLSv1.2"` may still negotiate TLSv1.3 locally. This works correctly in production on Cloudflare's edge.

### `getPeerCertificate().fingerprint256`

**Status:** Not available in local development

The `socket.getPeerCertificate()` method exists in the Workers runtime but `fingerprint256` may be `undefined` locally (Miniflare). In production, it works. This means certificate pinning (`pinnedPublicKey`) cannot be tested locally.

### OCSP Stapling (`requestOCSP`)

**Status:** Not supported

The `node:tls` compatibility layer in Cloudflare Workers does not support the `requestOCSP` socket option. The `ocspStapling` field in the API is accepted but has no effect — it is reserved for future support if Cloudflare adds this capability.

### TLS Session Resumption / Session Tickets

**Status:** Not exposed

There is no API to control or inspect TLS session resumption (session IDs or session tickets). Each connection performs a full handshake.

### Client Certificate Verification Result

**Status:** Not inspectable

When using mTLS (`clientCert` + `clientKey`), the API sends the client certificate during the handshake, but there is no way to inspect whether the server accepted or rejected it beyond the connection succeeding or failing.

---

## HTTP

### HTTP/2 and HTTP/3

**Status:** Not supported

The HTTP testing uses raw HTTP/1.1 over TLS (manual `socket.write()` of HTTP request lines). HTTP/2 (h2) requires ALPN negotiation and binary framing, and HTTP/3 requires QUIC (UDP). Neither is implementable with the current `node:tls` socket approach.

### Response Body Inspection

**Status:** Not implemented (by design)

The worker reads only the first 2048 bytes of the HTTP response to extract the status line and headers. Response bodies are not captured or returned. This is intentional to keep responses small and avoid memory issues.

### Cookie Handling Across Redirects

**Status:** Not supported

When following redirects, cookies set by intermediate responses (via `Set-Cookie` headers) are not forwarded to subsequent requests. Each redirect is a fresh connection.

---

## Platform

### Cross-Datacenter Result Aggregation

**Status:** Not possible without Durable Objects or external storage

Each Cloudflare Worker isolate runs independently in a single datacenter. There is no shared memory or state between isolates across different datacenters. To aggregate results from multiple datacenters, you would need:
- **Durable Objects** — singleton coordination across the network
- **Workers KV** — eventually-consistent key-value storage
- **External database** — e.g. D1, Turso, or a database service

The current in-memory result cache (`/api/results`) only stores results from the current isolate.

### Controlling Which Datacenter Handles a Request

**Status:** Limited

Cloudflare routes requests to the nearest datacenter by default. There is no API to force a request to a specific datacenter. Smart Placement can influence placement based on back-end proximity, but it doesn't guarantee a specific colo. The `cf-placement` header reports where the worker ran but cannot be used to select it.

### Worker CPU Time Limits

**Status:** Hard limit

Workers have a CPU time limit (typically 30 seconds on paid plans, 10ms on free). Long-running tests with high retry counts and timeouts can approach this limit. The wall-clock timeout is 30 seconds.

### Concurrent Connection Limits

**Status:** Limited

Each worker invocation can open a limited number of concurrent sockets. The batch endpoint caps at 10 parallel checks to stay within these limits.

### WebSocket Testing

**Status:** Not feasible with current architecture

The health check system uses raw TCP sockets via `cloudflare:sockets` to measure TCP handshake, TLS negotiation, and HTTP timing independently. WebSocket requires an HTTP Upgrade handshake (RFC 6455) which is a fundamentally different flow — it begins as HTTP, then switches protocols mid-connection. Implementing WebSocket testing would require:

1. Manually implementing the WebSocket upgrade protocol over raw TCP sockets (complex, fragile)
2. Or using `fetch()` with WebSocket upgrade, which bypasses the TCP/TLS timing breakdown entirely

Neither approach integrates with the existing layered timing model (tcpMs → tlsHandshakeMs → httpMs).
