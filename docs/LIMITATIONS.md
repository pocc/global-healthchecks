# Limitations

Constraints of the Cloudflare Workers runtime and the `cloudflare:sockets` API.

## Network

| Can't do | Why / workaround |
|---|---|
| UDP: QUIC, HTTP/3, DNS over UDP, SNMP, NTP | The Sockets API is TCP-only |
| ICMP: ping, traceroute, MTU discovery | No raw sockets |
| Unbracketed IPv6 literals | `2001:db8::1` fails; write `[2001:db8::1]` |
| Targets on Cloudflare's network (AS13335) | Cloudflare blocks sockets to its own IP ranges; you get `proxy request failed …`. The UI detects this and asks for the origin IP. |
| Private/internal targets | RFC 1918, loopback, link-local, CGNAT, multicast and other reserved ranges (in any IPv4/IPv6 notation), plus `.localhost`, `.internal`, `.local` and `.home.arpa` names, are rejected by the Worker; Cloudflare also blocks localhost and private IPs. |
| Socket options (`TCP_NODELAY`, keep-alive, idle timeout) | Not exposed by the API. |
| Choosing the exact data center | Placement picks it; read `cf-placement` (see [METHODOLOGY.md](METHODOLOGY.md#verifying-where-a-check-ran)). |

## TLS

| Can't do | Why |
|---|---|
| Pick TLS version or cipher suite | `connect()` has no such options. |
| Report negotiated version or cipher | Not exposed. |
| mTLS client certificates | `connect()` has no client certificate option. |
| Custom CA bundle, certificate pinning | `connect()` has no such options. |
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

- **One target per request:** each `/api/check` checks one host and port; there is no batch endpoint.
- **No shared state:** Workers in different data centers share nothing; the UI collects results in your browser.
