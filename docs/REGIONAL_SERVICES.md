# Cloudflare Regional Services (Enterprise Feature)

## Overview

**Regional Services** is an Enterprise-level Cloudflare Workers feature that provides guaranteed regional execution for compliance, data residency, and regulatory requirements. Unlike Smart Placement hints (which are suggestions), Regional Services ensures Workers execute within specific geographic boundaries.

## Regional Services vs Smart Placement vs Placement Hints

| Feature | Regional Services | Smart Placement | Placement Hints |
|---------|------------------|-----------------|-----------------|
| **Access** | Enterprise only (requires entitlement) | All plans | All plans |
| **Purpose** | Compliance & data residency | Performance optimization | Performance optimization |
| **Guarantee** | ✅ Hard regional boundaries | ❌ Best effort | ❌ Best effort |
| **Override** | Cannot be overridden | Cloudflare may override | Cloudflare may override |
| **Use Case** | GDPR, data sovereignty, legal compliance | Multi-backend optimization | Single backend optimization |
| **Configuration** | `region = "us"` (codes) | `mode = "smart"` + hints | `region = "aws:us-east-1"` (cloud regions) |

## Supported Regional Services Regions

Regional Services uses geographic region codes, discovered via the Cloudflare API:

```bash
curl -H "Authorization: Bearer $CF_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/user/worker_account_quotas/regional_services"
```

### Available Regions (as of 2025)

| Code | Region | Description |
|------|--------|-------------|
| `us` | United States | North America |
| `ca` | Canada | North America |
| `eu` | Europe | GDPR-compliant EU region |
| `isoeu` | ISO Europe | Enhanced security/compliance |
| `de` | Germany | Central Europe |
| `jp` | Japan | East Asia |
| `sg` | Singapore | Southeast Asia |
| `kr` | South Korea | East Asia |
| `in` | India | South Asia |
| `au` | Australia | Oceania |
| `fedramp` | US FedRAMP | US government compliance (requires special access) |

## Configuration

### Wrangler.toml Format

Regional Services uses simple geographic codes (NOT cloud provider regions):

```toml
name = "my-worker-eu"
main = "src/worker.ts"
compatibility_date = "2025-02-07"
account_id = "your_account_id"

[env.production]
route = { pattern = "eu.example.com/*", zone_name = "example.com" }

# Regional Services configuration
[env.production.placement]
region = "eu"  # Hard boundary - Worker MUST execute in EU
```

### Comparison with Other Placement Methods

**Regional Services (Enterprise):**
```toml
[env.production.placement]
region = "eu"  # Geographic code
```

**Smart Placement (All plans):**
```toml
[placement]
mode = "smart"

[env.production.placement]
mode = "smart"
hint = "weur"  # West Europe hint (may be ignored)
```

**Placement Hints (All plans):**
```toml
[placement]
region = "aws:eu-west-1"  # Cloud provider region
# OR
host = "db.example.com:5432"  # Specific host
# OR
hostname = "api.example.com"  # HTTP endpoint
```

## How Regional Services Works

### Guaranteed Regional Execution

When Regional Services is configured:

1. **Request arrives** at any Cloudflare edge location
2. **Worker is forwarded** to a data center within the specified region
3. **Execution happens** within geographic boundaries
4. **Response returns** to the user

The `cf-placement` header shows this:
- `remote-CDG` - Forwarded to Paris (France) for EU region
- `remote-NRT` - Forwarded to Tokyo (Japan) for JP region
- `remote-IAH` - Forwarded to Houston (US) for US region

### Data Residency Implications

- **Processing**: All Worker execution happens within the specified region
- **Logs**: Worker logs are stored regionally
- **KV/R2/D1**: Requires separate regional configuration
- **Static Assets**: Still served from nearest edge (not regionally constrained)

## Implementation in This Project

Our global health checks implementation uses Regional Services for 10 endpoints:

