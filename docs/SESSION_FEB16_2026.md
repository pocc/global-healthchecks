# Session Notes — February 16–17, 2026

## Summary

This session diagnosed and fixed several interrelated production issues that accumulated after deploying 144 workers without setting secrets on them.

---

## Issues Diagnosed & Fixed

### 1. `node:tls` dropped in favor of `cloudflare:sockets` STARTTLS

**Problem:** TLS and HTTP checks were returning `{}` (empty result objects) and all timing fields (`tcpMs`, `tlsHandshakeMs`, `httpMs`) were `undefined`. The `node:tls` approach relied on `connect` and `secureConnect` socket events that never fired reliably on Cloudflare Workers — TLS connections silently failed before any callback ran.

**Root cause:** `node:tls` is a compatibility shim in the Workers runtime. The `connect` event (which we used to measure `tcpMs`) and the TLS callback (which measured `tlsHandshakeMs`) are not reliably emitted. The result was that `tcpMs` was always `undefined`, and subsequent timing phases couldn't be calculated.

**Fix:** Rewrote `testTlsPort` and `testHttpPort` to use `cloudflare:sockets` with `secureTransport: 'starttls'`:
- Phase 1: `socket.opened` → `tcpMs`
- Phase 2: `socket.startTls().opened` → `tlsHandshakeMs`
- Phase 3: write HTTP request, read first chunk → `httpMs`

This gives clean, explicit per-phase timing using promise-based APIs with no event-listener ambiguity. All three timing fields are now populated correctly.

**Files changed:** `src/worker.ts` — `testTlsPort()`, `testHttpPort()`

---

### 2. `API_SECRET` missing from all cloud placement workers

**Problem:** After running `./deploy-all.sh` for the first time (144 workers), all `aws-*`, `gcp-*`, and `azure-*` placement workers returned `401 Unauthorized` on every request.

**Root cause:** Only `global-healthchecks-production` and `global-healthchecks-us` had `API_SECRET` set as a Cloudflare Worker secret. The other 142 workers had never had the secret set — they were brand new workers deployed from a fresh `wrangler.toml` expansion.

**Fix:** Created `deploy/push-secrets.sh` which:
1. Reads `API_SECRET` from `.dev.vars` (no hardcoded values)
2. Iterates all 144 environments from `wrangler.toml`
3. Checks if each worker already has the secret (skip if so)
4. Pushes the secret to any worker missing it

Result: 142 workers had the secret pushed, 2 skipped (already had it), 0 failed.

---

### 3. Datacenter dots showing wrong color before tests run

**Problem:** Before any test is run, the map showed all dots in dark gray (`#1e293b`) instead of their provider color (orange/yellow/green/blue). The provider colors only appeared after a test result came in.

**Root cause:** The dot rendering code gated colors on `demoActive`:
```typescript
if (!result || result.sent === 0) {
  ctx.fillStyle = demoActive ? '#1e293b' : '#475569';  // gray in both states
}
```

**Fix:** Always use `colors.dot` (the provider color) for untested datacenters:
```typescript
if (!result || result.sent === 0) {
  ctx.fillStyle = colors.dot;
}
```

**File changed:** `src/WorldMap.tsx`

---

### 4. Console log spam (300/sec)

**Removed from `src/App.tsx`:**
```javascript
// [${regionCode}] Full API Response: ...  (removed earlier this session)
// [${regionCode}] API Response timing: ...  (removed this session)
```

**Cleaned up from `src/worker.ts`:**
- `[testHttpPort] TLS connected - tcpMs before: ...`
- `[testHttpPort] Using fallback/connect event - ...`
- `[testHttpPort] connect event fired - ...`
- `[testHttpPort] Result: ...`
- `[/api/check] Request: ...` (combined into single result log)

**Kept:** One compact result log per request:
```
[check] http 1.2.3.4:443 → ok 312ms tcp=89 tls=156 http=67
[check] tcp 8.8.8.8:53 → fail 5001ms error=Connection timeout
```

---

### 5. Shell scripts organized into `deploy/` folder

All `*.sh` scripts were scattered in the repo root. Moved to `deploy/`:

| Script | Purpose |
|--------|---------|
| `deploy/deploy-all.sh` | Deploy all 144 workers from `wrangler.toml` |
| `deploy/push-secrets.sh` | Push `API_SECRET` to workers missing it (reads from `.dev.vars`) |
| `deploy/deploy-all-regions.sh` | Deploy regional workers only |
| `deploy/check-dns.sh` | Check DNS routes |
| `deploy/configure-dns.sh` | Configure DNS routes |

`push-secrets.sh` was also fixed to read `API_SECRET` from `.dev.vars` rather than hardcoding the value.

---

## Architecture Change: `node:tls` → `cloudflare:sockets` STARTTLS

The TLS and HTTP implementations were completely rewritten. Key differences:

| | Old (`node:tls`) | New (`cloudflare:sockets`) |
|---|---|---|
| TCP timing | `connect` event (unreliable) | `socket.opened` promise |
| TLS timing | TLS callback (unreliable) | `socket.startTls().opened` promise |
| HTTP timing | `socket.on('data', ...)` | `reader.read()` promise |
| Error handling | Event-based (`socket.on('error', ...)`) | `try/catch` on awaited promises |
| Code style | Callback/event-driven | Async/await |

The STARTTLS approach (`secureTransport: 'starttls'`) creates a plain TCP socket first, then upgrades to TLS, which is exactly what we need to measure TCP and TLS phases separately.

**Note:** `node:tls` import is removed. The only socket import is now `cloudflare:sockets`.

---

## Known Remaining Issues

### TCP/TLS connections failing on Cloudflare regional workers

Workers deployed via `wrangler.toml` `[env.us]`, `[env.eu]`, etc. with placement hints in `wrangler.us.toml` still fail to open sockets:

```
proxy request failed, cannot connect to the specified address
```

This affects `us.healthchecks.ross.gg`, `eu.healthchecks.ross.gg`, etc. The targeted placement workers (`aws-*`, `gcp-*`, `azure-*`) work correctly. Root cause is unclear — may be related to the placement hint configuration or the specific Cloudflare colos these workers land on. See also `IMPOSSIBLE.md` for known networking restrictions.

### Smart Placement hints require Enterprise plan

`wrangler.us.toml` uses `placement = { mode = "smart", hint = "enam" }` which fails with:
```
placement hint not allowed [code: 10023]
```
This requires a Cloudflare Enterprise plan. The hint can be removed to deploy without it, but then placement is uncontrolled.
