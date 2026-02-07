# Multi-Region Deployment Guide

## Overview

This document describes the complete multi-region testing setup for Global Health Checks, implemented February 2026. The system uses **6 regional Cloudflare Worker deployments** to enable true multi-region TCP port connectivity testing from different global locations.

## Architecture

### Problem Statement

**Initial Challenge:** Cloudflare Workers execute in the datacenter closest to the requesting user, not in a user-specified region. This meant all tests ran from the same location (e.g., IAH/Houston for US-based users), making multi-region testing impossible.

**Solution:** Deploy **separate Worker instances** with **regional subdomains** that route traffic through different Cloudflare datacenters.

### Regional Deployments

Six independent Worker deployments, each with:
- Unique Worker name (e.g., `global-healthchecks-enam`)
- Regional subdomain (e.g., `enam.healthchecks.ross.gg`)
- Same codebase but different routes
- Shared account and assets

| Region | Subdomain | Worker Name | Target Datacenter |
|--------|-----------|-------------|-------------------|
| US-East | `enam.healthchecks.ross.gg` | `global-healthchecks-enam` | Virginia (IAD) |
| US-West | `wnam.healthchecks.ross.gg` | `global-healthchecks-wnam` | California (SJC) |
| EU-West | `weur.healthchecks.ross.gg` | `global-healthchecks-weur` | London (LHR) |
| EU-East | `eeur.healthchecks.ross.gg` | `global-healthchecks-eeur` | Frankfurt (FRA) |
| Asia-Pacific | `apac.healthchecks.ross.gg` | `global-healthchecks-apac` | Tokyo (NRT) |
| Oceania | `oc.healthchecks.ross.gg` | `global-healthchecks-oc` | Sydney (SYD) |

## Implementation Details

### Configuration Files

Each region has its own `wrangler.<region>.toml`:

```toml
# Example: wrangler.enam.toml
name = "global-healthchecks-enam"
main = "src/worker.ts"
compatibility_date = "2025-02-07"
compatibility_flags = ["nodejs_compat"]
account_id = "e7452b39fc737014144e3b3fca412900"

assets = { directory = "dist", binding = "ASSETS" }
workers_dev = false

[env.production]
route = { pattern = "enam.healthchecks.ross.gg/*", zone_name = "ross.gg" }
```

**Key Settings:**
- `account_id`: Required to specify which Cloudflare account to use
- `assets`: Serves React frontend from dist/ directory
- `route`: Binds Worker to regional subdomain
- `compatibility_flags = ["nodejs_compat"]`: Enables Sockets API

### Frontend Routing Logic

The React frontend (`src/App.tsx`) detects the environment and routes requests appropriately:

```typescript
// Use regional endpoint for true multi-region testing
const regionalEndpoint = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? '/api/check' // Local development uses single endpoint
  : `https://${regionCode}.healthchecks.ross.gg/api/check`; // Production uses regional subdomains

const response = await fetch(regionalEndpoint, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(checkRequest),
});
```

**Behavior:**
- **Local development:** All requests go to `/api/check` (single Worker)
- **Production:** Requests route to regional subdomains based on user selection

### Deployment Script

`deploy-regional.sh` automates deployment to all regions:

```bash
#!/bin/bash
set -e

# Build frontend once
npm run build

# Deploy to all regions
regions=("enam" "wnam" "weur" "eeur" "apac" "oc")
for region in "${regions[@]}"; do
    npx wrangler deploy --config "wrangler.$region.toml" --env production
