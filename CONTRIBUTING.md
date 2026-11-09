# Contributing

## Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind, D3-Geo ([src/App.tsx](src/App.tsx), [src/WorldMap.tsx](src/WorldMap.tsx))
- **Backend:** one Cloudflare Worker ([src/worker.ts](src/worker.ts)) that serves the API and the built frontend (`dist/`, via the `ASSETS` binding)
- **Config:** [wrangler.toml](wrangler.toml) defines `production` plus one `[env.*]` per location

## Local development

Requires Node 22+ (Wrangler needs it).

```bash
npm install
npm run dev          # frontend at http://localhost:5173
npm run dev:worker   # Worker + API at http://localhost:8787 (run `npm run build` first for the UI)
```

Locally, sockets connect from your machine and placement doesn't apply. Check timing changes against a deployed Worker.

## Tests

| Command | What |
|---|---|
| `npm run test:run` | Vitest unit and integration tests, run once |
| `npm test` | Vitest in watch mode |
| `npm run test:coverage` | With coverage |
| `npx playwright test` | Playwright end-to-end tests in [e2e/](e2e/) (starts Vite on :5173) |

Layout:

- `src/**/*.test.tsx`: component and integration tests (Testing Library)
- `src/test/mocks/handlers.ts`: [MSW](https://mswjs.io/) mocks for `/api/check`. Add a handler when tests need another endpoint.
- `src/test/utils/testUtils.tsx`: custom `render` helper
- `e2e/`: browser tests, excluded from Vitest

Git hooks (Husky): **pre-commit** scans staged changes with [gitleaks](https://github.com/gitleaks/gitleaks) (`brew install gitleaks`; skipped with a warning if missing) and runs `npm run type-check`; **pre-push** runs type-check and `npm run test:run`.

CI: [test.yml](.github/workflows/test.yml) runs type-check, tests with coverage, and build; [gitleaks.yml](.github/workflows/gitleaks.yml) scans the full git history on every push and PR.

**Before opening a PR:** `npm run build && npm run test:run`.

## Deploying your own copy

1. `npx wrangler login`
2. In `wrangler.toml`, set `account_id` and replace `healthchecks.ross.gg` / `ross.gg` with your own zone.
3. Make sure every location hostname has a proxied DNS record. Cloudflare requires one for each route hostname; a single wildcard record covers them all.
4. Build and deploy:

```bash
npm run build
npx wrangler deploy --env production
./deploy/deploy-all.sh    # every [env.*] in wrangler.toml, 1 s apart
```

Deploy a single location with `npx wrangler deploy --env aws-us-east-1`.

Regional Services hostnames (`us`, `eu`, …) are assigned in the Cloudflare dashboard or API and need the Regional Services Enterprise add-on. Without it they run wherever the request arrives.

### Adding a location

1. Add the region code to `AWS_REGIONS`, `GCP_REGIONS`, `AZURE_REGIONS` or `REGIONAL_SERVICES` in [generate-wrangler.js](generate-wrangler.js).
2. Run `node generate-wrangler.js` to rewrite `wrangler.toml`. Don't hand-edit `wrangler.toml`: `src/test/generateWrangler.test.ts` fails if the two differ.
3. Add the location to the UI: its list in [src/utils/regions.ts](src/utils/regions.ts) and its map position in [src/regionCoordinates.ts](src/regionCoordinates.ts).
4. `npx wrangler deploy --env <name>`. The wildcard DNS record already covers the new hostname.
