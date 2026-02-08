/**
 * Generate wrangler.toml with all cloud provider region configurations
 * This creates 132+ worker environments for testing Smart Placement at scale
 */

const AWS_REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'af-south-1', 'ap-east-1', 'ap-south-1', 'ap-south-2',
  'ap-northeast-1', 'ap-northeast-2', 'ap-northeast-3',
  'ap-southeast-1', 'ap-southeast-2', 'ap-southeast-3', 'ap-southeast-4',
  'ap-southeast-5', 'ap-southeast-6', 'ap-southeast-7', 'ap-east-2',
  'ca-central-1', 'ca-west-1',
  'eu-central-1', 'eu-central-2', 'eu-west-1', 'eu-west-2', 'eu-west-3',
  'eu-north-1', 'eu-south-1', 'eu-south-2',
  'il-central-1', 'me-south-1', 'me-central-1', 'mx-central-1', 'sa-east-1'
];

const GCP_REGIONS = [
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
  'us-west1', 'us-west2', 'us-west3', 'us-west4'
];

const AZURE_REGIONS = [
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
  'westcentralus', 'westeurope', 'westindia', 'westus', 'westus2', 'westus3'
];

// Base configuration
let config = `name = "global-healthchecks"
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
route = { pattern = "healthchecks.ross.gg/*", zone_name = "ross.gg" }

[observability.logs]
enabled = true
invocation_logs = true

# ============================================================================
# Regional Services Workers (10) - Enterprise feature with guaranteed regions
# ============================================================================

`;

// Regional Services - these stay the same
const REGIONAL_SERVICES = [
  { code: 'us', region: 'us' },
  { code: 'ca', region: 'ca' },
  { code: 'eu', region: 'eu' },
  { code: 'isoeu', region: 'isoeu' },
  { code: 'de', region: 'de' },
  { code: 'jp', region: 'jp' },
  { code: 'sg', region: 'sg' },
  { code: 'kr', region: 'kr' },
  { code: 'in', region: 'in' },
  { code: 'au', region: 'au' },
];

REGIONAL_SERVICES.forEach(({ code, region }) => {
  config += `[env.${code}]
route = { pattern = "${code}.healthchecks.ross.gg/*", zone_name = "ross.gg" }
[env.${code}.placement]
region = "${region}"

`;
});

config += `# ============================================================================
# AWS Placement Hints (${AWS_REGIONS.length}) - Cloud provider region hints
# ============================================================================

`;

AWS_REGIONS.forEach(region => {
  const envName = `aws-${region}`;
  config += `[env.${envName}]
route = { pattern = "${envName}.healthchecks.ross.gg/*", zone_name = "ross.gg" }
[env.${envName}.placement]
region = "aws:${region}"

`;
});

config += `# ============================================================================
# GCP Placement Hints (${GCP_REGIONS.length}) - Cloud provider region hints
# ============================================================================

`;

GCP_REGIONS.forEach(region => {
  const envName = `gcp-${region}`;
  config += `[env.${envName}]
route = { pattern = "${envName}.healthchecks.ross.gg/*", zone_name = "ross.gg" }
[env.${envName}.placement]
region = "gcp:${region}"

`;
});

config += `# ============================================================================
# Azure Placement Hints (${AZURE_REGIONS.length}) - Cloud provider region hints
# ============================================================================

`;

AZURE_REGIONS.forEach(region => {
  const envName = `azure-${region}`;
  config += `[env.${envName}]
route = { pattern = "${envName}.healthchecks.ross.gg/*", zone_name = "ross.gg" }
[env.${envName}.placement]
region = "azure:${region}"

`;
});

// Write to file
import { writeFileSync } from 'fs';
writeFileSync('wrangler.toml', config);

console.log(`✓ Generated wrangler.toml with:`);
console.log(`  - 10 Regional Services workers`);
console.log(`  - ${AWS_REGIONS.length} AWS placement hint workers`);
console.log(`  - ${GCP_REGIONS.length} GCP placement hint workers`);
console.log(`  - ${AZURE_REGIONS.length} Azure placement hint workers`);
console.log(`  - Total: ${10 + AWS_REGIONS.length + GCP_REGIONS.length + AZURE_REGIONS.length} workers`);
