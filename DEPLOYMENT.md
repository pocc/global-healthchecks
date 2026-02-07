# Deployment Guide

## Architecture Overview

This project has **two components** that deploy separately:

1. **Frontend (React App)** → Cloudflare Pages
2. **Backend (Worker API)** → Cloudflare Workers

```
┌─────────────────────────────────────────────────┐
│           Cloudflare Pages                      │
│  ┌──────────────────────────────────────────┐   │
│  │  React App (Vite)                        │   │
│  │  - User Interface                        │   │
│  │  - Served from /dist                     │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
                      ↓
              API Calls to /api/*
                      ↓
┌─────────────────────────────────────────────────┐
│           Cloudflare Worker                     │
│  ┌──────────────────────────────────────────┐   │
│  │  Worker (src/worker.ts)                  │   │
│  │  - /api/check endpoint                   │   │
│  │  - /api/batch-check endpoint             │   │
│  │  - Sockets API integration               │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

## Cloudflare Pages Setup (Frontend)

### Build Configuration

**Settings → Build & deployments → Build configuration**:

```yaml
Build command:      npm run build
Build output:       dist
Root directory:     /
Node version:       18 or 20
```

### What Happens

1. Cloudflare Pages pulls from GitHub
2. Runs `npm install`
3. Runs `npm run build` (compiles TypeScript + builds Vite)
4. Deploys `dist/` folder to Pages CDN
5. React app is served at your Pages URL (e.g., `global-healthchecks.pages.dev`)

### Automatic Deployments

- **Production**: Every push to `main` branch
- **Preview**: Every pull request gets a preview deployment

## Cloudflare Worker Setup (Backend)

### Prerequisites

1. **Paid Cloudflare Workers Plan** ($5/month minimum)
   - Required for Sockets API
   - Free plan does NOT support TCP sockets

2. **Wrangler CLI** (installed via npm):
   ```bash
   npm install -g wrangler
   ```

3. **Cloudflare Account Login**:
   ```bash
   wrangler login
   ```

### Manual Deployment

Deploy the Worker to handle API requests:

```bash
# Deploy to production
npx wrangler deploy

