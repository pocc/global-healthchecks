# Limitations

Constraints of the Cloudflare Workers runtime and the `cloudflare:sockets` API.

## Network

| Can't do | Why / workaround |
|---|---|
| UDP: QUIC, HTTP/3, DNS over UDP, SNMP, NTP | The Sockets API is TCP-only |
| ICMP: ping, traceroute, MTU discovery | No raw sockets |
| Unbracketed IPv6 literals | `2001:db8::1` fails; write `[2001:db8::1]` |
| Targets on Cloudflare's network (AS13335) | Cloudflare blocks sockets to its own IP ranges; you get `proxy request failed …`. The UI detects this and asks for the origin IP. |
| Private/internal targets | RFC 1918, loopback, link-local, CGNAT, `.internal` and `.localhost` are rejected by the Worker; Cloudflare also blocks localhost and private IPs. |
| Socket options (`TCP_NODELAY`, keep-alive, idle timeout) | Not exposed by the API; these request fields are ignored. |
| Choosing the exact data center | Placement picks it; read `cf-placement` (see [METHODOLOGY.md](METHODOLOGY.md#verifying-where-a-check-ran)). |

## TLS

| Can't do | Why |
|---|---|
| Pick TLS version or cipher suite | `connect()` has no such options; `minTlsVersion`, `maxTlsVersion` and `ciphers` are ignored. |
| Report negotiated version or cipher | Not exposed. |
| mTLS client certificates | No client certificate option; `clientCert` and `clientKey` are ignored. |
| Custom CA bundle, certificate pinning | No such options; `caBundlePem` and `pinnedPublicKey` are ignored. |
| Test hosts with invalid certificates | Expired, self-signed and other invalid certificates fail the TLS phase with a generic `proxy request failed …` error. |
| OCSP stapling, session resumption control | Not exposed. |
| SNI different from `host` | SNI always equals `host`; `tlsServername` only changes the HTTP `Host` header. |

## HTTP

| Can't do | Why |
|---|---|
| HTTP/2 or HTTP/3 | Requests are hand-written HTTP/1.1 over TLS; no ALPN or QUIC. |
| Plain-text HTTP (port 80 without TLS) | HTTP mode always uses TLS. Use TCP mode for port 80 reachability. |
| Response bodies | Only the first chunk received is read. |
| Cookies across redirects | Each hop is a fresh connection with no cookie jar. |
| WebSocket upgrade | Not implemented. |

## Platform

- **6 connections opening at once:** each Worker invocation can have at most six connections being set up at once; extra ones queue. A TLS or HTTP check uses two sockets, so `/api/batch-check` with several TLS checks queues, and later results include the wait. Use one `/api/check` per target for accurate timings.
- **Batch size:** at most 10 checks per `/api/batch-check` request.
- **No shared state:** Workers in different data centers share nothing; the UI collects results in your browser.
