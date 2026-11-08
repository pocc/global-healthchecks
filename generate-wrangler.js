/**
 * Generates wrangler.toml: the production Worker plus one environment per check location.
 *
 * To add a location, append it to the matching list below, then run:
 *   node generate-wrangler.js
 * and deploy it with `npx wrangler deploy --env <name>`.
 *
 * src/test/generateWrangler.test.ts fails if wrangler.toml and this script drift apart.
 */

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ZONE = 'ross.gg';
const DOMAIN = `healthchecks.${ZONE}`;

/** Regional Services hostnames. The region itself is assigned per hostname in Cloudflare, not here. */
export const REGIONAL_SERVICES = ['us', 'ca', 'eu', 'isoeu', 'de', 'jp', 'sg', 'kr', 'in', 'au'];

export const AWS_REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'af-south-1', 'ap-east-1', 'ap-south-1', 'ap-south-2',
  'ap-northeast-1', 'ap-northeast-2', 'ap-northeast-3',
  'ap-southeast-1', 'ap-southeast-2', 'ap-southeast-3', 'ap-southeast-4',
  'ap-southeast-5', 'ap-southeast-6', 'ap-southeast-7', 'ap-east-2',
  'ca-central-1', 'ca-west-1',
  'eu-central-1', 'eu-central-2', 'eu-west-1', 'eu-west-2', 'eu-west-3',
  'eu-north-1', 'eu-south-1', 'eu-south-2',
  'il-central-1', 'me-south-1', 'me-central-1', 'mx-central-1', 'sa-east-1',
];

export const GCP_REGIONS = [
  'africa-south1',
  'asia-east1', 'asia-east2', 'asia-northeast1', 'asia-northeast2', 'asia-northeast3',
  'asia-south1', 'asia-south2', 'asia-southeast1', 'asia-southeast2', 'asia-southeast3',
  'australia-southeast1', 'australia-southeast2',
  'europe-central2', 'europe-north1', 'europe-north2', 'europe-southwest1',
  'europe-west1', 'europe-west2', 'europe-west3', 'europe-west4', 'europe-west6',
  'europe-west8', 'europe-west9', 'europe-west10', 'europe-west12',
  'me-central1', 'me-central2', 'me-west1',
  'northamerica-northeast1', 'northamerica-northeast2', 'northamerica-south1',
  'southamerica-east1', 'southamerica-west1',
  'us-central1', 'us-east1', 'us-east4', 'us-east5', 'us-south1',
  'us-west1', 'us-west2', 'us-west3', 'us-west4',
];

export const AZURE_REGIONS = [
  'australiacentral', 'australiacentral2', 'australiaeast', 'australiasoutheast',
  'austriaeast', 'belgiumcentral',
  'brazilsouth', 'brazilsoutheast',
  'canadacentral', 'canadaeast',
  'centralindia', 'centralus', 'chilecentral',
  'denmarkeast',
  'eastasia', 'eastus', 'eastus2',
  'francecentral', 'francesouth',
  'germanynorth', 'germanywestcentral',
  'indonesiacentral', 'israelcentral', 'italynorth',
  'japaneast', 'japanwest',
  'koreacentral', 'koreasouth',
  'malaysiawest', 'mexicocentral',
  'newzealandnorth', 'northcentralus', 'northeurope',
  'norwayeast', 'norwaywest',
  'polandcentral',
  'qatarcentral',
  'southafricanorth', 'southafricawest', 'southcentralus', 'southindia', 'southeastasia',
  'spaincentral', 'swedencentral',
  'switzerlandnorth', 'switzerlandwest',
  'uaecentral', 'uaenorth',
  'uksouth', 'ukwest',
  'westcentralus', 'westeurope', 'westindia', 'westus', 'westus2', 'westus3',
];

const HEADER = `name = "global-healthchecks"
main = "src/worker.ts"
compatibility_date = "2025-02-07"
compatibility_flags = ["nodejs_compat"]
account_id = "e7452b39fc737014144e3b3fca412900"

# Serve static assets from dist/ directory
assets = { directory = "dist", binding = "ASSETS" }

# Enable sockets API
workers_dev = true

# Production: Handle all routes (frontend + API)
[env.production]
[[env.production.routes]]
pattern = "${DOMAIN}"
custom_domain = true

[observability.logs]
enabled = true
invocation_logs = true

`;

/** @param {string} title */
const banner = (title) => `# ============================================================================
# ${title}
# ============================================================================

`;

/**
 * Location Workers use zone routes (not Custom Domains) so one proxied wildcard
 * DNS record (*.healthchecks) covers every location hostname.
 * @param {string} env
 */
const route = (env) => `[env.${env}]
[[env.${env}.routes]]
pattern = "${env}.${DOMAIN}/*"
zone_name = "${ZONE}"
`;

/**
 * @param {string} provider  aws | gcp | azure
 * @param {string} region    provider region code, e.g. us-east-1
 */
const placed = (provider, region) => `${route(`${provider}-${region}`)}[env.${provider}-${region}.placement]
mode = "targeted"
region = "${provider}:${region}"

`;

/** @returns {string} the full contents of wrangler.toml */
export function generateWranglerToml() {
  return [
    HEADER,
    banner(`Regional Services Workers (${REGIONAL_SERVICES.length}) - Enterprise feature with guaranteed regions`),
    ...REGIONAL_SERVICES.map((env) => `${route(env)}\n`),
    banner(`AWS Placement Hints (${AWS_REGIONS.length}) - Cloud provider region hints`),
    ...AWS_REGIONS.map((r) => placed('aws', r)),
    banner(`GCP Placement Hints (${GCP_REGIONS.length}) - Cloud provider region hints`),
    ...GCP_REGIONS.map((r) => placed('gcp', r)),
    banner(`Azure Placement Hints (${AZURE_REGIONS.length}) - Cloud provider region hints`),
    ...AZURE_REGIONS.map((r) => placed('azure', r)),
  ].join('');
}

// Write only when run directly (`node generate-wrangler.js`), not when imported by tests.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    writeFileSync(new URL('./wrangler.toml', import.meta.url), generateWranglerToml());
    const total = REGIONAL_SERVICES.length + AWS_REGIONS.length + GCP_REGIONS.length + AZURE_REGIONS.length;
    console.log(`✓ Generated wrangler.toml: production + ${total} locations ` +
      `(${REGIONAL_SERVICES.length} regional, ${AWS_REGIONS.length} AWS, ${GCP_REGIONS.length} GCP, ${AZURE_REGIONS.length} Azure)`);
  } catch (error) {
    console.error('✗ Failed to write wrangler.toml:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