# Deploy to development
npx wrangler deploy --env development
```

### What Happens

1. Wrangler compiles `src/worker.ts` with TypeScript
2. Uploads Worker to Cloudflare
3. Worker handles `/api/check` and `/api/batch-check` routes
4. Sockets API is available for TCP port testing

### Worker URL

After deployment, your Worker will be at:
```
https://global-healthchecks.<your-subdomain>.workers.dev
```

## Connecting Frontend to Worker

### Option 1: Same Domain (Recommended)

Configure your Worker to respond at the same domain as Pages:

**In Cloudflare Dashboard**:
1. Go to Workers & Pages
2. Select your Worker
3. Settings → Triggers → Routes
4. Add route: `yourdomain.com/api/*`

**Benefits**:
- No CORS issues
- Cleaner URLs
- Better security

### Option 2: CORS (Current Setup)

Worker already has CORS headers enabled in `src/worker.ts`:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
```

**For production**, restrict the origin:
```typescript
'Access-Control-Allow-Origin': 'https://your-pages-url.pages.dev',
```

## Complete Deployment Workflow

### Local Development

```bash
# Terminal 1: React dev server
npm run dev
# Opens at http://localhost:5173

# Terminal 2: Worker local testing
npm run dev:worker
# Opens at http://localhost:8787
```

### Build & Test Locally

```bash
# Build React app
npm run build

# Preview production build
npm run preview

# Test Worker locally
npx wrangler dev src/worker.ts
```

### Deploy to Production

**Step 1: Deploy Frontend (Automatic)**
```bash
git add .
git commit -m "Update frontend"
git push origin main
# Cloudflare Pages auto-deploys
```

**Step 2: Deploy Worker (Manual)**
```bash
npx wrangler deploy
```

### Verify Deployment

**Frontend**:
```bash
# Visit your Pages URL
https://global-healthchecks.pages.dev
```

**Worker**:
```bash
# Test API endpoint
curl -X POST https://your-worker-url.workers.dev/api/check \
  -H "Content-Type: application/json" \
  -d '{"host":"google.com","port":443}'
```

## Environment Configuration

### Production Environment

**wrangler.toml** (uncomment and configure):

```toml
[env.production]
route = "yourdomain.com/api/*"
zone_id = "your-zone-id-from-cloudflare-dashboard"

[vars]
DEFAULT_PORT = "443"
TIMEOUT_MS = "5000"
```

### Secrets Management

For sensitive data:

```bash
# Set a secret
npx wrangler secret put API_KEY

# List secrets
npx wrangler secret list

# Delete a secret
npx wrangler secret delete API_KEY
```

Access in Worker:
```typescript
export default {
  async fetch(request, env, ctx) {
    const apiKey = env.API_KEY;
    // ...
  }
}
```

## CI/CD with GitHub Actions

The project already has a GitHub Actions workflow (`.github/workflows/test.yml`).

### Add Worker Deployment to CI/CD

Create `.github/workflows/deploy-worker.yml`:

```yaml
name: Deploy Worker

on:
  push:
    branches: [main]
    paths:
      - 'src/worker.ts'
      - 'wrangler.toml'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20.x'

      - run: npm ci

      - name: Deploy Worker
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

**Setup**:
1. Go to Cloudflare Dashboard → My Profile → API Tokens
2. Create Token with "Edit Cloudflare Workers" permissions
3. Add to GitHub Secrets as `CLOUDFLARE_API_TOKEN`

## Troubleshooting

### Frontend Not Loading

**Check**:
- Build output directory is `dist/`
- `npm run build` completes successfully
- No TypeScript errors (`npx tsc --noEmit`)

**Fix**:
```bash
npm run build
# Check dist/ folder exists and has index.html
ls -la dist/
```

### Worker Not Responding

**Check**:
- Worker is deployed: `npx wrangler deployments list`
- Sockets API is enabled (requires paid plan)
- CORS headers are correct

**Fix**:
```bash
# Redeploy worker
npx wrangler deploy

# Check worker logs
npx wrangler tail
```

### API Calls Failing (CORS)

**Check**:
- CORS headers in `src/worker.ts`
- Worker URL is correct in frontend

**Fix** (Option 1 - Same Domain):
```toml
# wrangler.toml
[env.production]
route = "yourdomain.com/api/*"
```

**Fix** (Option 2 - Update CORS):
```typescript
// src/worker.ts
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://your-actual-pages-url.pages.dev',
  // ...
};
```

### Sockets API Not Working

**Check**:
- You have a paid Workers plan ($5/month+)
- `wrangler.toml` has correct compatibility_date

**Verify**:
```bash
# Check account status
npx wrangler whoami

# Check plan limits
# Visit: https://dash.cloudflare.com/
```

## Production Checklist

Before going live:

- [ ] Frontend builds successfully (`npm run build`)
- [ ] All tests pass (`npm test`)
- [ ] Worker deploys successfully (`npx wrangler deploy`)
- [ ] API endpoints respond correctly
- [ ] CORS is configured for production domain
- [ ] Environment variables are set
- [ ] Secrets are configured (if needed)
- [ ] Custom domain is configured
- [ ] SSL/TLS is enabled
- [ ] Worker routes are configured
- [ ] Rate limiting is considered
- [ ] Monitoring is set up

## Monitoring & Logs

### Worker Logs

**Real-time**:
```bash
npx wrangler tail
```

**In Dashboard**:
1. Go to Workers & Pages
2. Select your Worker
3. Click "Logs" tab

### Pages Deployments

**In Dashboard**:
1. Go to Workers & Pages
2. Select your Pages project
3. View deployment history and logs

### Analytics

**Cloudflare Dashboard**:
- Workers → Analytics
- Pages → Analytics
- Real User Monitoring (RUM)

## Cost Estimates

### Cloudflare Pages (Frontend)
- **Free**: Unlimited requests, 500 builds/month
- **Paid**: $20/month for more builds

### Cloudflare Workers (Backend)
- **Paid Plan**: $5/month + usage
  - 10 million requests/month included
  - $0.50 per million requests after
  - Required for Sockets API

**Estimated Monthly Cost**: $5-10/month

## Support Resources

- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Wrangler CLI Docs](https://developers.cloudflare.com/workers/wrangler/)
- [Sockets API Docs](https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/)
- [Community Discord](https://discord.gg/cloudflaredev)

---

**Deployment Guide Version**: 1.0
**Last Updated**: February 7, 2026