done
```

**Usage:**
```bash
chmod +x deploy-regional.sh
./deploy-regional.sh
```

## DNS Configuration

### Required DNS Records

Six CNAME records must be added in Cloudflare Dashboard:

```
Type  | Name              | Target                              | Proxy
------|-------------------|-------------------------------------|--------
CNAME | enam.healthchecks | global-healthchecks-enam.workers.dev | ✅ Yes
CNAME | wnam.healthchecks | global-healthchecks-wnam.workers.dev | ✅ Yes
CNAME | weur.healthchecks | global-healthchecks-weur.workers.dev | ✅ Yes
CNAME | eeur.healthchecks | global-healthchecks-eeur.workers.dev | ✅ Yes
CNAME | apac.healthchecks | global-healthchecks-apac.workers.dev | ✅ Yes
CNAME | oc.healthchecks   | global-healthchecks-oc.workers.dev   | ✅ Yes
```

**Critical:** All records MUST be **Proxied** (orange cloud) for routing to work correctly.

### Setup Steps

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select `ross.gg` domain
3. Navigate to **DNS** → **Records**
4. Click **Add record**
5. For each region:
   - Type: `CNAME`
   - Name: `<region>.healthchecks` (e.g., `enam.healthchecks`)
   - Target: `global-healthchecks-<region>.workers.dev`
   - Proxy status: **Proxied** (orange cloud icon)
   - TTL: Auto
   - Click **Save**

**DNS Propagation:** Usually takes < 5 minutes

## Authentication

### OAuth Login (Recommended)

```bash
# In terminal (opens browser)
npx wrangler login
```

**Note:** If you have `CLOUDFLARE_API_TOKEN` set, you must unset it first:

```bash
unset CLOUDFLARE_API_TOKEN
npx wrangler login
```

### API Token (Alternative)

1. Create token at https://dash.cloudflare.com/profile/api-tokens
2. Use **"Edit Cloudflare Workers"** template
3. Required permissions:
   - Account: Workers Scripts (Edit)
   - Account: Account Settings (Read)
   - Zone: Workers Routes (Edit)
4. Set token:
   ```bash
   export CLOUDFLARE_API_TOKEN="your-token-here"
   ```

## Testing

### Test Regional Endpoints

After DNS setup, verify each region:

```bash
# Test US-East
curl -X POST https://enam.healthchecks.ross.gg/api/check \
  -H "Content-Type: application/json" \
  -d '{"host":"github.com","port":22}'

# Expected response
{
  "success": true,
  "host": "github.com",
  "port": 22,
  "latencyMs": 132,
  "timestamp": 1770502452882,
  "colo": "IAD"  # ← Should show IAD (Virginia)
}

# Test Asia-Pacific
curl -X POST https://apac.healthchecks.ross.gg/api/check \
  -H "Content-Type: application/json" \
  -d '{"host":"github.com","port":22}'

# Expected response
{
  "success": true,
  "host": "github.com",
  "port": 22,
  "latencyMs": 89,
  "timestamp": 1770502465123,
  "colo": "NRT"  # ← Should show NRT (Tokyo)
}
```

**Verification:** Each region should return a **different `colo` value**.

### Common Colo Codes

- **IAD** = Ashburn, Virginia (US-East)
- **SJC** = San Jose, California (US-West)
- **LHR** = London, UK (EU-West)
- **FRA** = Frankfurt, Germany (EU-East)
- **NRT** = Tokyo, Japan (Asia-Pacific)
- **SYD** = Sydney, Australia (Oceania)

## How It Works

### Request Flow

```
1. User visits healthchecks.ross.gg
   ↓
2. Frontend loads, user selects regions (e.g., US-East, Asia-Pacific)
   ↓
3. Frontend makes parallel requests:
   • https://enam.healthchecks.ross.gg/api/check → Routes through US-East
   • https://apac.healthchecks.ross.gg/api/check → Routes through Asia-Pacific
   ↓
4. Each Worker:
   • Executes in (or near) its designated region
   • Uses Sockets API to connect to target host:port
   • Measures latency from that region's datacenter
   ↓
5. Frontend displays results with different colos and latencies
```

### Why This Works

1. **Separate Subdomains:** Each region has its own subdomain
2. **DNS Routing:** Cloudflare routes requests to appropriate Workers
3. **Proxied DNS:** Orange cloud ensures traffic goes through Cloudflare edge
4. **Edge Execution:** Workers execute at edge locations near the subdomain's target
5. **Sockets API:** Connects from the Worker's execution location

**Result:** True multi-region latency measurements from different global datacenters.

## Limitations

### Cloudflare Workers Constraints

1. **HTTP/HTTPS Ports Blocked:** Sockets API cannot connect to ports 80, 443
   - Error: "proxy request failed, cannot connect to the specified address"
   - Workaround: Test non-HTTP ports (22, 3306, 5432, etc.)

2. **No Exact Datacenter Control:** You can't force a specific colo
   - Workers execute where Cloudflare's routing decides
   - Regional subdomains provide "best effort" routing

3. **Free Tier Limits:** 100,000 requests/day per Worker
   - 6 Workers = 600,000 total requests/day
   - After free tier: $0.50 per million requests

### Alternative Approaches Considered

**Option 1: Single Worker (Current non-regional setup)**
- ❌ All tests from user's nearest datacenter
- ✅ Simple deployment
- **Verdict:** Can't do multi-region testing

**Option 2: Multiple Regional Workers (Implemented)**
- ✅ True multi-region testing
- ✅ Real latency measurements
- ⚠️ Requires DNS configuration
- **Verdict:** Best for this use case

**Option 3: Durable Objects with Location Hints**
- ✅ Explicit region control
- ❌ Requires paid plan ($5/month+)
- ❌ More complex architecture
- **Verdict:** Overkill for this project

## Maintenance

### Deploy Updates to All Regions

```bash
# Make code changes
# Then deploy all regions
./deploy-regional.sh
```

### Deploy Single Region

```bash
npx wrangler deploy --config wrangler.enam.toml --env production
```

### View Logs

```bash
# Tail logs from specific region
npx wrangler tail --name global-healthchecks-enam

