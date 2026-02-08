# Cloudflare Regional Services (Enterprise Feature)

> **Last updated:** 2026-02-07 - Cloud provider region codes and Regional Services regions verified as of this date.

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

## Cloud Provider Regions for Placement Hints

When using Placement Hints (not Regional Services), you can specify cloud provider regions to run Workers near specific infrastructure. The format is `provider:region-code` (e.g., `aws:us-east-1`, `gcp:us-central1`, `azure:eastus`).

### AWS Regions (34 total)

| Code | Name | Geography | Opt-in Required |
|------|------|-----------|-----------------|
| `us-east-1` | US East (N. Virginia) | United States | No |
| `us-east-2` | US East (Ohio) | United States | No |
| `us-west-1` | US West (N. California) | United States | No |
| `us-west-2` | US West (Oregon) | United States | No |
| `af-south-1` | Africa (Cape Town) | South Africa | Yes |
| `ap-east-1` | Asia Pacific (Hong Kong) | Hong Kong | Yes |
| `ap-south-1` | Asia Pacific (Mumbai) | India | No |
| `ap-south-2` | Asia Pacific (Hyderabad) | India | Yes |
| `ap-northeast-1` | Asia Pacific (Tokyo) | Japan | No |
| `ap-northeast-2` | Asia Pacific (Seoul) | South Korea | No |
| `ap-northeast-3` | Asia Pacific (Osaka) | Japan | No |
| `ap-southeast-1` | Asia Pacific (Singapore) | Singapore | No |
| `ap-southeast-2` | Asia Pacific (Sydney) | Australia | No |
| `ap-southeast-3` | Asia Pacific (Jakarta) | Indonesia | Yes |
| `ap-southeast-4` | Asia Pacific (Melbourne) | Australia | Yes |
| `ap-southeast-5` | Asia Pacific (Malaysia) | Malaysia | Yes |
| `ap-southeast-6` | Asia Pacific (New Zealand) | New Zealand | Yes |
| `ap-southeast-7` | Asia Pacific (Thailand) | Thailand | Yes |
| `ap-east-2` | Asia Pacific (Taipei) | Taiwan | Yes |
| `ca-central-1` | Canada (Central) | Canada | No |
| `ca-west-1` | Canada West (Calgary) | Canada | Yes |
| `eu-central-1` | Europe (Frankfurt) | Germany | No |
| `eu-central-2` | Europe (Zurich) | Switzerland | Yes |
| `eu-west-1` | Europe (Ireland) | Ireland | No |
| `eu-west-2` | Europe (London) | United Kingdom | No |
| `eu-west-3` | Europe (Paris) | France | No |
| `eu-north-1` | Europe (Stockholm) | Sweden | No |
| `eu-south-1` | Europe (Milan) | Italy | Yes |
| `eu-south-2` | Europe (Spain) | Spain | Yes |
| `il-central-1` | Israel (Tel Aviv) | Israel | Yes |
| `me-south-1` | Middle East (Bahrain) | Bahrain | Yes |
| `me-central-1` | Middle East (UAE) | United Arab Emirates | Yes |
| `mx-central-1` | Mexico (Central) | Mexico | Yes |
| `sa-east-1` | South America (São Paulo) | Brazil | No |

### GCP Regions (40+ regions)

| Region | Location | Geography | Example Zones |
|--------|----------|-----------|---------------|
| `africa-south1` | Johannesburg | South Africa | a, b, c |
| `asia-east1` | Taiwan | Asia Pacific | a, b, c |
| `asia-east2` | Hong Kong | Asia Pacific | a, b, c |
| `asia-northeast1` | Tokyo | Japan | a, b, c |
| `asia-northeast2` | Osaka | Japan | a, b, c |
| `asia-northeast3` | Seoul | South Korea | a, b, c |
| `asia-south1` | Mumbai | India | a, b, c |
| `asia-south2` | Delhi | India | a, b, c |
| `asia-southeast1` | Singapore | Asia Pacific | a, b, c |
| `asia-southeast2` | Jakarta | Indonesia | a, b, c |
| `asia-southeast3` | Bangkok | Thailand | a, b, c |
| `australia-southeast1` | Sydney | Australia | a, b, c |
| `australia-southeast2` | Melbourne | Australia | a, b, c |
| `europe-central2` | Warsaw | Poland | a, b, c |
| `europe-north1` | Finland | Europe | a, b, c |
| `europe-north2` | Stockholm | Sweden | a, b, c |
| `europe-southwest1` | Madrid | Spain | a, b, c |
| `europe-west1` | Belgium | Europe | b, c, d |
| `europe-west2` | London | United Kingdom | a, b, c |
| `europe-west3` | Frankfurt | Germany | a, b, c |
| `europe-west4` | Netherlands | Europe | a, b, c |
| `europe-west6` | Zurich | Switzerland | a, b, c |
| `europe-west8` | Milan | Italy | a, b, c |
| `europe-west9` | Paris | France | a, b, c |
| `europe-west10` | Berlin | Germany | a, b, c |
| `europe-west12` | Turin | Italy | a, b, c |
| `me-central1` | Doha | Qatar | a, b, c |
| `me-central2` | Dammam | Saudi Arabia | a, b, c |
| `me-west1` | Tel Aviv | Israel | a, b, c |
| `northamerica-northeast1` | Montreal | Canada | a, b, c |
| `northamerica-northeast2` | Toronto | Canada | a, b, c |
| `northamerica-south1` | Mexico | Mexico | a, b, c |
| `southamerica-east1` | São Paulo | Brazil | a, b, c |
| `southamerica-west1` | Santiago | Chile | a, b, c |
| `us-central1` | Iowa | United States | a, b, c, f |
| `us-east1` | South Carolina | United States | b, c, d |
| `us-east4` | Virginia | United States | a, b, c |
| `us-east5` | Ohio | United States | a, b, c |
| `us-south1` | Dallas | United States | a, b, c |
| `us-west1` | Oregon | United States | a, b, c |
| `us-west2` | Los Angeles | United States | a, b, c |
| `us-west3` | Utah | United States | a, b, c |
| `us-west4` | Las Vegas | United States | a, b, c |

