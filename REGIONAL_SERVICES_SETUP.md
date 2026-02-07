# Regional Services Setup Guide

## Overview

This guide covers setting up **11 Regional Services Workers** with guaranteed geographic boundaries for compliance-grade multi-region testing.

## Regional Services vs Smart Placement

| Feature | Regional Services ✅ | Smart Placement |
|---------|---------------------|-----------------|
| **Mode** | `mode = "regional"` | `mode = "smart"` |
| **Guarantee** | **Hard boundary** - guaranteed execution within region | Best effort - performance optimized |
| **Compliance** | GDPR, FedRAMP, data residency ready | Performance only |
| **Regions** | 11 compliance zones | 9 performance hints |
| **Plan** | Enterprise/Regional Services add-on | Free tier compatible |

## Available Regions

### All 11 Regional Services Regions

| Code | Region | Subdomain | Compliance Use Case |
|------|--------|-----------|-------------------|
| `us` | United States | us.healthchecks.ross.gg | General US data residency |
| `fedramp` | US FedRAMP | fedramp.healthchecks.ross.gg | US Government compliance |
| `ca` | Canada | ca.healthchecks.ross.gg | Canadian data residency |
| `eu` | Europe | eu.healthchecks.ross.gg | **GDPR compliance** |
| `isoeu` | ISO Europe | isoeu.healthchecks.ross.gg | Enhanced EU compliance |
| `de` | Germany | de.healthchecks.ross.gg | German data residency |
| `jp` | Japan | jp.healthchecks.ross.gg | Japanese data residency |
| `sg` | Singapore | sg.healthchecks.ross.gg | Southeast Asian hub |
| `kr` | South Korea | kr.healthchecks.ross.gg | South Korean data residency |
| `in` | India | in.healthchecks.ross.gg | Indian data residency |
| `au` | Australia | au.healthchecks.ross.gg | Australian data residency |

## DNS Configuration Required

### Step 1: Create 11 CNAME Records

