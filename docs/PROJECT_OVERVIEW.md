# Global Health Checks - Project Overview

## Project Description

**Global Health Checks** is a Cloudflare Worker application that performs TCP port connectivity tests using the Cloudflare Workers Sockets API with region hints for geo-distributed testing.

## Purpose

Enable users to test TCP port connectivity from Cloudflare's global edge network, providing:
- Real-time health checks for network services
- Geographic latency measurements
- Service availability monitoring
- Debugging network connectivity issues

## Project Goals

### Primary Goals
1. **TCP Port Testing**: Direct TCP socket connectivity checks to any host:port combination
2. **Global Distribution**: Leverage Cloudflare's edge network for testing from multiple geographic regions
3. **Real-time Results**: Provide immediate feedback on connectivity and latency
4. **User-Friendly Interface**: Clean, modern React UI for easy testing
5. **Production-Ready**: Comprehensive testing suite and CI/CD pipeline

### Secondary Goals
- Demonstrate Cloudflare Workers Sockets API capabilities
- Showcase modern React + Vite + TypeScript development patterns
- Provide educational reference for testing best practices
- Enable batch testing for multiple endpoints

## Technology Stack

### Frontend
- **Framework**: React 18.3.1
- **Build Tool**: Vite 6.0.7
- **Language**: TypeScript 5.7.3
- **Styling**: Tailwind CSS (inline styles with CSS custom properties)

### Backend
- **Platform**: Cloudflare Workers
- **Runtime API**: Cloudflare Workers Sockets API
- **Deployment**: Cloudflare Pages + Workers
- **CLI**: Wrangler 3.103.0

### Testing
- **Test Runner**: Vitest (latest)
- **Component Testing**: React Testing Library
- **API Mocking**: MSW (Mock Service Worker)
- **Coverage**: V8 provider
- **CI/CD**: GitHub Actions

## Key Features

### 1. TCP Port Health Checks
- Test any TCP port (1-65535)
- Configurable timeout (1-30 seconds)
- Detailed error reporting
- Latency measurements in milliseconds

### 2. Geographic Region Hints
Support for Cloudflare region codes:
- **enam**: Eastern North America
- **wnam**: Western North America
- **weur**: Western Europe
- **eeur**: Eastern Europe
- **apac**: Asia Pacific
- **oc**: Oceania

### 3. Batch Testing
- Test up to 10 endpoints simultaneously
- Parallel execution for performance
- Aggregated results

### 4. Cloudflare Metadata
- CF-Ray ID tracking
- Data center (colo) information
- Request routing details

### 5. React UI
- Dark theme optimized for monitoring
- Common port quick-select buttons
- Real-time loading states
- Success/error visual feedback
- Responsive design (mobile-friendly)

## API Endpoints

### `POST /api/check`
Single health check endpoint.

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
Batch health check endpoint (max 10 checks).

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
    { "success": true, "host": "example.com", "port": 80, "latencyMs": 30, ... },
    { "success": true, "host": "example.com", "port": 443, "latencyMs": 35, ... }
  ]
}
```

## Use Cases

### 1. Service Health Monitoring
Monitor critical services across geographic regions:
- Database connectivity
- API endpoint availability
- CDN edge server health
- Load balancer status

### 2. Network Debugging
Diagnose connectivity issues:
- Firewall rule verification
- Port accessibility testing
- Routing problem identification
- Regional availability checks

### 3. Latency Testing
Measure connection times:
- Geographic performance analysis
- Network path optimization
- Service response benchmarking
- SLA compliance verification

### 4. Security Auditing
Verify security configurations:
- Exposed port detection
- Service fingerprinting
- Network perimeter testing
- Compliance validation

## Project Structure

```
global-healthchecks/
├── src/
│   ├── worker.ts              # Cloudflare Worker (Sockets API)
│   ├── App.tsx                # React application
│   ├── App.css                # Styling
│   ├── main.tsx               # React entry point
│   ├── components/
│   │   └── Button.tsx         # Reusable button component
│   └── test/                  # Testing infrastructure
├── docs/                      # Documentation
├── .github/workflows/         # CI/CD pipelines
├── dist/                      # Build output
├── index.html                 # HTML entry point
├── package.json               # Dependencies and scripts
├── tsconfig.json              # TypeScript configuration
├── vite.config.ts             # Vite + Vitest configuration
├── wrangler.toml              # Cloudflare Workers configuration
└── README.md                  # Quick start guide
```

## Deployment

### Local Development
```bash
npm install
npm run dev          # React dev server
npm run dev:worker   # Worker local testing
```

### Production Deployment
```bash
npm run build        # Build React app
npm run deploy       # Deploy to Cloudflare Workers
```

### Hosting
- **Frontend**: Cloudflare Pages (auto-deploy from main branch)
- **Worker**: Cloudflare Workers platform
- **Domain**: Custom domain via Cloudflare DNS

## Requirements

### Technical Requirements
- Node.js 18+ or 20+
- npm or pnpm
- Cloudflare account with Workers paid plan (Sockets API requirement)
- Git for version control

### Account Requirements
- **Cloudflare Workers**: Paid plan required for Sockets API access
- **Cloudflare Pages**: Free tier sufficient for static hosting
- **GitHub**: For repository hosting and CI/CD

## Limitations

### Cloudflare Workers Sockets API
- Requires paid Workers plan ($5/month minimum)
- Subject to Workers CPU time limits
- Network egress may incur additional costs

### Application Limits
- Maximum 10 concurrent batch checks
- Timeout range: 1-30 seconds
- Port range: 1-65535 (TCP only, no UDP)

### Security Considerations
- Tool should only test hosts you own or have permission to test
- Rate limiting recommended for production deployments
- Authentication should be added for public exposure

## Future Enhancements

### Planned Features
- [ ] Historical data storage and visualization
- [ ] Scheduled recurring checks
- [ ] Alert/notification system
- [ ] Custom region targeting
- [ ] WebSocket support
- [ ] UDP port testing
- [ ] Export results (JSON, CSV)

### Technical Improvements
- [ ] Authentication system (API keys, OAuth)
- [ ] Rate limiting per user/IP
- [ ] Result caching layer
- [ ] GraphQL API option
- [ ] Progressive Web App (PWA) support

## License

MIT License - See LICENSE file for details

## Repository

- **GitHub**: https://github.com/pocc/global-healthchecks
- **Branch**: main
- **CI/CD**: GitHub Actions

## Contact

For issues, feature requests, or contributions, please use the GitHub issue tracker.

---

**Project Status**: Active Development
**Version**: 1.0.0
**Last Updated**: February 7, 2026
