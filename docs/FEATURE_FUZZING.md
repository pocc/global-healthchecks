# Feature Fuzzing & Limits Report

102 fuzz tests against the Handshake Speed API, plus official acceptable values/limits from Cloudflare and Node.js documentation.

**API:** `POST http://localhost:8799/api/check?secret=...`
**Date:** 2026-02-08
**Results:** 65 successes, 24 connection failures, 14 API validation errors

---

## Official Limits & Acceptable Values

### Cloudflare Workers Runtime

| Limit | Free Plan | Paid Plan | Source |
|-------|-----------|-----------|--------|
| CPU time (HTTP) | 10 ms | 5 minutes | [CF Docs](https://developers.cloudflare.com/workers/platform/limits/) |
| CPU time (Cron) | N/A | 15 minutes | [CF Docs](https://developers.cloudflare.com/workers/platform/limits/) |
| Wall clock time | No hard limit | No hard limit | [CF Docs](https://developers.cloudflare.com/workers/platform/limits/) |
| Concurrent outbound connections | 6 per request | 6 per request | [CF Docs](https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/) |
| Subrequests | 50 per request | 1,000 per request | [CF Docs](https://developers.cloudflare.com/workers/platform/limits/) |

### Cloudflare Workers Sockets API (`cloudflare:sockets`)

| Parameter | Acceptable Values | Restrictions |
|-----------|-------------------|--------------|
| Hostname | Valid hostname or IPv4 address | No IPv6; no unicode; max ~253 chars (DNS limit) |
| Port | 1–65535 | Port 25 blocked (SMTP) |
| Blocked destinations | — | localhost, 127.0.0.1, 0.0.0.0, private IPs (10.x, 172.16-31.x, 192.168.x), Cloudflare IPs (AS13335) |
| IP version | IPv4 only | IPv6 not supported by the sockets proxy |

### Node.js `node:tls` (`minVersion` / `maxVersion`)

| Value | Description | Source |
|-------|-------------|--------|
| `TLSv1` | TLS 1.0 (deprecated) | [Node.js TLS docs](https://nodejs.org/api/tls.html) |
| `TLSv1.1` | TLS 1.1 (deprecated) | [Node.js TLS docs](https://nodejs.org/api/tls.html) |
| `TLSv1.2` | TLS 1.2 (default min) | [Node.js TLS docs](https://nodejs.org/api/tls.html) |
| `TLSv1.3` | TLS 1.3 (default max) | [Node.js TLS docs](https://nodejs.org/api/tls.html) |

Invalid values (e.g. `TLSv2.0`, empty string) are silently ignored by the Cloudflare Workers runtime.

### Node.js `node:tls` Cipher Format

| Format | Example |
|--------|---------|
| TLSv1.2 and below | Colon-separated OpenSSL names: `ECDHE-RSA-AES128-GCM-SHA256:AES256-SHA` |
| TLSv1.3 | Full suite names: `TLS_AES_128_GCM_SHA256`, `TLS_AES_256_GCM_SHA384`, `TLS_CHACHA20_POLY1305_SHA256` |
| Exclusion | Prefix with `!`: `!RC4:!MD5:!aNULL` |

Invalid cipher strings are silently ignored by the Workers runtime (falls back to defaults).

### HTTP Methods (RFC 7231)

| Method | Standard | Notes |
|--------|----------|-------|
| `GET` | Yes | Default for browsers |
| `HEAD` | Yes | Our default |
| `POST` | Yes | |
| `PUT` | Yes | |
| `DELETE` | Yes | |
| `OPTIONS` | Yes | CORS preflight |
| `PATCH` | Yes (RFC 5789) | |
| Custom | Allowed | Any `tchar` token per RFC 7230 |

The API does not validate method names — any string is sent to the target server.

### HTTP Path Length

| Limit | Value | Source |
|-------|-------|--------|
| RFC 3986 | No maximum specified | [RFC 3986](https://datatracker.ietf.org/doc/html/rfc3986) |
| Practical | 2,000–2,048 chars | Browser/server convention |
| IE (legacy) | 2,083 chars max URL | Microsoft documentation |

### API-Specific Limits

| Parameter | Type | Range/Values | Default | Validated? |
|-----------|------|-------------|---------|------------|
| `host` | string | hostname or IPv4 | (required) | Yes — empty/null rejected |
| `port` | number | 1–65535 | (required) | Yes — range checked (but 0 treated as missing, floats accepted) |
| `timeout` | number | 0–∞ | 5000 | No — 0 means default, negatives cause instant timeout |
| `connectTimeout` | number | 0–∞ | 5000 | No — same as timeout |
| `idleTimeout` | number | 0–∞ | none | No |
| `retries` | number | 0–∞ | 0 | No — no upper bound, negatives treated as 0 |
| `retryBackoff` | boolean | true/false | false | No — truthy coercion |
| `tlsEnabled` | boolean | true/false | false | No — truthy coercion (`"true"`, `1` both work) |
| `minTlsVersion` | string | `TLSv1`–`TLSv1.3` | auto | No — invalid values silently ignored |
| `maxTlsVersion` | string | `TLSv1`–`TLSv1.3` | auto | No — invalid values silently ignored |
| `ciphers` | string | OpenSSL format | all | No — invalid ciphers silently ignored |
| `httpMethod` | string | any token | `HEAD` | No — invalid methods sent as-is |
| `httpPath` | string | any string | `/` | No — path traversal sent as-is |
| `maxRedirects` | number | 0–∞ | 5 | No — negatives treated as 0 |
| `checks` (batch) | array | 1–10 items | (required) | Yes — empty, >10, non-array rejected |
| `secret` | string | exact match | (required) | Yes — 401 on mismatch |

---

## Test Results

### Category 1: Host Field (Tests 1–15)

| # | Test | Result | Finding |
|---|------|--------|---------|
| 1 | Empty string host | 400 | `Missing required fields: host and port` |
| 2 | Null host (field omitted) | 400 | `Missing required fields: host and port` |
| 3 | IPv4 address (8.8.8.8:53) | SUCCESS | Connected, 27ms |
| 4 | IPv6 address (2001:4860:4860::8888) | FAIL | `proxy request failed` — IPv6 not supported |
| 5 | Very long hostname (300+ chars) | FAIL | `contains unsupported characters or is too long` |
| 6 | XSS `<script>` in host | FAIL | `contains unsupported characters` |
| 7 | Spaces in hostname | FAIL | `contains unsupported characters` |
| 8 | Nonexistent domain | FAIL | `proxy request failed` |
| 9 | localhost | FAIL | `proxy request failed` — SSRF blocked |
| 10 | 0.0.0.0 | FAIL | `proxy request failed` — blocked |
| 11 | 127.0.0.1 | FAIL | `proxy request failed` — blocked |
| 12 | Internal IP 10.0.0.1 | FAIL | Connection timeout (not instantly rejected) |
| 13 | Internal IP 192.168.1.1 | FAIL | Connection timeout (not instantly rejected) |
| 14 | Unicode hostname (münchen.de) | FAIL | `contains unsupported characters` |
| 15 | Host with trailing dot (google.com.) | SUCCESS | Connected, 56ms — trailing dot accepted |

**Key findings:**
- IPv6 not supported by `cloudflare:sockets` proxy
- Localhost/loopback blocked instantly; private IPs (10.x, 192.168.x) timeout instead of instant rejection
- Unicode/IDN hostnames rejected — must use punycode
- Trailing dot in hostname is accepted

---

### Category 2: Port Field (Tests 16–25)

| # | Test | Result | Finding |
|---|------|--------|---------|
| 16 | Port 0 | 400 | `Missing required fields` — 0 is falsy, not range-checked |
| 17 | Port 1 | FAIL | Connection timeout |
| 18 | Port 65535 | FAIL | Connection timeout |
| 19 | Port 65536 | 400 | `Port must be between 1 and 65535` |
| 20 | Port -1 | 400 | `Port must be between 1 and 65535` |
| 21 | Port as string "443" | SUCCESS | Connected — string coerced to number |
| 22 | Port as float 443.5 | SUCCESS | Connected — float accepted (truncated by proxy) |
| 23 | Port 80 (HTTP) | SUCCESS | Connected, 85ms |
| 24 | Port 22 (SSH on github.com) | SUCCESS | Connected, 135ms |
| 25 | Port null | 400 | `Missing required fields` |

**Key findings:**
- Port 0 gives "missing" error instead of range error (0 is falsy in JS)
- String and float ports accepted without type validation
- Range check works for values outside 1–65535

---

### Category 3: Timeout Field (Tests 26–35)

| # | Test | Result | Finding |
|---|------|--------|---------|
| 26 | connectTimeout 0 | SUCCESS | 0 treated as "no timeout" (uses default) |
| 27 | connectTimeout 1ms | FAIL | Connection timeout at 2ms |
| 28 | connectTimeout 100 | SUCCESS | Connected within 100ms |
| 29 | connectTimeout 60000 | SUCCESS | No upper bound enforced |
| 30 | timeout 0 | SUCCESS | 0 treated as "no timeout" |
| 31 | timeout 1ms | FAIL | Connection timeout at 2ms |
| 32 | timeout -1 | FAIL | Immediate timeout — not validated |
| 33 | idleTimeout 0 | SUCCESS | Accepted silently |
| 34 | idleTimeout 100 | SUCCESS | Accepted silently |
| 35 | connectTimeout -1 | FAIL | Immediate timeout — not validated |

**Key findings:**
- 0 means "use default" for both connectTimeout and timeout
- Negative values cause instant timeout instead of validation error
- No upper bound on any timeout value

---

### Category 4: Retry Field (Tests 36–42)

| # | Test | Result | Finding |
|---|------|--------|---------|
| 36 | retries 0 | SUCCESS | No retries |
| 37 | retries 1 | SUCCESS | 1 retry available |
| 38 | retries 10 | SUCCESS | Accepted |
| 39 | retries 100 | SUCCESS | No upper bound — potential DoS vector |
| 40 | retryBackoff without retries | SUCCESS | Silently ignored |
| 41 | retries -1 | SUCCESS | Treated as 0 (no error) |
| 42 | retries on failing host | FAIL | Timeout after retries exhausted |

**Key findings:**
- No upper bound on retries — retries=100 with a slow host could hold a worker for a long time
- Negative retries silently treated as 0
- retryBackoff without retries has no effect

---

### Category 5: TLS Field (Tests 43–58)

| # | Test | Result | Finding |
|---|------|--------|---------|
| 43 | TLS on port 80 (HTTP-only) | FAIL | `proxy request failed` — no TLS on port 80 |
| 44 | Invalid minTlsVersion "TLSv2.0" | SUCCESS | Silently ignored, falls back to defaults |
| 45 | min > max TLS (1.3 > 1.2) | SUCCESS | Contradictory constraint silently ignored |
| 46 | Empty ciphers | SUCCESS | Ignored, defaults used |
| 47 | Invalid cipher "INVALID_CIPHER" | SUCCESS | Silently ignored |
| 48 | TLS 1.3 ciphers | SUCCESS | TLS_AES_128_GCM_SHA256 works |
| 49 | SNI mismatch (google SNI on amazon) | SUCCESS | No cert verification |
| 50 | Empty SNI | SUCCESS | Falls back to host value |
| 51 | TLS on SSH port 22 | FAIL | `proxy request failed` |
| 52 | minTlsVersion TLSv1 | SUCCESS | Accepted |
| 53 | minTlsVersion TLSv1.1 | SUCCESS | Accepted |
| 54 | minTlsVersion TLSv1.2 | SUCCESS | Accepted |
| 55 | minTlsVersion TLSv1.3 | SUCCESS | Accepted |
| 56 | maxTlsVersion TLSv1.2 | SUCCESS | Accepted |
| 57 | Invalid pinnedPublicKey | SUCCESS | Pinning silently ignored (no fingerprint256 locally) |
| 58 | Invalid CA bundle "not-a-pem" | SUCCESS | Silently ignored |

**Key findings:**
- Many TLS options are silently ignored by the Cloudflare Workers runtime
- Invalid versions, ciphers, pins, and CA bundles never produce errors
- SNI mismatches succeed — no server certificate hostname verification
- All four valid TLS version strings work correctly

---

### Category 6: HTTP Field (Tests 59–72)

| # | Test | Result | Finding |
|---|------|--------|---------|
| 59 | httpEnabled without tlsEnabled | SUCCESS | Auto-enables TLS on port 443 |
| 60 | OPTIONS method | SUCCESS | HTTP 301 |
| 61 | POST method | SUCCESS | HTTP 301 |
| 62 | INVALID method | SUCCESS | HTTP 301 — invalid method sent as-is |
| 63 | DELETE method | SUCCESS | HTTP 301 |
| 64 | Very long path (2000 chars) | SUCCESS | HTTP 301 |
| 65 | Path traversal (/../../../etc/passwd) | SUCCESS | HTTP 400 (server rejects, not API) |
| 66 | followRedirects max 0 | SUCCESS | 301 returned (not followed) — correct |
| 67 | followRedirects max -1 | SUCCESS | 301 returned — negative treated as 0 |
| 68 | followRedirects without httpEnabled | SUCCESS | TLS-only, 88ms — flag ignored |
| 69 | Empty httpHeaders | SUCCESS | HTTP 301 |
| 70 | Custom User-Agent | SUCCESS | HTTP 301 |
| 71 | CRLF header injection | SUCCESS | Safe — `\r\n` in JSON is escaped, not literal |
| 72 | httpPath with query string | SUCCESS | HTTP 301 |

**Key findings:**
- `httpEnabled` on port 443 auto-enables TLS even without `tlsEnabled`
- No HTTP method validation — "INVALID" sent to server
- Path traversal passed through to server (server-side 400, not API-side rejection)
- CRLF injection not possible due to JSON encoding
- maxRedirects 0 and -1 both correctly prevent following redirects

---

### Category 7: Conflict Tests (Tests 73–90)

| # | Test | Result | Finding |
|---|------|--------|---------|
| 73 | Mismatched SNI (amazon host, github SNI) | SUCCESS | No cert verification |
| 74 | Mismatched SNI (google host, amazon SNI) | SUCCESS | No cert verification |
| 75 | IP + SNI override (8.8.8.8 + dns.google) | SUCCESS | Correct usage pattern |
| 76 | httpEnabled on port 80 (non-TLS) | FAIL | `proxy request failed` — HTTP requires TLS |
| 77 | connectTimeout > timeout | SUCCESS | No conflict validation |
| 78 | TLS on port 22 (SSH) | FAIL | `proxy request failed` |
| 79 | keepAlive + idleTimeout both | SUCCESS | No conflict |
| 80 | Kitchen sink (all options) | SUCCESS | HTTP 200, 303ms, 1 redirect to www.amazon.com |
| 81 | TLS fields without tlsEnabled | SUCCESS | TCP only — TLS fields silently ignored |
| 82 | HTTP fields without httpEnabled | SUCCESS | TLS only — HTTP fields silently ignored |
| 83 | retries + low timeout on unreachable | FAIL | Timeout after ~1s |
| 84 | Empty strings for all optional fields | SUCCESS | HTTP 301 |
| 85 | Null for optional fields | SUCCESS | TLS handshake only |
| 86 | `"true"` (string) for tlsEnabled | SUCCESS | Truthy coercion — enables TLS |
| 87 | `1` (number) for tlsEnabled | SUCCESS | Truthy coercion — enables TLS |
| 88 | Extra unknown fields | SUCCESS | Silently ignored |
| 89 | Very large timeout (999999ms = ~16 min) | SUCCESS | No cap enforced |
| 90 | Zero retries with retryBackoff | SUCCESS | retryBackoff ignored |

**Key findings:**
- Kitchen sink test (all options combined) works perfectly
- Boolean fields use JS truthy coercion (`"true"`, `1` both enable TLS)
- Unknown fields are silently ignored (no strict schema validation)
- connectTimeout > timeout is not flagged as an error
- Very large timeout (999999ms) accepted — bounded by Workers CPU time limit in practice

---

### Category 8: Batch Endpoint (Tests 91–97)

| # | Test | Result | Finding |
|---|------|--------|---------|
| 91 | Empty checks array | 400 | `checks must be a non-empty array` |
| 92 | Single check | SUCCESS | 1 result |
| 93 | Ten checks (max) | SUCCESS | 10 results |
| 94 | Eleven checks (over limit) | 400 | `Maximum 10 checks per batch` |
| 95 | checks not an array | 400 | `checks must be a non-empty array` |
| 96 | Missing checks field | 400 | `checks must be a non-empty array` |
| 97 | Mixed valid + invalid in batch | SUCCESS | 2 results — partial success allowed |

**Key findings:**
- Batch limit of 10 correctly enforced
- Empty, non-array, and missing checks all properly rejected
- Mixed valid/invalid checks processed independently (no all-or-nothing)
- Batch results do NOT include `colo`/`coloCity` metadata (unlike single check)

---

### Category 9: Auth Tests (Tests 98–102)

| # | Test | Result | Finding |
|---|------|--------|---------|
| 98 | No secret parameter | 401 | `Unauthorized: invalid or missing secret parameter` |
| 99 | Wrong secret | 401 | `Unauthorized: invalid or missing secret parameter` |
| 100 | Empty secret | 401 | `Unauthorized: invalid or missing secret parameter` |
| 101 | Geo without secret | SUCCESS | Returns geo data — `/api/geo` is public |
| 102 | Batch without secret | 401 | `Unauthorized` |

**Key findings:**
- Auth enforced on `/api/check` and `/api/batch-check`
- `/api/geo` correctly public (no auth required)
- Generic error message — doesn't leak whether secret exists

---

## Summary of Issues by Severity

### Medium

| Issue | Tests | Impact |
|-------|-------|--------|
| Port as string/float accepted | 21, 22 | Loose type handling could cause unexpected behavior |
| Invalid TLS options silently ignored | 44, 45, 47, 57, 58 | User gets no feedback when misconfigured |
| SNI mismatch succeeds (no cert verification) | 49, 73, 74 | Security — connections appear valid even with wrong host |
| Invalid HTTP method sent to server | 62 | No input sanitization on methods |
| retries=100 accepted (no cap) | 39 | Potential DoS — worker held for long time |

### Low

| Issue | Tests | Impact |
|-------|-------|--------|
| Port 0 gives "missing" error not range error | 16 | Inconsistent error message |
| Negative timeout causes instant timeout | 32, 35 | Not validated, just produces unexpected result |
| Negative retries silently accepted | 41 | Treated as 0, no error |
| connectTimeout > timeout not flagged | 77 | Logically contradictory, silently accepted |
| timeout=999999 accepted (no cap) | 89 | Bounded by Workers CPU limit in practice |
| maxRedirects=-1 silently accepted | 67 | Treated as 0, no error |
| Boolean coercion on flag fields | 86, 87 | `"true"`, `1` both enable TLS |

### Info / By Design

| Behavior | Tests | Notes |
|----------|-------|-------|
| IPv6 not supported | 4 | `cloudflare:sockets` limitation |
| Private IPs timeout (not instant reject) | 12, 13 | 10.x and 192.168.x timeout; localhost instantly blocked |
| httpEnabled auto-enables TLS on 443 | 59 | Intentional convenience behavior |
| TLS/HTTP fields ignored when disabled | 81, 82 | Fields silently dropped |
| Unknown fields silently ignored | 88 | No strict schema validation |
| Path traversal sent to server | 65 | Server-side protection, not API-side |