```bash
# Regional Services Workers (10)
us.healthchecks.ross.gg    → United States (region: "us")
ca.healthchecks.ross.gg    → Canada (region: "ca")
eu.healthchecks.ross.gg    → Europe (region: "eu")
isoeu.healthchecks.ross.gg → ISO Europe (region: "isoeu")
de.healthchecks.ross.gg    → Germany (region: "de")
jp.healthchecks.ross.gg    → Japan (region: "jp")
sg.healthchecks.ross.gg    → Singapore (region: "sg")
kr.healthchecks.ross.gg    → South Korea (region: "kr")
in.healthchecks.ross.gg    → India (region: "in")
au.healthchecks.ross.gg    → Australia (region: "au")
```

Plus 9 Smart Placement hint workers (enam, wnam, sam, weur, eeur, apac, oc, afr, me).

## Verifying Regional Execution

Check the `cf-placement` header in responses:

```bash
curl -I https://eu.healthchecks.ross.gg/api/check
# Look for: cf-placement: remote-CDG (or another EU data center)
```

**Local vs Remote:**
- `local-XXX` = Worker ran at nearest edge (hint ignored)
- `remote-XXX` = Worker forwarded to target region (hint honored)

With Regional Services, you should always see `remote-XXX` for the target region.

## Enabling Regional Services

Regional Services is an Enterprise feature that requires:

1. **Enterprise Plan** - Contact Cloudflare sales
2. **Entitlement Added** - Request Regional Services entitlement for your account
3. **Configuration** - Update wrangler.toml with region codes

Without the entitlement, attempting to use `region = "eu"` may:
- Fall back to Smart Placement behavior
- Return errors during deployment
- Execute anywhere (no regional guarantee)

## Performance Considerations

### When to Use Regional Services

✅ **Use Regional Services when:**
- GDPR compliance required
- Data must stay within country/region
- Legal/regulatory requirements
- Government/financial services
- Healthcare data processing

❌ **Don't use Regional Services when:**
- Only need performance optimization → Use Smart Placement or Placement Hints
- No compliance requirements → Additional latency for non-regional users
- Static content serving → Use CDN, not regional execution

### Latency Impact

Regional Services adds latency for users outside the target region:

**Example: EU Regional Service accessed from US**
1. Request arrives at US edge (e.g., IAH)
2. Forwarded to EU data center (e.g., CDG) - **~100ms added**
3. Worker executes in EU
4. Response returns to US - **~100ms added**
5. Total added latency: **~200ms** round-trip

**Tradeoff:** Compliance and data residency vs. global performance

## cf-placement Header

All Regional Services requests include the `cf-placement` header:

```
cf-placement: remote-CDG
```

Format: `{local|remote}-{IATA_CODE}`
- **remote** = Forwarded to target region
- **local** = Ran at nearest edge (should not happen with Regional Services)
- **IATA_CODE** = 3-letter airport code (CDG=Paris, NRT=Tokyo, IAH=Houston, etc.)

## Monitoring and Debugging

### Check if Regional Services is Active

```bash
# Test US endpoint
curl -s -D - https://us.healthchecks.ross.gg/api/check -o /dev/null | grep cf-placement
# Expected: cf-placement: remote-IAH (or other US colo)

# Test EU endpoint
curl -s -D - https://eu.healthchecks.ross.gg/api/check -o /dev/null | grep cf-placement
# Expected: cf-placement: remote-CDG (or other EU colo)
```

### Cloudflare Dashboard

1. Go to Workers & Pages → Your Worker
2. Check Metrics → Invocations by Location
3. Verify executions are concentrated in target region

## References

- [Cloudflare Workers Placement Documentation](https://developers.cloudflare.com/workers/configuration/placement/)
- [Smart Placement Guide](https://developers.cloudflare.com/workers/configuration/smart-placement/)
- [Regional Services API Discovery](./SMART_PLACEMENT_VS_REGIONAL_SERVICES.md)
- [Smart Placement Explained](./SMART_PLACEMENT_EXPLAINED.md)

## Notes

- Regional Services regions (`us`, `eu`, `jp`) are **different** from Smart Placement hints (`enam`, `weur`, `apac`)
- Regional Services regions are **different** from Placement Hints cloud regions (`aws:us-east-1`, `gcp:europe-west1`)
- FedRAMP region requires additional government compliance verification
- This is an **active Enterprise feature** (not beta) as of 2025
