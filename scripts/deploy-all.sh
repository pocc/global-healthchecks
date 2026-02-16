#!/bin/bash
# Deploy to all worker environments

set -e

echo "Deploying to all environments..."

# Production (main domain)
echo "→ Deploying production..."
npx wrangler deploy --env production

# Regional workers
for env in us ca eu isoeu de jp sg kr in au; do
  echo "→ Deploying $env..."
  npx wrangler deploy --env $env
done

# AWS regions (34 environments)
for region in us-east-1 us-east-2 us-west-1 us-west-2 af-south-1 ap-east-1 ap-south-1 ap-south-2 ap-northeast-1 ap-northeast-2 ap-northeast-3 ap-southeast-1 ap-southeast-2 ap-southeast-3 ap-southeast-4 ap-southeast-5 ap-southeast-6 ap-southeast-7 ap-east-2 ca-central-1 ca-west-1 eu-central-1 eu-central-2 eu-west-1 eu-west-2 eu-west-3 eu-north-1 eu-south-1 eu-south-2 il-central-1 me-south-1 me-central-1 mx-central-1 sa-east-1; do
  echo "→ Deploying aws-$region..."
  npx wrangler deploy --env aws-$region
done

# GCP regions (43 environments)
for region in africa-south1 asia-east1 asia-east2 asia-northeast1 asia-northeast2 asia-northeast3 asia-south1 asia-south2 asia-southeast1 asia-southeast2 asia-southeast3 australia-southeast1 australia-southeast2 europe-central2 europe-north1 europe-north2 europe-southwest1 europe-west1 europe-west2 europe-west3 europe-west4 europe-west6 europe-west8 europe-west9 europe-west10 europe-west12 me-central1 me-central2 me-west1 northamerica-northeast1 northamerica-northeast2 northamerica-south1 southamerica-east1 southamerica-west1 us-central1 us-east1 us-east4 us-east5 us-south1 us-west1 us-west2 us-west3 us-west4; do
  echo "→ Deploying gcp-$region..."
  npx wrangler deploy --env gcp-$region
done

# Azure regions (56 environments)
for region in australiacentral australiacentral2 australiaeast australiasoutheast austriaeast belgiumcentral brazilsouth brazilsoutheast canadacentral canadaeast centralindia centralus chilecentral denmarkeast eastasia eastus eastus2 francecentral francesouth germanynorth germanywestcentral indonesiacentral israelcentral italynorth japaneast japanwest koreacentral koreasouth malaysiawest mexicocentral newzealandnorth northcentralus northeurope norwayeast norwaywest polandcentral qatarcentral southafricanorth southafricawest southcentralus southindia southeastasia spaincentral swedencentral switzerlandnorth switzerlandwest uaecentral uaenorth uksouth ukwest westcentralus westeurope westindia westus westus2 westus3; do
  echo "→ Deploying azure-$region..."
  npx wrangler deploy --env azure-$region
done

echo "✅ All environments deployed!"
