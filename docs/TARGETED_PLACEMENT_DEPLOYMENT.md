# Targeted Placement Deployment — 143 Endpoints

**Date:** February 8, 2026

## Key Takeaway

This project has **143 worker endpoints**, not 19 or 20. The correct placement mode is **`targeted`** with cloud provider region codes (`aws:us-east-1`, `gcp:europe-west1`, `azure:eastus`), **not** the 9 Smart Placement hints (`enam`, `wnam`, `weur`, etc.) documented in earlier sessions.

## Endpoint Breakdown

| Category | Count | Placement Mode | Region Format | Example |
|----------|-------|----------------|---------------|---------|
| **Regional Services** | 10 | `region = "us"` | Country codes | `us`, `ca`, `eu`, `de`, `jp` |
| **AWS Targeted** | 34 | `mode = "targeted"` | `aws:<region>` | `aws:us-east-1`, `aws:ap-northeast-1` |
| **GCP Targeted** | 43 | `mode = "targeted"` | `gcp:<region>` | `gcp:us-central1`, `gcp:asia-east1` |
| **Azure Targeted** | 56 | `mode = "targeted"` | `azure:<region>` | `azure:eastus`, `azure:japaneast` |
| **Total** | **143** | | | |

Each endpoint is a separate Cloudflare Worker environment deployed from the same codebase via `wrangler deploy --env <name>`.

## What Was Wrong Before

Earlier sessions (Feb 7, 2026) focused on 9 "Smart Placement" hints:
```
enam, wnam, sam, weur, eeur, apac, oc, afr, me
```

These are **broad geographic hints** that Cloudflare can override at will. The user explicitly corrected this: **"Please do not use the 9 — those are wrong. Please use the `aws:`, `gcp:`, and `azure:` regional ones that total to 133."**

### Smart Placement vs Targeted Placement

| Feature | Smart Placement (9 hints) | Targeted Placement (133 regions) |
|---------|--------------------------|----------------------------------|
| **Mode** | `mode = "smart"` | `mode = "targeted"` |
| **Precision** | Broad regions (e.g., "East North America") | Specific cloud provider regions (e.g., AWS us-east-1) |
| **Codes** | `enam`, `wnam`, `weur`, etc. | `aws:us-east-1`, `gcp:europe-west1`, `azure:eastus` |
| **Verification** | `cf-placement` header may show `local-*` (ignored) | `cf-placement` header shows `remote-*` (honored) |
| **Use in this project** | **Not used** | **Used for all 133 cloud provider workers** |

## Wrangler Configuration

All 143 environments are defined in a single `wrangler.toml` (1152 lines).

### Regional Services (10 endpoints)

```toml
[env.us]
name = "global-healthchecks-us"
route = { pattern = "us.healthchecks.ross.gg/*", zone_name = "ross.gg" }

[env.us.placement]
region = "us"
```

### Targeted Placement (133 endpoints)

```toml
[env.aws-us-east-1]
name = "global-healthchecks-aws-us-east-1"
route = { pattern = "aws-us-east-1.healthchecks.ross.gg/*", zone_name = "ross.gg" }

[env.aws-us-east-1.placement]
mode = "targeted"
region = "aws:us-east-1"
```

Note: Routes use `zone_name = "ross.gg"` (not `custom_domain = true`) because the wildcard DNS approach requires zone-based routing.

## DNS Setup

### Problem

The original 10 Regional Services had individual CNAME records. But adding 133 more individual records for every cloud provider region was impractical. Without DNS records, browsers couldn't resolve hostnames like `aws-us-east-1.healthchecks.ross.gg`.

### Solution: Wildcard DNS

A single wildcard record covers all 143 subdomains (and any future ones):

```
Type: AAAA  Name: *.healthchecks  Content: 100::       Proxied: Yes
Type: A     Name: *.healthchecks  Content: 192.0.2.1   Proxied: Yes
```

- `100::` and `192.0.2.1` are reserved/documentation IPs — Cloudflare's proxy intercepts traffic before it reaches these addresses
- Both A and AAAA records ensure IPv4 and IPv6 clients can resolve
- The DNS record was created via the Cloudflare API:

```bash
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
  -H "X-Auth-Email: $EMAIL" \
  -H "X-Auth-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  --data '{"type":"AAAA","name":"*.healthchecks","content":"100::","proxied":true,"ttl":1}'
```

### DNS Propagation Notes

- Cloudflare's authoritative nameservers pick up wildcard records immediately
- External resolvers (1.1.1.1, 8.8.8.8) may cache negative responses (NXDOMAIN) for a few minutes
- To verify: `dig +short aws-us-east-1.healthchecks.ross.gg a @aldo.ns.cloudflare.com`

## CORS Fix for `cf-placement` Header

### Problem

The frontend on `healthchecks.ross.gg` makes cross-origin requests to subdomains like `aws-us-east-1.healthchecks.ross.gg`. The `cf-placement` header (which shows where the Worker actually executed) was present in responses, but browsers blocked JavaScript from reading it due to CORS restrictions on non-safelisted headers.

### Fix

Added `Access-Control-Expose-Headers` to the worker's CORS headers in `src/worker.ts`:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Expose-Headers': 'cf-placement, cf-ray',  // <-- Added
};
```

This allows the frontend to read `cf-placement` and `cf-ray` from cross-origin responses.

## Verifying Targeted Placement

### The `cf-placement` Header

After deployment, each worker response includes a `cf-placement` header:

```bash
$ curl -sI -X POST "https://aws-us-east-1.healthchecks.ross.gg/api/check" \
    -H "Content-Type: application/json" \
    -d '{"host":"amazon.com","port":443}'