**Note:** GCP zones are appended to region (e.g., `us-central1-a`, `asia-east1-b`)

### Azure Regions (60+ regions)

| Programmatic Name | Physical Location | Geography | AZ Support |
|-------------------|-------------------|-----------|------------|
| `australiacentral` | Canberra | Australia | No |
| `australiacentral2` | Canberra | Australia | No |
| `australiaeast` | New South Wales | Australia | Yes |
| `australiasoutheast` | Victoria | Australia | No |
| `austriaeast` | Vienna | Austria | Yes |
| `belgiumcentral` | Brussels | Belgium | Yes |
| `brazilsouth` | Sao Paulo State | Brazil | Yes |
| `brazilsoutheast` | Rio | Brazil | No |
| `canadacentral` | Toronto | Canada | Yes |
| `canadaeast` | Quebec | Canada | No |
| `centralindia` | Pune | India | Yes |
| `centralus` | Iowa | United States | Yes |
| `chilecentral` | Santiago | Chile | Yes |
| `denmarkeast` | Copenhagen | Denmark | Yes |
| `eastasia` | Hong Kong SAR | Asia Pacific | Yes |
| `eastus` | Virginia | United States | Yes |
| `eastus2` | Virginia | United States | Yes |
| `francecentral` | Paris | France | Yes |
| `francesouth` | Marseille | France | No |
| `germanynorth` | Berlin | Germany | No |
| `germanywestcentral` | Frankfurt | Germany | Yes |
| `indonesiacentral` | Jakarta | Indonesia | Yes |
| `israelcentral` | Israel | Israel | Yes |
| `italynorth` | Milan | Italy | Yes |
| `japaneast` | Tokyo, Saitama | Japan | Yes |
| `japanwest` | Osaka | Japan | Yes |
| `koreacentral` | Seoul | Korea | Yes |
| `koreasouth` | Busan | Korea | No |
| `malaysiawest` | Kuala Lumpur | Malaysia | Yes |
| `mexicocentral` | Querétaro State | Mexico | Yes |
| `newzealandnorth` | Auckland | New Zealand | Yes |
| `northcentralus` | Illinois | United States | No |
| `northeurope` | Ireland | Europe | Yes |
| `norwayeast` | Norway | Norway | Yes |
| `norwaywest` | Norway | Norway | No |
| `polandcentral` | Warsaw | Poland | Yes |
| `qatarcentral` | Doha | Qatar | Yes |
| `southafricanorth` | Johannesburg | South Africa | Yes |
| `southafricawest` | Cape Town | South Africa | No |
| `southcentralus` | Texas | United States | Yes |
| `southindia` | Chennai | India | No |
| `southeastasia` | Singapore | Asia Pacific | Yes |
| `spaincentral` | Madrid | Spain | Yes |
| `swedencentral` | Gävle | Sweden | Yes |
| `switzerlandnorth` | Zurich | Switzerland | Yes |
| `switzerlandwest` | Geneva | Switzerland | No |
| `uaecentral` | Abu Dhabi | UAE | No |
| `uaenorth` | Dubai | UAE | Yes |
| `uksouth` | London | United Kingdom | Yes |
| `ukwest` | Cardiff | United Kingdom | No |
| `westcentralus` | Wyoming | United States | No |
| `westeurope` | Netherlands | Europe | Yes |
| `westindia` | Mumbai | India | No |
| `westus` | California | United States | No |
| `westus2` | Washington | United States | Yes |
| `westus3` | Phoenix | United States | Yes |

### Using Cloud Provider Regions

**Configuration example:**
```toml
[placement]
region = "aws:us-east-1"  # Run near AWS US-East
# OR
region = "gcp:europe-west1"  # Run near GCP Europe West
# OR
region = "azure:eastus"  # Run near Azure East US
```

**Important notes:**
- These are **hints**, not guarantees - Cloudflare may override for performance
- For guaranteed regional execution, use Regional Services instead (see above)
- Useful for reducing latency to cloud-hosted databases, APIs, or services
- Format: `provider:region-code` (no zones for GCP - use region only)

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
