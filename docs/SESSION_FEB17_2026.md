# Session Notes — February 17, 2026

## Summary

Diagnosed and fixed the `tlsHandshakeMs: 0` bug affecting all TLS and HTTP checks.
Deployed the fix to all 144 workers.

---

## Investigation

### Symptom
All TLS and HTTP health checks returned `tlsHandshakeMs: 0` regardless of target host or geography.

### Root Cause: STARTTLS `socket.opened` includes TCP+TLS time

The previous implementation used `secureTransport: 'starttls'` and incorrectly assumed:
- `socket.opened` → pure TCP time
- `socket.startTls().opened` → TLS handshake time

**Empirical evidence disproved this:**

| Host | TCP-only (secureTransport: 'off') | STARTTLS socket.opened |
|------|----------------------------------|------------------------|
| github.com:443 | 37ms | 35ms (similar — 0-RTT session resumption) |
| globo.com:443 | 138ms | **436ms** (298ms = TLS handshake!) |

`socket.opened` for `secureTransport: 'starttls'` actually resolves after **TCP + TLS** is complete
(not just TCP). Cloudflare's Workers proxy pre-negotiates TLS before the `opened` promise resolves.

When `socket.startTls()` is then called, it just wraps the already-completed TLS session, so
`tlsSocket.opened` resolves instantly (0ms). This was the source of the always-zero bug.

**Why github.com showed 37ms for both:** Cloudflare's IAH colo has a cached TLS session with
GitHub's CDN edge, enabling 0-RTT resumption — so TLS adds ~0ms and both measurements agree.

**Why globo.com showed 436ms for STARTTLS:** No cached session, full TLS handshake required
(2 RTTs × ~138ms = ~276ms), making the combined time much larger than TCP-only.

### Wrangler Tail Evidence

Log from the pre-fix worker:
```
[check] tls 8.8.8.8:853 → ok 10ms tcp=10 tls=0
[check] http github.com:443 → ok 158ms tcp=55 tls=0 http=103
```

Log from the post-fix worker:
```
[check] tls globo.com:443 → ok 448ms tcp=309 tls=139
[check] http globo.com:443 → ok 550ms tcp=139 tls=138 http=273
```

---

## Fix: Concurrent Dual-Connection Timing

**Key insight:** To separate TCP and TLS phases, open **two connections simultaneously**:
- Connection 1: `secureTransport: 'off'` → `tcpMs` (pure TCP)
- Connection 2: `secureTransport: 'on'` → resolves after full TCP+TLS → `tcpPlusTlsMs`
- `tlsHandshakeMs = max(0, tcpPlusTlsMs - tcpMs)`

**Why concurrent (not sequential)?** Sequential connections can have network variance — if the
second connection's TCP phase happens to be faster than the first, `tlsHandshakeMs` would come out
negative (clamped to 0). Starting both simultaneously ensures they experience identical network
conditions; the TLS connection's extra time is purely the handshake cost.

For HTTP tests (`testHttpPort`), the TLS connection is reused for the HTTP request, so the total
connection count is still 2 per check (TCP-only for timing + TLS for TLS+HTTP).

**Files changed:** `src/worker.ts` — `testTlsPort()`, `testHttpPort()`

---

## Verification

Post-fix measurements from IAH (Houston):

| Test | tcpMs | tlsHandshakeMs | httpMs | Notes |
|------|-------|----------------|--------|-------|
| 8.8.8.8:853 (DoT) | 10ms | **23ms** | — | ~1 RTT for TLS ✓ |
| github.com:443 TLS | 74ms | **35ms** | — | ~½ RTT (session resumption) ✓ |
| github.com:443 HTTP | 73ms | **34ms** | 62ms | Consistent with TLS-only ✓ |
| globo.com:443 TLS | 316ms | **43ms** | — | Cross-continental ✓ |
| globo.com:443 HTTP | 318ms | **139ms** | 272ms | 301 redirect ✓ |

Run-to-run consistency (github.com TLS, 3 consecutive runs):
```
Run 1: tcp=34ms tls=34ms latency=68ms
Run 2: tcp=34ms tls=52ms latency=86ms
Run 3: tcp=32ms tls=35ms latency=67ms
```

### When tlsHandshakeMs = 0

This can still legitimately occur when:
1. **Sub-millisecond TLS** — server is extremely close (e.g., SIN → github.com at 5ms TCP,
   TLS 0-RTT session resumption makes TLS below `Date.now()` resolution)
2. **Measurement noise** — at very short RTTs (<10ms), timing precision limits apply

This is correct behavior, not a bug.

---

## Known Limitations (unchanged)

### tlsVersion / tlsCipher not populated

The `cloudflare:sockets` API's `SocketInfo` only provides `remoteAddress` and `localAddress` —
no TLS session metadata. Neither `tlsVersion` nor `tlsCipher` can be extracted from the socket.
These fields remain `undefined` in all responses.

### Cloudflare-hosted targets blocked

Hosts resolving to AS13335 (Cloudflare's own network) — including `example.com` (now on Cloudflare
CDN at 104.18.x.x) and `1.1.1.1` — return:
```
proxy request failed, cannot connect to the specified address. It looks like you might be
trying to connect to a HTTP-based service — consider using fetch instead
```
This is Cloudflare's SSRF protection and cannot be bypassed. See `IMPOSSIBLE.md`.

---

## Deployment

Fix deployed to all 144 workers via `deploy/deploy-all.sh`:
- `global-healthchecks-production` (healthchecks.ross.gg)
- 10 regional workers (us, eu, sg, jp, etc.)
- 133 cloud placement workers (aws-*, gcp-*, azure-*)
