# Smart Placement vs Regional Services: Complete Analysis
## Date: February 7, 2026 - Session 2

This document captures the complete investigation into Cloudflare's regional placement options and the key distinctions between Smart Placement and Regional Services.

## Executive Summary

**Key Discovery:** Regional Services API regions and Smart Placement hints are **completely separate systems** with different region codes and configuration methods.

### The Confusion

When querying Cloudflare's Regional Services API:
```bash
curl "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/addressing/regional_hostnames/regions"
```

Returns: `de, sg, kr, eu, jp, in, isoeu, us, au, fedramp, ca` (11 regions)

**BUT** these are NOT valid Smart Placement hints!

### The Reality

**Valid Smart Placement hints** (from Wrangler error message):
```
wnam, enam, sam, weur, eeur, apac, oc, afr, me
```

Only 9 hints, completely different codes than Regional Services.

## Two Separate Systems

### System 1: Smart Placement (Wrangler-Configured)

**Purpose:** Performance optimization
**Configuration:** wrangler.toml `[placement]` section
**Mode:** `mode = "smart"`
**Region Specification:** `hint = "enam"`
**Guarantee:** Best effort, performance-based routing
**Plan:** Free tier compatible

**Valid Hints (9 total):**
| Code | Region | Description |
|------|--------|-------------|
| `enam` | East North America | US East Coast |
| `wnam` | West North America | US West Coast |
| `sam` | South America | Brazil, Chile, Argentina |
| `weur` | West Europe | Western Europe |
| `eeur` | East Europe | Eastern Europe |
| `apac` | Asia Pacific | Asia Pacific |
| `oc` | Oceania | Australia, New Zealand |
| `afr` | Africa | Africa |
| `me` | Middle East | Middle East |

**Configuration Example:**
```toml
[placement]
mode = "smart"

[env.production]
placement = { mode = "smart", hint = "enam" }
```

### System 2: Regional Services (Dashboard/API-Configured)

**Purpose:** Compliance and data residency
**Configuration:** Cloudflare Dashboard or Regional Services API
**Mode:** NOT configured via wrangler placement
**Region Specification:** Custom Hostnames with regional boundaries
**Guarantee:** Hard geographic boundaries for compliance
**Plan:** Enterprise plan or Regional Services add-on

**Available Regions (11 total):**
| Code | Region | Compliance Use Case |
|------|--------|-------------------|
| `us` | United States | General US data residency |
| `fedramp` | US FedRAMP | US Government compliance |
| `ca` | Canada | Canadian data residency |
| `eu` | Europe | GDPR compliance |
| `isoeu` | ISO Europe | Enhanced EU compliance |
| `de` | Germany | German data residency |
| `jp` | Japan | Japanese data residency |
| `sg` | Singapore | Southeast Asia |
| `kr` | South Korea | Korean data residency |
| `in` | India | Indian data residency |
| `au` | Australia | Australian data residency |

**Configuration:** NOT via wrangler.toml - requires Dashboard or API setup

## Investigation Timeline

### Attempt 1: Smart Placement with Cloudflare Native Codes ✅

**Action:** Implemented 6 Workers with hints: `enam, wnam, weur, eeur, apac, oc`
**Result:** ✅ Success - all deployed
**Learning:** These are valid Smart Placement hints

### Attempt 2: Regional Services API Discovery

**Action:** Queried `/addressing/regional_hostnames/regions` API
**Result:** Discovered 11 regions with different codes
**Assumption:** These codes might work as Smart Placement hints
**Reality:** Wrong assumption - different system entirely

### Attempt 3: Mode "regional" ❌

**Action:** Created 11 configs with `mode = "regional"` and `region = "us"`
**Error:**
```
Expected "placement.mode" field to be one of ["off","smart"] but got "regional"
```
**Learning:** Wrangler only supports `mode = "off"` or `mode = "smart"`

### Attempt 4: Regional Services Codes as Smart Hints ❌

**Action:** Changed to `mode = "smart"` with `hint = "us"`
**Error:**
```
invalid placement hint 'us'. Valid options are: wnam, enam, sam, weur, eeur, apac, oc, afr, me
```
**Learning:** Regional Services codes (`us`, `eu`, `jp`, etc.) are NOT valid Smart Placement hints

## Final Architecture Decision

### What We Have Now

**6 Deployed Smart Placement Workers:**
- enam.healthchecks.ross.gg (East North America)
- wnam.healthchecks.ross.gg (West North America)
- weur.healthchecks.ross.gg (West Europe)
- eeur.healthchecks.ross.gg (East Europe)
- apac.healthchecks.ross.gg (Asia Pacific)
- oc.healthchecks.ross.gg (Oceania)

All using `mode = "smart"` with valid hints ✅

### What We Can Add

**3 Additional Smart Placement Hints:**
- sam.healthchecks.ross.gg (South America)
- afr.healthchecks.ross.gg (Africa)
- me.healthchecks.ross.gg (Middle East)

