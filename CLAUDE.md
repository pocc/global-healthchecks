# Claude Code Project Guidelines — Global Health Checks

## Tech Stack
- **Frontend:** Vite + React + TypeScript + D3-Geo (WorldMap)
- **Backend:** Cloudflare Workers (Sockets API for TCP/TLS/HTTP checks)
- **Deployment:** 143 Cloudflare Worker endpoints (10 regional services + 133 targeted placements)

## Commands
- `npm run dev` — Vite dev server
- `npm run build` — Build (generate build info + tsc + vite build)
- `npm run test:run` — Run Vitest unit/integration tests
- `npx playwright test` — Run Playwright e2e tests
- `npx wrangler dev` — Worker dev server
- `npx wrangler deploy --env production` — Deploy to production (`healthchecks.ross.gg`)

## Validation — CRITICAL
**ALWAYS run `npm run build` AND `npm run test:run` before recommending `git push` or `npx wrangler deploy`.**

This ensures:
- No TypeScript errors
- No unused variables or imports
- All unit/integration tests pass
- No breaking changes

## Project Structure
- `src/worker.ts` — Cloudflare Worker with TCP/TLS/HTTP check endpoints
- `src/App.tsx` — Main React app (health check UI, region selection)
- `src/WorldMap.tsx` — D3-Geo animated world map visualization
- `src/regionCoordinates.ts` — 143 region coordinate definitions
- `e2e/` — Playwright e2e tests (excluded from Vitest, run separately)
- `src/components/` — React components
- `src/test/` — Vitest test setup and integration tests

## Key Patterns
- Each region gets its own independent fetch request (parallel, non-blocking)
- Animations use speed-adaptive replay delay via `getReplayDelay(speedMult)`
- Timeouts are per-socket, not global
- e2e tests use Playwright (separate from Vitest unit tests)
