# Smart Placement Explained

> **Note:** This project uses both **Regional Services** (guaranteed regional execution) and **Smart Placement** (performance-optimized hints). See [REGIONAL_SERVICES.md](./REGIONAL_SERVICES.md) for comprehensive documentation on the differences between these approaches.

## What Smart Placement Actually Does

In Cloudflare, Smart Placement is effectively an **automated migration engine** for your Worker's execution location.

Standard Workers run in the data center closest to the user. While this is great for front-end performance, it's a disaster for performance if your Worker needs to talk to a database located halfway across the world.

## The "Distance" Problem

If a user in London triggers a Worker that needs to query a database in Virginia (US-East):

- **Standard**: Worker runs in London → Sends query across the Atlantic → Waits → Receives data → Responds to user.
- **Smart Placement**: Cloudflare detects the database is in Virginia → It moves the Worker execution to Virginia → Worker talks to DB over a local/high-speed link → Result is sent back to London in one trip.

## Automated Path Analysis

Cloudflare analyzes the "sub-requests" your Worker makes (using `fetch`). If it notices that the majority of your time is spent waiting on a specific origin (like a PostgreSQL DB or an API), it calculates whether moving the Worker closer to that origin would decrease the total Time to First Byte (TTFB).

## Smart Placement vs Regional Services

These are two different approaches to controlling where Workers execute:

| Feature | Control | Guarantee | Primary Use Case |
|---------|---------|-----------|------------------|
| **Regional Services** | You choose the region | Hard geographic boundaries | Compliance, data residency, legal requirements |
| **Smart Placement** | Cloudflare optimizes placement | Best effort (may be overridden) | Performance optimization, reducing latency |

### Regional Services - Guaranteed Regional Execution
Regional Services provides **hard guarantees** about where code executes:
- **Explicit region selection**: You specify the region using codes like `us`, `eu`, `jp`
- **Geographic boundaries**: Workers are guaranteed to execute within the specified region
- **Compliance focused**: Designed for GDPR, data sovereignty, and regulatory requirements
- **Cannot be overridden**: Cloudflare will not move execution outside the specified region for performance
- **Example use**: EU-based application must ensure all data processing stays within EU borders

### Smart Placement - Performance Optimization
Smart Placement provides **performance hints** that Cloudflare uses to optimize execution:
- **Hint-based system**: You provide hints like `enam` (East North America), `weur` (West Europe)
- **Performance driven**: Cloudflare may override hints to optimize for speed
- **Best effort**: No guarantees about execution location
- **Available to all**: Can be used on any Cloudflare Workers plan
- **Example use**: Worker that talks to a database in Virginia - hint `enam` to run near the database

### When to Use Each

**Use Regional Services when:**
- Legal or regulatory requirements mandate data stays in specific regions
- GDPR compliance requires EU-only processing
- Data sovereignty laws apply
- You need verifiable proof of execution location

**Use Smart Placement when:**
- You want to optimize performance but don't have compliance requirements
- Your Worker makes backend calls to specific regions (databases, APIs)
- You want to reduce latency to origin servers
- Geographic guarantees aren't legally required

## How to Use Smart Placement

Enable it in your `wrangler.toml`:

```toml
[placement]
mode = "smart"

[env.production]
placement = { mode = "smart", hint = "enam" }
```

## When NOT to Use Smart Placement

1. **Static Sites**: If your Worker just serves HTML/CSS from the Edge, keep it near the user.
2. **Strict Compliance**: If you have a legal requirement to process data in a specific country, use Regional Placement instead. Smart Placement prioritizes speed over geography and might move a "German" user's request to a US data center if that's where your database lives.

## Detecting Execution Location in Workers

### Using the `request.cf` object (Recommended)

Cloudflare populates a special `cf` object on the incoming Request. The `colo` property contains the 3-letter IATA airport code of the data center where the Worker is currently executing.

```javascript
export default {
  async fetch(request, env, ctx) {
    const colo = request.cf.colo;
    // Example output: "DFW" (Dallas), "LAX" (Los Angeles), "FRA" (Frankfurt)

    return new Response(`This request is being handled in: ${colo}`);
  }
}
```

### Using the CF-Ray Header

Every request through Cloudflare has a unique Ray ID. The Ray ID itself actually contains the colo code appended to the end after a hyphen.

```javascript
const rayId = request.headers.get("cf-ray");
const colo = rayId.split("-")[1];
// If rayId is "8ef123456789-DFW", colo becomes "DFW"
```

## Important Distinction: Entry vs Execution

- **Entry Colo**: The data center where the user's connection first hits Cloudflare's network.
- **Execution Colo**: The data center where your Worker code actually runs.

If you have Smart Placement enabled, these two might be different. The `request.cf.colo` property reflects where the code is **currently executing**.

To see if Smart Placement moved your request, look for the `cf-placement` header:
- `local` = Running at the edge near the user
- `remote-XXX` = Smart Placement sent it elsewhere (e.g., `remote-CDG` = forwarded to Paris)

## Our Implementation

This global health checks project demonstrates both placement approaches:

### Regional Services Endpoints (10 regions)
These Workers use guaranteed regional execution:
- **Regions**: us, ca, eu, de, jp, sg, kr, in, au, isoeu
- **Guarantee**: Workers MUST execute within the specified geographic region
- **Configuration**: `region = "us"` in wrangler.toml
- **Verification**: Check `cf-placement` header - should always show `remote-XXX` for target region

### Smart Placement Endpoints (9 regions)
These Workers use performance hints:
- **Hints**: enam, wnam, sam, weur, eeur, apac, oc, afr, me
- **Behavior**: Cloudflare may override hints to optimize performance
- **Configuration**: `mode = "smart", hint = "enam"` in wrangler.toml
- **Verification**: Check `cf-placement` header - may show `local-XXX` if hint was ignored

### Comparing Behavior

In testing, you'll notice different behaviors:
- **Regional Services**: Consistently shows forwarding (e.g., `remote-CDG` for EU)
- **Smart Placement**: May show `local-IAH` even with hint `weur`, if Cloudflare determines local execution is faster

This demonstrates the key difference: Regional Services guarantees location, Smart Placement optimizes for speed.

See [REGIONAL_SERVICES.md](./REGIONAL_SERVICES.md) for detailed configuration and verification steps.

## Monitoring Smart Placement

You can see the "Placement" tab in your Cloudflare Dashboard to view a map of where your Workers are actually running versus where the users are.

The `cf-placement` response header shows whether the Worker ran locally or was forwarded:
- `local-IAH` = Ran in Houston (user's nearest data center)
- `remote-CDG` = Forwarded to Paris (following Smart Placement hint)