This would give us **all 9 available Smart Placement regions**.

### What We Cannot Do (Without Enterprise Plan)

**Regional Services** with hard geographic boundaries requires:
1. Enterprise plan or Regional Services add-on
2. Configuration through Cloudflare Dashboard
3. Custom Hostnames setup
4. NOT configurable via wrangler.toml placement hints

## Configuration Comparison

### Valid Smart Placement Configuration ✅

```toml
# wrangler.enam.toml
[placement]
mode = "smart"

[env.production]
route = { pattern = "enam.healthchecks.ross.gg/*", zone_name = "ross.gg" }
placement = { mode = "smart", hint = "enam" }
```

### Invalid Configurations ❌

**Attempt 1: Mode "regional"**
```toml
[placement]
mode = "regional"  # ❌ NOT SUPPORTED
```

**Attempt 2: Regional Services codes as hints**
```toml
[placement]
mode = "smart"

[env.production]
placement = { mode = "smart", hint = "us" }  # ❌ "us" is not a valid hint
```

**Attempt 3: Regional Services parameter**
```toml
[env.production]
placement = { mode = "regional", region = "eu" }  # ❌ mode must be "off" or "smart"
```

## Smart Placement: Complete Reference

### All 9 Valid Hints

```toml
# North America (3)
hint = "enam"  # East North America ✅ Deployed
hint = "wnam"  # West North America ✅ Deployed
hint = "sam"   # South America ⏳ Available

# Europe (2)
hint = "weur"  # West Europe ✅ Deployed
hint = "eeur"  # East Europe ✅ Deployed

# Asia/Pacific (2)
hint = "apac"  # Asia Pacific ✅ Deployed
hint = "oc"    # Oceania ✅ Deployed

# Other (2)
hint = "afr"   # Africa ⏳ Available
hint = "me"    # Middle East ⏳ Available
```

### Deployment Status

**Currently Deployed (6/9):**
- ✅ enam
- ✅ wnam
- ✅ weur
- ✅ eeur
- ✅ apac
- ✅ oc

**Available to Add (3/9):**
- ⏳ sam (South America)
- ⏳ afr (Africa)
- ⏳ me (Middle East)

## Regional Services: Separate System

### How Regional Services Actually Works

Regional Services is configured through:
1. **Cloudflare Dashboard:** Workers & Pages → Custom Hostnames → Regional Services
2. **Regional Services API:** `/addressing/regional_hostnames` endpoints
3. **NOT via wrangler.toml placement configuration**

### Regional Services Use Cases

**When you need Regional Services (not Smart Placement):**
- GDPR compliance (data must stay in EU)
- FedRAMP compliance (US Government contracts)
- Data residency laws (India, China, Russia)
- Explicit contractual requirements for geographic boundaries

**When Smart Placement is sufficient:**
- Performance optimization
- Reducing latency to specific regions
- Multi-region testing
- Best-effort geographic distribution

## Files Created (11 configs)

All created with invalid Regional Services codes, need to be:
1. Deleted, OR
2. Repurposed with valid Smart Placement hints

**Files to handle:**
```
wrangler.us.toml      → Could become wrangler.sam.toml (South America)
wrangler.fedramp.toml → Delete (no equivalent hint)
wrangler.ca.toml      → Delete (covered by enam/wnam)
wrangler.eu.toml      → Delete (covered by weur/eeur)
wrangler.isoeu.toml   → Delete (no equivalent hint)
wrangler.de.toml      → Delete (covered by weur/eeur)
wrangler.jp.toml      → Delete (covered by apac)
wrangler.sg.toml      → Delete (covered by apac)
wrangler.kr.toml      → Delete (covered by apac)
wrangler.in.toml      → Could become wrangler.me.toml (Middle East)
wrangler.au.toml      → Could become wrangler.afr.toml (Africa)
```

## Recommendations

### Option 1: Complete Smart Placement Coverage (Recommended)

**Keep existing 6 Workers, add 3 more:**

1. Create `wrangler.sam.toml` for South America
2. Create `wrangler.afr.toml` for Africa
3. Create `wrangler.me.toml` for Middle East

**Result:** 9 total Workers covering all available Smart Placement hints

### Option 2: Keep Current 6 Workers Only

**Rationale:**
- 6 regions already provide good global coverage
- sam, afr, me might have less traffic
- Reduces complexity and cost

**Result:** 6 Workers, good enough for most use cases

### Option 3: Regional Services (Enterprise Only)

**Requirements:**
- Contact Cloudflare for Enterprise plan
- Enable Regional Services add-on
- Configure via Dashboard, not wrangler.toml

**Result:** True compliance-grade geographic boundaries

## Key Learnings

### 1. API Endpoints Can Be Misleading

The Regional Services API (`/addressing/regional_hostnames/regions`) returns regions that are NOT usable as Smart Placement hints. Don't assume API discovery automatically maps to wrangler configuration.

