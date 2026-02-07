# Technical Architecture

## System Architecture

Global Health Checks uses a **serverless edge computing architecture** powered by Cloudflare Workers with a React single-page application (SPA) frontend.

```
┌─────────────────────────────────────────────────────────────┐
│                         Client Layer                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │         React SPA (Vite + TypeScript)                │   │
│  │  - User Interface                                     │   │
│  │  - Form Validation                                    │   │
│  │  - Result Display                                     │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────┘
                            │ HTTPS
                            │ fetch('/api/check')
┌───────────────────────────▼─────────────────────────────────┐
│                   Cloudflare Edge Network                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │           Cloudflare Worker                          │   │
│  │  - Request Routing                                    │   │
│  │  - Input Validation                                   │   │
│  │  - Sockets API Integration                            │   │
│  │  - Response Formatting                                │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────────┬─────────────────────────────────┘
                            │ TCP Socket
                            │ connect(host, port)
┌───────────────────────────▼─────────────────────────────────┐
│                     Target Servers                           │
│  - example.com:443                                           │
│  - api.service.com:8080                                      │
│  - database.internal:3306                                    │
└──────────────────────────────────────────────────────────────┘
```

## Component Architecture

### Frontend (React SPA)

#### Component Tree
```
App.tsx
├── Header
│   ├── Title
│   └── Description
├── HealthCheckForm
│   ├── HostInput
│   ├── PortInput
│   ├── CommonPortButtons
│   ├── TimeoutInput
│   ├── RegionSelector
│   └── SubmitButton
├── ResultDisplay (conditional)
│   ├── SuccessMessage | ErrorMessage
│   ├── LatencyDisplay
│   ├── MetadataDisplay
│   │   ├── CF-Ray
│   │   ├── Colo
│   │   └── Timestamp
│   └── ErrorDetails (if failed)
└── Footer
    └── Documentation Link
```

#### Data Flow
```
User Input → Form State → API Request → Loading State → Result State → UI Update
     ↓           ↓            ↓             ↓              ↓            ↓
  onChange → useState → fetch() → setLoading → setResult → render
```

### Backend (Cloudflare Worker)

#### Request Flow
```
1. fetch() → Request received
              ↓
2. CORS Preflight Check
   - OPTIONS → Return CORS headers
              ↓
3. Route Matching
   - /api/check → Single check
   - /api/batch-check → Batch checks
   - other → Static response
              ↓
4. Request Validation
   - Parse JSON body
   - Validate host/port
   - Check port range (1-65535)
              ↓
5. TCP Socket Test
   - connect(host, port, options)
   - Wait for opened promise
   - Measure latency
   - Handle timeout
   - Close socket
              ↓
6. Enrich Response
   - Add CF-Ray header
   - Add colo metadata
   - Add timestamp
              ↓
7. Return Response
   - JSON format
   - CORS headers
   - HTTP 200/400
```

#### Worker Handler Structure
```typescript
export default {
  async fetch(request, _env, _ctx) {
    // 1. Parse URL and method
    const url = new URL(request.url);

    // 2. Handle CORS
    if (request.method === 'OPTIONS') return corsResponse;

    // 3. Route to handler
    if (url.pathname === '/api/check') {
      return handleSingleCheck(request);
    }

    // 4. Default response
    return new Response('...');
  }
}
```

## Data Models

### TypeScript Interfaces

#### HealthCheckRequest
```typescript
interface HealthCheckRequest {
  host: string;           // Hostname or IP address
  port: number;           // TCP port (1-65535)
  timeout?: number;       // Timeout in ms (default: 5000)
  region?: string;        // CF region hint (optional)
}
```

#### HealthCheckResult
```typescript
interface HealthCheckResult {
  success: boolean;       // Connection success/failure
  host: string;           // Tested hostname
  port: number;           // Tested port
  region?: string;        // Region hint used
  latencyMs?: number;     // Round-trip time in ms
  error?: string;         // Error message (if failed)
  timestamp: number;      // Unix timestamp
  cfRay?: string;         // Cloudflare Ray ID
  colo?: string;          // CF data center code
}
```

#### BatchCheckRequest
```typescript
interface BatchCheckRequest {
  checks: HealthCheckRequest[];  // Max 10 items
}
```

#### BatchCheckResponse
```typescript
interface BatchCheckResponse {
  results: HealthCheckResult[];
}
```

## Cloudflare Workers Sockets API

### connect() Function

The Sockets API provides a `connect()` function for TCP connections:

```typescript
declare function connect(
  address: { hostname: string; port: number },
  options?: {
    secureTransport?: 'off' | 'on' | 'starttls';
    allowHalfOpen?: boolean;
  }
): Socket;

interface Socket {
  opened: Promise<void>;           // Resolves when connected
  closed: Promise<void>;           // Resolves when closed
  readable: ReadableStream;        // Data from server
  writable: WritableStream;        // Data to server
  close(): Promise<void>;          // Close connection
}
```

### Connection Flow

```typescript
// 1. Initiate connection
const socket = connect(
  { hostname: 'example.com', port: 443 },
  { secureTransport: 'off' }
);

// 2. Wait for connection (with timeout)
const timeout = new Promise((_, reject) =>
  setTimeout(() => reject(new Error('Timeout')), 5000)
);

await Promise.race([socket.opened, timeout]);

// 3. Close socket
await socket.close();
```

### Security Transport Options

- **`off`**: Plain TCP connection (no TLS)
- **`on`**: TLS connection (HTTPS-like)
- **`starttls`**: Start plain, upgrade to TLS

