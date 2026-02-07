# Global Health Checks

A Cloudflare Worker application that performs TCP port connectivity tests using the Sockets API with region hints for geo-distributed testing.

## Features

- 🌍 **Global Testing**: Leverage Cloudflare's edge network to test connectivity from different regions
- 🔌 **TCP Socket Testing**: Direct TCP port connectivity checks using Cloudflare Workers Sockets API
- ⚡ **Fast & Lightweight**: React + Vite frontend with TypeScript
- 📊 **Detailed Results**: Latency measurements, error reporting, and Cloudflare metadata
- 🎯 **Batch Testing**: Test multiple endpoints simultaneously

## Architecture

- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Cloudflare Worker with Sockets API
- **Deployment**: Cloudflare Workers platform

## Prerequisites

- Node.js 18+ and npm
- Cloudflare account with Workers paid plan (Sockets API requires paid plan)
- Wrangler CLI

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure Wrangler**:
   - Update `wrangler.toml` with your zone_id and routes
   - Ensure you're on a paid Cloudflare Workers plan (Sockets API requirement)

3. **Development**:
   ```bash
   # Start React dev server
   npm run dev

   # Or test worker locally
   npm run dev:worker
   ```

4. **Build**:
   ```bash
   npm run build
   ```

5. **Deploy**:
   ```bash
   npm run deploy
   ```

## API Endpoints

### `POST /api/check`

Test a single TCP port.

**Request**:
```json
{
  "host": "example.com",
  "port": 443,
  "timeout": 5000,
  "region": "enam"
}
```

**Response**:
```json
{
  "success": true,
  "host": "example.com",
  "port": 443,
  "region": "enam",
  "latencyMs": 45,
  "timestamp": 1707321600000,
  "cfRay": "123abc",
  "colo": "SJC"
}
```

### `POST /api/batch-check`

Test multiple ports simultaneously (max 10).

**Request**:
```json
{
  "checks": [
    { "host": "example.com", "port": 80 },
    { "host": "example.com", "port": 443 }
  ]
}
```

**Response**:
```json
{
  "results": [
    { "success": true, "host": "example.com", "port": 80, ... },
    { "success": true, "host": "example.com", "port": 443, ... }
  ]
}
```

## Region Hints

Available Cloudflare region codes:
- `enam` - Eastern North America
- `wnam` - Western North America
- `weur` - Western Europe
- `eeur` - Eastern Europe
- `apac` - Asia Pacific
- `oc` - Oceania

## Common Use Cases

1. **Service Health Monitoring**: Check if critical services are accessible
2. **Network Debugging**: Diagnose connectivity issues across regions
3. **Port Scanning**: Verify firewall rules and port configurations
4. **Latency Testing**: Measure connection times from different geographic locations

## Limitations

- Sockets API requires a Cloudflare Workers paid plan
- Maximum 10 concurrent checks per batch request
- Default timeout: 5 seconds (configurable up to 30s)
- Port range: 1-65535

## Security Notes

- This tool should only be used to test hosts you own or have permission to test
- Consider implementing rate limiting for production use
- Add authentication if exposing publicly
- Be aware of Cloudflare Workers [usage limits](https://developers.cloudflare.com/workers/platform/limits/)

## References

- [Cloudflare Workers Sockets API Documentation](https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/)
- [Cloudflare Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)
- [Wrangler Documentation](https://developers.cloudflare.com/workers/wrangler/)

## License

MIT