cf-placement: remote-IAD  # Worker executed in Ashburn, VA (AWS us-east-1 region)
```

- `remote-XXX` = Worker was forwarded to targeted region (placement honored)
- `local-XXX` = Worker ran at nearest edge (placement not applied)

### Expected Results

| Worker | Expected `cf-placement` | Cloud Region |
|--------|------------------------|--------------|
| `aws-us-east-1` | `remote-IAD` | N. Virginia |
| `aws-ap-northeast-1` | `remote-NRT` | Tokyo |
| `gcp-europe-west3` | `remote-FRA` | Frankfurt |
| `azure-uksouth` | `remote-LHR` | London |

### 522 Errors During Deployment

Workers that haven't been deployed yet return HTTP 522 (Connection Timed Out) because Cloudflare falls through to the dummy DNS IP (`192.0.2.1`) when no Worker route matches. This resolves after `wrangler deploy --env <name>` registers the route.

## Deployment

### Deploy All 143 Workers

```bash
# Must unset stale API token to use OAuth session
unset CLOUDFLARE_API_TOKEN

# Build frontend
npm run build

# Deploy production (serves the UI)
npx wrangler deploy

# Deploy all 143 environments
./deploy-all.sh
```

The `deploy-all.sh` script iterates through all `[env.*]` sections in `wrangler.toml` with 1-second delays between deploys to avoid rate limiting.

### Deploy a Single Region

```bash
npx wrangler deploy --env aws-us-east-1
```

## Frontend Region Data

The React frontend (`src/App.tsx`) defines all 143 regions in four arrays:

```typescript
const REGIONAL_SERVICES = [...];  // 10 regions
const AWS_PLACEMENT = [...];      // 34 regions
const GCP_PLACEMENT = [...];      // 43 regions
const AZURE_PLACEMENT = [...];    // 56 regions

// All selected by default
const selectedRegions = [
  ...REGIONAL_SERVICES.map((r) => r.code),
  ...AWS_PLACEMENT.map((r) => r.code),
  ...GCP_PLACEMENT.map((r) => r.code),
  ...AZURE_PLACEMENT.map((r) => r.code),
];
```

The results table visually segments these groups with colored separator rows and left-border accents:
- **Teal** — Cloudflare Regional Services
- **Orange** — AWS Placement Hints
- **Blue** — GCP Placement Hints
- **Sky blue** — Azure Placement Hints

## Smart Placement Column in UI

| Region Type | `cf-placement` Present | Display |
|-------------|----------------------|---------|
| Regional Service | Any | `N/A — Regional Service` (teal badge) |
| Cloud Provider | `local-XXX` | `⊘ Not Applied (local-XXX)` (gray badge) |
| Cloud Provider | `remote-XXX` | `🔀 Forwarded (remote-XXX)` (purple badge) |
| Cloud Provider | Absent | `-` |

Regional Services don't use Smart Placement — they use guaranteed geographic boundaries — so the column shows "N/A" rather than a misleading dash.

## Troubleshooting

### All workers show same colo (e.g., IAH)

The targeted placement Workers are executing locally instead of being forwarded. Check:
1. `cf-placement` header — does it show `local-*` or `remote-*`?
2. Workers may need redeployment after DNS changes
3. Targeted placement may take time to activate on new deployments

### CORS errors in browser console

```
Access to fetch at 'https://gcp-*.healthchecks.ross.gg/api/check' has been blocked by CORS policy
```

The worker hasn't been deployed yet (or is returning a 522). Deploy with:
```bash
npx wrangler deploy --env gcp-asia-southeast3
```

### DNS not resolving

```bash
# Check authoritative NS directly (bypasses cache)
dig +short aws-us-east-1.healthchecks.ross.gg a @aldo.ns.cloudflare.com

# Flush local DNS cache (macOS)
sudo dscacheutil -flushcache && sudo killall -HUP mDNSResponder
```

## Cost

- **Free tier:** 100,000 requests/day per Worker
- **143 Workers:** 14.3M requests/day total on free tier
- **Overage:** $0.50 per million requests

## Key Learnings

1. **Use `targeted` mode, not `smart`** — Smart Placement's 9 broad hints are insufficient for precise cloud-region testing
2. **Wildcard DNS is essential** — Individual records for 143 subdomains is impractical; a single `*.healthchecks` wildcard covers everything
3. **CORS `Expose-Headers` is required** — Cross-origin fetches to subdomains won't expose `cf-placement` without explicit opt-in
4. **Zone-based routes, not custom domains** — `zone_name = "ross.gg"` works with wildcard DNS; `custom_domain = true` conflicts with existing DNS records
5. **`unset CLOUDFLARE_API_TOKEN`** — Stale environment variables override OAuth session auth; always unset before deploying

## Related Documentation

- [SMART_PLACEMENT_VS_REGIONAL_SERVICES.md](SMART_PLACEMENT_VS_REGIONAL_SERVICES.md) — Why Smart Placement hints were rejected
- [MULTI_REGION_DEPLOYMENT.md](MULTI_REGION_DEPLOYMENT.md) — Original 6-region deployment (superseded)
- [REGIONAL_SERVICES.md](REGIONAL_SERVICES.md) — Enterprise Regional Services details
- [COLO_CITIES.md](COLO_CITIES.md) — IATA airport code to city mapping

---

**Document Version:** 1.0
**Last Updated:** February 8, 2026
**Status:** Deployed — 143/143 workers active