For health checks, we use `off` to test raw TCP connectivity.

## State Management

### React State (useState)

```typescript
// Form inputs
const [host, setHost] = useState('');
const [port, setPort] = useState('443');
const [timeout, setTimeout] = useState('5000');
const [region, setRegion] = useState('');

// UI state
const [loading, setLoading] = useState(false);
const [result, setResult] = useState<HealthCheckResult | null>(null);
```

### State Transitions

```
Initial State
  ↓ (user fills form)
Form Valid State
  ↓ (user clicks submit)
Loading State
  ↓ (API responds)
Result State (success or error)
  ↓ (user modifies form)
Form Modified State
  ↓ (user submits again)
[cycle repeats]
```

## Error Handling

### Frontend Error Handling

```typescript
try {
  const response = await fetch('/api/check', { ... });
  const data = await response.json();
  setResult(data);
} catch (error) {
  // Network error, timeout, or invalid JSON
  setResult({
    success: false,
    host,
    port: parseInt(port),
    error: error instanceof Error ? error.message : 'Request failed',
    timestamp: Date.now(),
  });
}
```

### Backend Error Handling

```typescript
try {
  // Parse request
  const body = await request.json();

  // Validate input
  if (!body.host || !body.port) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields' }),
      { status: 400 }
    );
  }

  // Test connection
  const result = await testTcpPort(body);
  return new Response(JSON.stringify(result));

} catch (error) {
  // Socket error, timeout, or parsing error
  return new Response(
    JSON.stringify({
      success: false,
      error: error.message,
      timestamp: Date.now(),
    })
  );
}
```

### Error Types

1. **Validation Errors** (400)
   - Missing host/port
   - Invalid port range
   - Invalid JSON

2. **Connection Errors** (200 with success: false)
   - Connection timeout
   - Connection refused
   - Host unreachable
   - DNS resolution failure

3. **Network Errors** (client-side)
   - Request timeout
   - Network offline
   - CORS blocked

## Performance Optimization

### Frontend Optimizations

1. **Debouncing**: Prevent rapid form submissions
2. **Lazy Loading**: Load components on demand
3. **Code Splitting**: Separate vendor bundles
4. **CSS Optimization**: Inline critical styles

### Backend Optimizations

1. **Parallel Execution**: Batch checks run concurrently
2. **Early Timeout**: Fail fast on unreachable hosts
3. **Connection Reuse**: (Future: connection pooling)
4. **Response Compression**: Gzip/Brotli (Cloudflare automatic)

### Build Optimizations

```javascript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
        },
      },
    },
  },
});
```

## Security Architecture

### Input Validation

```typescript
// Port range validation
if (body.port < 1 || body.port > 65535) {
  return errorResponse('Port must be between 1 and 65535');
}

// Host validation (basic)
if (!/^[a-zA-Z0-9.-]+$/.test(body.host)) {
  return errorResponse('Invalid hostname format');
}
```

### CORS Configuration

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',        // Production: restrict
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
```

**Production Recommendation**: Restrict origin to specific domains.

### Rate Limiting (Recommended)

```typescript
// Future implementation
const rateLimiter = new Map<string, number>();

function checkRateLimit(ip: string): boolean {
  const requests = rateLimiter.get(ip) || 0;
  if (requests > 100) return false; // 100 requests per minute

  rateLimiter.set(ip, requests + 1);
  return true;
}
```

## Monitoring & Observability

### Cloudflare Analytics

- Request count
- Error rate
- Latency percentiles (p50, p95, p99)
- Geographic distribution
- Data center usage

### Custom Metrics (Future)

```typescript
// Example: Track success rate
const metrics = {
  total: 0,
  success: 0,
  errors: 0,
  avgLatency: 0,
};

// Export to analytics service
ctx.waitUntil(sendMetrics(metrics));
```

### Logging

```typescript
// Cloudflare Workers logs
console.log(`Health check: ${host}:${port} - ${success ? 'OK' : 'FAIL'}`);
```

## Deployment Architecture

### CI/CD Pipeline

```
Git Push → GitHub Actions
    ↓
Run Tests (Vitest)
    ↓
Type Check (tsc)
    ↓
Build (vite build)
    ↓
Deploy to Cloudflare Pages (automatic)
    ↓
Deploy Worker (wrangler deploy)
```

### Environment Strategy

- **Development**: Local Vite dev server + Wrangler local
- **Preview**: Cloudflare Pages preview deployments
- **Production**: Cloudflare Pages + Workers production

### Deployment Targets

```toml
# wrangler.toml
[env.production]
route = "healthchecks.example.com/*"
zone_id = "your-zone-id"

[env.staging]
route = "staging.healthchecks.example.com/*"
zone_id = "your-zone-id"
```

## Scalability

### Horizontal Scaling

Cloudflare Workers automatically scale across:
- **200+ data centers** globally
- **Unlimited concurrent requests** (within plan limits)
- **Automatic load balancing** across edge locations

### Vertical Scaling

- **CPU Time**: 50ms free, 30s paid (per request)
- **Memory**: 128MB per request
- **Concurrent Connections**: Subject to plan limits

### Performance Characteristics

- **Cold Start**: ~5-10ms (Workers)
- **Warm Request**: <1ms overhead
- **Global Latency**: 10-50ms (edge to user)
- **Socket Latency**: Varies by target host

---

**Architecture Version**: 1.0
**Last Updated**: February 7, 2026