# Tail multiple regions (separate terminals)
npx wrangler tail --name global-healthchecks-apac
```

### Update Wrangler

The deployment uses Wrangler 3.x. To update:

```bash
npm install --save-dev wrangler@4
```

## Troubleshooting

### Issue: DNS Not Resolving

**Symptoms:**
```bash
curl: (6) Could not resolve host: enam.healthchecks.ross.gg
```

**Solutions:**
1. Verify DNS records exist in Cloudflare Dashboard
2. Ensure records are **Proxied** (orange cloud)
3. Wait 5-10 minutes for DNS propagation
4. Test with `dig enam.healthchecks.ross.gg`

### Issue: Authentication Error

**Symptoms:**
```
ERROR: Authentication error [code: 10000]
```

**Solutions:**
1. Run `npx wrangler login` in terminal
2. If `CLOUDFLARE_API_TOKEN` is set: `unset CLOUDFLARE_API_TOKEN`
3. Create new API token with correct permissions

### Issue: Multiple Accounts Error

**Symptoms:**
```
ERROR: More than one account available but unable to select one
```

**Solution:**
Add `account_id` to all wrangler config files:
```toml
account_id = "e7452b39fc737014144e3b3fca412900"
```

### Issue: All Tests Show Same Datacenter

**Symptoms:**
All regions return the same `colo` value (e.g., all show IAH)

**Possible Causes:**
1. DNS not configured or not proxied
2. Testing from local development (uses single endpoint)
3. Worker routes not properly configured

**Solutions:**
1. Verify DNS records are Proxied in Cloudflare Dashboard
2. Test in production, not localhost
3. Check Worker routes: Dashboard → Workers & Pages → Settings → Triggers

## Cost Analysis

### Free Tier (Per Worker)
- **Requests:** 100,000/day
- **Duration:** 10ms CPU time per request
- **Egress:** Unlimited

### With 6 Regional Workers
- **Total free requests:** 600,000/day
- **Cost if exceeded:** $0.50 per million requests
- **Example:** 1 million requests = $0.50 × 1 = $0.50

### Comparison

| Setup | Workers | Free Requests/Day | Cost (1M requests) |
|-------|---------|-------------------|--------------------|
| Single Worker | 1 | 100,000 | $0.50 |
| Regional (6 Workers) | 6 | 600,000 | $0.50 |

**Verdict:** Regional setup has **6x capacity** at no additional cost per request.

## Future Enhancements

### Potential Improvements

1. **Add More Regions:**
   - South America (São Paulo)
   - Middle East (Dubai)
   - Africa (Johannesburg)

2. **Automatic Failover:**
   - If one region fails, route to backup

3. **Regional Analytics:**
   - Track which regions are most used
   - Monitor latency patterns

4. **Custom Datacenters:**
   - Allow users to specify exact colo codes
   - Use Cloudflare's location hints API (if available)

## References

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Sockets API Documentation](https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [REGIONAL_SETUP.md](../REGIONAL_SETUP.md) - Step-by-step setup guide

## Related Documentation

- [PROJECT_OVERVIEW.md](PROJECT_OVERVIEW.md) - Project introduction
- [TECHNICAL_ARCHITECTURE.md](TECHNICAL_ARCHITECTURE.md) - Overall architecture
- [TESTING_INFRASTRUCTURE.md](TESTING_INFRASTRUCTURE.md) - Testing setup
- [DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md) - Development workflows

---

**Last Updated:** February 7, 2026
**Status:** ✅ Deployed and Operational
**Maintainer:** Global Health Checks Team