Navigate to [Cloudflare Dashboard](https://dash.cloudflare.com) → `ross.gg` → DNS → Records

Add the following **11 CNAME records**:

#### North America (3 regions)

**1. United States**
- **Type:** CNAME
- **Name:** `us.healthchecks`
- **Target:** `global-healthchecks-us.workers.dev`
- **Proxy:** ☁️ **ON** (orange cloud)
- **TTL:** Auto

**2. US FedRAMP**
- **Type:** CNAME
- **Name:** `fedramp.healthchecks`
- **Target:** `global-healthchecks-fedramp.workers.dev`
- **Proxy:** ☁️ **ON** (orange cloud)
- **TTL:** Auto

**3. Canada**
- **Type:** CNAME
- **Name:** `ca.healthchecks`
- **Target:** `global-healthchecks-ca.workers.dev`
- **Proxy:** ☁️ **ON** (orange cloud)
- **TTL:** Auto

#### Europe (3 regions)

**4. Europe (GDPR)**
- **Type:** CNAME
- **Name:** `eu.healthchecks`
- **Target:** `global-healthchecks-eu.workers.dev`
- **Proxy:** ☁️ **ON** (orange cloud)
- **TTL:** Auto

**5. ISO Europe**
- **Type:** CNAME
- **Name:** `isoeu.healthchecks`
- **Target:** `global-healthchecks-isoeu.workers.dev`
- **Proxy:** ☁️ **ON** (orange cloud)
- **TTL:** Auto

**6. Germany**
- **Type:** CNAME
- **Name:** `de.healthchecks`
- **Target:** `global-healthchecks-de.workers.dev`
- **Proxy:** ☁️ **ON** (orange cloud)
- **TTL:** Auto

#### Asia Pacific (4 regions)

**7. Japan**
- **Type:** CNAME
- **Name:** `jp.healthchecks`
- **Target:** `global-healthchecks-jp.workers.dev`
- **Proxy:** ☁️ **ON** (orange cloud)
- **TTL:** Auto

**8. Singapore**
- **Type:** CNAME
- **Name:** `sg.healthchecks`
- **Target:** `global-healthchecks-sg.workers.dev`
- **Proxy:** ☁️ **ON** (orange cloud)
- **TTL:** Auto

**9. South Korea**
- **Type:** CNAME
- **Name:** `kr.healthchecks`
- **Target:** `global-healthchecks-kr.workers.dev`
- **Proxy:** ☁️ **ON** (orange cloud)
- **TTL:** Auto

**10. India**
- **Type:** CNAME
- **Name:** `in.healthchecks`
- **Target:** `global-healthchecks-in.workers.dev`
- **Proxy:** ☁️ **ON** (orange cloud)
- **TTL:** Auto

#### Oceania (1 region)

**11. Australia**
- **Type:** CNAME
- **Name:** `au.healthchecks`
- **Target:** `global-healthchecks-au.workers.dev`
- **Proxy:** ☁️ **ON** (orange cloud)
- **TTL:** Auto

### Step 2: Verify DNS Configuration

After adding records, verify they exist:

```bash
# Check all DNS records
for region in us fedramp ca eu isoeu de jp sg kr in au; do
  echo "Checking ${region}.healthchecks.ross.gg"
  dig +short ${region}.healthchecks.ross.gg @8.8.8.8
done
```

Expected: Cloudflare IP addresses (104.18.x.x)

## Deployment

### Deploy All 11 Regional Workers

```bash
./deploy-regional-services.sh
```

This will:
1. ✅ Build the frontend
2. ✅ Deploy to all 11 Regional Services regions
3. ✅ Configure each with `mode = "regional"`
4. ✅ Output deployment status

### Deploy Individual Region

```bash
npx wrangler deploy --config wrangler.us.toml --env production
```

## Testing

### Test All Regional Endpoints

```bash
# Test all 11 regions
for region in us fedramp ca eu isoeu de jp sg kr in au; do
  echo "Testing ${region}..."
  curl -X POST https://${region}.healthchecks.ross.gg/api/check \
    -H "Content-Type: application/json" \
    -d '{"host":"github.com","port":22}' 2>/dev/null | \
    python3 -c "import json,sys; d=json.load(sys.stdin); print(f'  DC: {d.get(\"colo\")} | Latency: {d.get(\"latencyMs\")}ms')" 2>/dev/null || echo "  (waiting for DNS)"
  echo ""
done
```

### Verify Regional Boundaries

Regional Services guarantees:
- `us` → Executes only in US datacenters
- `eu` → Executes only in EU datacenters (GDPR compliant)
- `jp` → Executes only in Japanese datacenters
- etc.

Check the `colo` field in responses to verify datacenter location.

## Frontend Integration

### Update Region Selector

Update `src/App.tsx` to include all 11 Regional Services regions:

```typescript
const REGIONAL_SERVICES_REGIONS = [
  { code: 'us', name: 'United States', flag: '🇺🇸' },
  { code: 'fedramp', name: 'US FedRAMP', flag: '🔐' },
  { code: 'ca', name: 'Canada', flag: '🇨🇦' },
  { code: 'eu', name: 'Europe (GDPR)', flag: '🇪🇺' },
  { code: 'isoeu', name: 'ISO Europe', flag: '🔒' },
  { code: 'de', name: 'Germany', flag: '🇩🇪' },
  { code: 'jp', name: 'Japan', flag: '🇯🇵' },
  { code: 'sg', name: 'Singapore', flag: '🇸🇬' },
  { code: 'kr', name: 'South Korea', flag: '🇰🇷' },
  { code: 'in', name: 'India', flag: '🇮🇳' },
  { code: 'au', name: 'Australia', flag: '🇦🇺' },
];
```

### Routing Logic

```typescript
const regionalEndpoint = window.location.hostname === 'localhost' ||
                         window.location.hostname === '127.0.0.1'
  ? '/api/check' // Local development
  : `https://${regionCode}.healthchecks.ross.gg/api/check`; // Regional Services
```

## Migration from Smart Placement

### Old Configuration (Smart Placement)
```toml
[placement]
mode = "smart"

[env.production]
placement = { mode = "smart", hint = "enam" }
```

### New Configuration (Regional Services)
```toml
[placement]
mode = "regional"

[env.production]
placement = { mode = "regional", region = "us" }
```

### Old Regions → New Regions Mapping

| Old (Smart Placement) | New (Regional Services) |
|----------------------|------------------------|
| enam (East North America) | us (United States) |
| wnam (West North America) | us (United States) |
| weur (West Europe) | eu (Europe) |
| eeur (East Europe) | eu (Europe) |
| apac (Asia Pacific) | jp, sg, kr, in (choose based on location) |
| oc (Oceania) | au (Australia) |

**Note:** Smart Placement configs can remain for backward compatibility or as fallback option.

## Compliance Benefits

### GDPR Compliance (eu, isoeu, de)
- ✅ Data processed only within EU boundaries
- ✅ No data transfer outside EU
- ✅ Meets GDPR Article 44-50 requirements

### FedRAMP Compliance (fedramp)
- ✅ US Government-compliant execution
- ✅ FedRAMP authorized infrastructure
- ✅ Meets federal security requirements

### Data Residency (all regions)
- ✅ Country-specific data processing
- ✅ Meets local data protection laws
- ✅ Guaranteed geographic boundaries

## Cost Analysis

### With 11 Regional Services Workers

- **Free tier:** 100,000 requests/day per Worker
- **Total:** 1,100,000 requests/day across all regions
- **Regional Services:** May require Enterprise plan or add-on
- **Overage:** $0.50 per million requests (if applicable)

**Note:** Check with Cloudflare if Regional Services incurs additional costs beyond Worker requests.

## Troubleshooting

### Issue: "regional placement not available"

**Cause:** Account doesn't have Regional Services enabled

**Solution:** Contact Cloudflare to enable Regional Services add-on

### Issue: Workers executing outside region

**Cause:** Regional Services requires proper routing configuration

**Solution:**
1. Ensure DNS records are proxied (orange cloud)
2. Verify `mode = "regional"` in wrangler config
3. Check Workers are deployed to production environment

### Issue: DNS not resolving

**Cause:** DNS propagation delay or missing records

**Solution:**
```bash
# Check global DNS
dig +short us.healthchecks.ross.gg @8.8.8.8

# Flush local DNS cache (macOS)
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder
```

## Commands Reference

### Deploy All Regions
```bash
./deploy-regional-services.sh
```

### Deploy Single Region
```bash
npx wrangler deploy --config wrangler.{region}.toml --env production
```

### Check DNS for All Regions
```bash
for region in us fedramp ca eu isoeu de jp sg kr in au; do
  dig +short ${region}.healthchecks.ross.gg @8.8.8.8
done
```

### Test All Endpoints
```bash
for region in us fedramp ca eu isoeu de jp sg kr in au; do
  curl -X POST https://${region}.healthchecks.ross.gg/api/check \
    -H "Content-Type: application/json" \
    -d '{"host":"github.com","port":22}'
done
```

## Documentation

- [Cloudflare Regional Services](https://developers.cloudflare.com/data-localization/)
- [Workers Placement Docs](https://developers.cloudflare.com/workers/configuration/placement/)
- [GDPR Compliance](https://developers.cloudflare.com/data-localization/regional-services/)

---

**Regional Services Setup Version:** 1.0
**Last Updated:** February 7, 2026
**Status:** Ready for deployment (pending DNS configuration)
