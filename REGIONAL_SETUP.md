# Regional Services Setup Guide

This guide explains how to set up multi-region testing with Cloudflare Workers.

## Architecture Overview

Instead of one global Worker, we deploy **6 separate Workers** with regional subdomains:

```
enam.healthchecks.ross.gg  → US-East Worker      (Virginia/Ashburn)
wnam.healthchecks.ross.gg  → US-West Worker      (California/San Jose)
weur.healthchecks.ross.gg  → West Europe Worker  (London)
eeur.healthchecks.ross.gg  → East Europe Worker  (Frankfurt)
apac.healthchecks.ross.gg  → Asia-Pacific Worker (Tokyo/Singapore)
oc.healthchecks.ross.gg    → Oceania Worker      (Sydney)
```

When a user tests from a region, the frontend makes requests to that region's subdomain, forcing the Worker to execute in (or near) that datacenter.

## Step 1: Deploy Regional Workers

Run the deployment script to deploy all 6 regional Workers:

```bash
chmod +x deploy-regional.sh
./deploy-regional.sh
```

This will:
1. Build the React frontend
2. Deploy 6 separate Workers (one for each region)
3. Each Worker gets its own name and route configuration

**Or deploy manually:**

```bash
# Build frontend
npm run build

# Deploy each region
wrangler deploy --config wrangler.enam.toml --env production
wrangler deploy --config wrangler.wnam.toml --env production
wrangler deploy --config wrangler.weur.toml --env production
wrangler deploy --config wrangler.eeur.toml --env production
wrangler deploy --config wrangler.apac.toml --env production
wrangler deploy --config wrangler.oc.toml --env production
```

## Step 2: Configure DNS Records

You need to add **6 DNS records** in your Cloudflare dashboard for the `ross.gg` domain:

### In Cloudflare Dashboard:

1. Go to **Cloudflare Dashboard** → **ross.gg** → **DNS** → **Records**

2. Add these **6 CNAME records**:

| Type  | Name | Target | Proxy | TTL |
|-------|------|--------|-------|-----|
| CNAME | `enam.healthchecks` | `global-healthchecks-enam.workers.dev` | ✅ Proxied | Auto |
| CNAME | `wnam.healthchecks` | `global-healthchecks-wnam.workers.dev` | ✅ Proxied | Auto |
| CNAME | `weur.healthchecks` | `global-healthchecks-weur.workers.dev` | ✅ Proxied | Auto |
| CNAME | `eeur.healthchecks` | `global-healthchecks-eeur.workers.dev` | ✅ Proxied | Auto |
| CNAME | `apac.healthchecks` | `global-healthchecks-apac.workers.dev` | ✅ Proxied | Auto |
| CNAME | `oc.healthchecks` | `global-healthchecks-oc.workers.dev` | ✅ Proxied | Auto |

**Important:**
- ✅ **Enable "Proxied"** (orange cloud) for each record
- This routes traffic through Cloudflare's network
- The records should appear as `enam.healthchecks.ross.gg`, etc.

### Alternative: Use Wrangler CLI

```bash
# Note: This requires the Cloudflare API token with DNS edit permissions
wrangler dns create ross.gg CNAME enam.healthchecks global-healthchecks-enam.workers.dev --proxied
wrangler dns create ross.gg CNAME wnam.healthchecks global-healthchecks-wnam.workers.dev --proxied
wrangler dns create ross.gg CNAME weur.healthchecks global-healthchecks-weur.workers.dev --proxied
wrangler dns create ross.gg CNAME eeur.healthchecks global-healthchecks-eeur.workers.dev --proxied
wrangler dns create ross.gg CNAME apac.healthchecks global-healthchecks-apac.workers.dev --proxied
wrangler dns create ross.gg CNAME oc.healthchecks global-healthchecks-oc.workers.dev --proxied
```

## Step 3: Configure Worker Routes

The wrangler.toml files already include route configurations. Verify in the Cloudflare Dashboard:

1. Go to **Workers & Pages** → **global-healthchecks-enam** → **Settings** → **Triggers**
2. Verify the route is: `enam.healthchecks.ross.gg/*`
3. Repeat for all 6 regional Workers

## Step 4: Test Regional Endpoints

After DNS propagates (usually <5 minutes), test each endpoint:

```bash
# Test US-East
curl https://enam.healthchecks.ross.gg/api/check \
  -X POST -H "Content-Type: application/json" \
  -d '{"host":"github.com","port":22}'

# Test Asia-Pacific
curl https://apac.healthchecks.ross.gg/api/check \
  -X POST -H "Content-Type: application/json" \
  -d '{"host":"github.com","port":22}'

# Test Europe
curl https://weur.healthchecks.ross.gg/api/check \
  -X POST -H "Content-Type: application/json" \
  -d '{"host":"github.com","port":22}'
```

You should see different `colo` values in the responses (e.g., IAD, NRT, LHR).

## Step 5: Update Main Domain (Optional)

If you want the main domain to serve the frontend:

1. Keep the current `healthchecks.ross.gg` deployment as the main UI
2. Or update `wrangler.toml` to deploy as the main domain
3. The frontend will automatically use regional endpoints when running in production

## How It Works

### Request Flow:

1. **User visits** `healthchecks.ross.gg`
2. **Selects regions** to test (e.g., US-East, Asia-Pacific)
3. **Frontend makes parallel requests:**
   - `https://enam.healthchecks.ross.gg/api/check` → Executes in US-East
   - `https://apac.healthchecks.ross.gg/api/check` → Executes in Asia-Pacific
4. **Each Worker:**
   - Runs in (or near) its designated region
   - Uses Sockets API to connect to target host:port
   - Returns latency measured from that region's datacenter
5. **Frontend displays results** with different colos and latencies

### Why This Works:

- Each subdomain routes to a **different Worker deployment**
- Cloudflare's edge routing ensures requests go through appropriate regions
- The Sockets API connects from the Worker's execution location
- You get **real multi-region latency measurements**

## Troubleshooting

### DNS not resolving?
```bash
# Check DNS propagation
dig enam.healthchecks.ross.gg
dig apac.healthchecks.ross.gg

# Or use online tools:
# https://dnschecker.org
```

### Worker not found?
- Verify deployments: `wrangler deployments list --name global-healthchecks-enam`
- Check routes in Cloudflare Dashboard → Workers & Pages → Settings → Triggers

### Still showing same datacenter?
- This can happen if:
  - DNS not configured correctly (not proxied)
  - Worker routes not set up
  - Workers not deployed to production
- Verify the `cf-ray` and `colo` headers in responses differ between endpoints

### Testing locally?
```bash
# Run dev server
npm run dev

# Local development uses single endpoint (/api/check)
# Regional routing only works in production
```

## Cost Considerations

- **Free tier:** 100,000 requests/day **per Worker**
- 6 Workers = 600,000 requests/day total (if evenly distributed)
- After free tier: $0.50 per million requests
- **No additional cost** for DNS or routing

## Maintenance

### Update all regions:
```bash
# Make code changes, then:
./deploy-regional.sh
```

### Deploy single region:
```bash
wrangler deploy --config wrangler.enam.toml --env production
```

### View logs:
```bash
wrangler tail --name global-healthchecks-enam
wrangler tail --name global-healthchecks-apac
```

## Next Steps

1. ✅ Deploy Workers with `./deploy-regional.sh`
2. ✅ Configure DNS records in Cloudflare Dashboard
3. ✅ Test endpoints with curl
4. ✅ Visit `healthchecks.ross.gg` and test from multiple regions
5. 🎉 Enjoy true multi-region testing!

---

**Questions?** Check the main README.md or open an issue.
