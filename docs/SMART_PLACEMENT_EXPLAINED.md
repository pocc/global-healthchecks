# Smart Placement Explained

> **Note:** This project now uses **Regional Services** (Enterprise feature) for guaranteed regional execution. See [REGIONAL_SERVICES.md](./REGIONAL_SERVICES.md) for comprehensive documentation on Regional Services vs Smart Placement.

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

This is a common point of confusion:

| Feature | Control | Purpose |
|---------|---------|---------|
| **Regional Services** | You choose the region | Compliance & Legal (e.g., "Data must stay in the EU") |
| **Smart Placement** | Cloudflare chooses the region | Performance (e.g., "Run this next to the database") |

### Regional Services (Enterprise Feature)
- You explicitly choose the region (us, eu, jp, etc.)
- Guarantees data stays within geographic boundaries
- Required for GDPR compliance, data sovereignty
- Requires Enterprise plan

### Smart Placement (Performance Hints)
- You provide a "hint" (enam, weur, apac, etc.)
- Cloudflare decides where to actually run the Worker
- Optimizes for speed, not geography
- Available on all plans
- May ignore hints to optimize performance

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

In this project, we have:
- **10 Regional Services endpoints** (us, ca, eu, de, jp, sg, kr, in, au, isoeu) - **Enterprise feature enabled**
- **9 Smart Placement hint workers** (enam, wnam, sam, weur, eeur, apac, oc, afr, me)

**Regional Services endpoints** (10) use guaranteed regional execution - Workers MUST execute within the specified geographic region.

**Smart Placement endpoints** (9) use performance hints - Cloudflare may override hints and run the Worker anywhere for optimal performance.

See [REGIONAL_SERVICES.md](./REGIONAL_SERVICES.md) for details on the Regional Services configuration and verification.

## Monitoring Smart Placement

You can see the "Placement" tab in your Cloudflare Dashboard to view a map of where your Workers are actually running versus where the users are.

The `cf-placement` response header shows whether the Worker ran locally or was forwarded:
- `local-IAH` = Ran in Houston (user's nearest data center)
- `remote-CDG` = Forwarded to Paris (following Smart Placement hint)