### 2. Error Messages Are Authoritative

When Wrangler says:
```
Valid options are: wnam, enam, sam, weur, eeur, apac, oc, afr, me
```

These are THE ONLY valid hints. No exceptions, no hidden options.

### 3. Mode Restrictions Are Hard Limits

Only `mode = "off"` or `mode = "smart"` are supported. There is no `mode = "regional"` or any other mode, regardless of what documentation might suggest.

### 4. Two Systems, Different Purposes

- **Smart Placement:** Performance optimization (free tier)
- **Regional Services:** Compliance boundaries (Enterprise)

They serve different needs and are configured completely differently.

### 5. Placement Hints ≠ Region Codes

Don't confuse:
- Smart Placement **hints** (enam, wnam, apac)
- Regional Services **regions** (us, eu, jp)
- They are not interchangeable

## Testing & Verification

### How to Test Smart Placement

Deploy a Worker and check the `colo` field in response:

```bash
curl -X POST https://enam.healthchecks.ross.gg/api/check \
  -H "Content-Type: application/json" \
  -d '{"host":"github.com","port":22}'
```

Response includes:
```json
{
  "colo": "IAD",  // Should vary by region
  "latencyMs": 45
}
```

### Expected Datacenter Distribution

With Smart Placement hints:
- `enam` → IAD, EWR, ATL, etc. (US East)
- `wnam` → SJC, LAX, SEA, etc. (US West)
- `weur` → LHR, AMS, CDG, etc. (West Europe)
- `eeur` → FRA, WAW, VIE, etc. (East Europe)
- `apac` → NRT, SIN, HKG, etc. (Asia Pacific)
- `oc` → SYD, MEL, AKL, etc. (Oceania)
- `sam` → GRU, SCL, EZE, etc. (South America)
- `afr` → CPT, JNB, CAI, etc. (Africa)
- `me` → DXB, BAH, TLV, etc. (Middle East)

**Note:** Placement is best effort - no guarantees on exact datacenter.

## Cleanup Required

### Delete Invalid Regional Services Configs

These files were created with invalid hints:
```bash
rm wrangler.us.toml
rm wrangler.fedramp.toml
rm wrangler.ca.toml
rm wrangler.eu.toml
rm wrangler.isoeu.toml
rm wrangler.de.toml
rm wrangler.jp.toml
rm wrangler.sg.toml
rm wrangler.kr.toml
rm wrangler.in.toml
rm wrangler.au.toml
```

### Delete Deployment Script

```bash
rm deploy-regional-services.sh
```

### Delete Setup Guide

```bash
rm REGIONAL_SERVICES_SETUP.md
```

### Optional: Add 3 Remaining Smart Placement Regions

Create new configs with valid hints:
```bash
# wrangler.sam.toml - South America
# wrangler.afr.toml - Africa
# wrangler.me.toml - Middle East
```

## Documentation Updates Needed

### Update MULTI_REGION_DEPLOYMENT.md

Add section clarifying:
- Smart Placement vs Regional Services distinction
- Valid hints reference table
- Why some region codes don't work

### Update SESSION_CONTINUATION_FEB7_2026_PLACEMENT_HINTS.md

Add correction note:
- AWS region codes don't work
- Cloudflare native codes are the ONLY valid hints
- Regional Services is separate from Smart Placement

### Create New Doc: SMART_PLACEMENT_VS_REGIONAL_SERVICES.md

This document (already created) serves as the canonical reference for:
- System distinctions
- Valid hint reference
- Configuration examples
- Common mistakes to avoid

## Final Status

### What Works ✅

**6 Smart Placement Workers:**
- All using `mode = "smart"`
- All using valid hints (enam, wnam, weur, eeur, apac, oc)
- All deployed and functioning
- All DNS configured

### What Doesn't Work ❌

**11 Regional Services Configs:**
- Invalid hints (us, eu, jp, sg, kr, in, au, de, ca, fedramp, isoeu)
- Cannot deploy via wrangler
- Should be deleted or repurposed

### What's Possible ⏳

**3 Additional Smart Placement Workers:**
- sam (South America)
- afr (Africa)
- me (Middle East)

Can be added if global coverage is desired.

## Conclusion

After extensive investigation, we learned that:

1. **Smart Placement** (9 hints) is configured via wrangler.toml
2. **Regional Services** (11 regions) is a separate Enterprise feature
3. The two systems use different region codes
4. They serve different purposes (performance vs compliance)
5. Only Smart Placement is available on free tier

**Recommendation:** Keep the 6 working Smart Placement Workers and optionally add the 3 remaining hints (sam, afr, me) for complete global coverage.

---

**Document Version:** 1.0
**Last Updated:** February 7, 2026
**Session:** Smart Placement vs Regional Services Investigation
**Status:** Complete - All systems understood and documented
