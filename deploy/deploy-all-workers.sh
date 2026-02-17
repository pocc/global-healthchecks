#!/bin/bash
# Deploy all 143 cloud provider region workers to test Smart Placement at scale

set -e  # Exit on error

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Deploying 133 Smart Placement Workers                  ║${NC}"
echo -e "${BLUE}║  Testing placement hints at scale (AWS/GCP/Azure)       ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GRAY}Start time: $(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo ""

# Counter for tracking progress
TOTAL=133  # Only cloud provider workers (34 AWS + 43 GCP + 56 Azure)
COUNT=0
FAILED=0
START_TIME=$(date +%s)

# Function to deploy a single environment
deploy_env() {
  local env_name="$1"
  local description="$2"
  local deploy_start=$(date +%s)

  COUNT=$((COUNT + 1))
  local elapsed=$(($(date +%s) - START_TIME))
  local mins=$((elapsed / 60))
  local secs=$((elapsed % 60))

  echo ""
  echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${YELLOW}[$COUNT/$TOTAL]${NC} ${BLUE}$env_name${NC} ($description)"
  echo -e "${GRAY}Elapsed: ${mins}m ${secs}s | Starting deployment...${NC}"

  # Capture output and check for errors
  local output
  local exit_code=0
  output=$(npx wrangler@4 deploy --env "$env_name" 2>&1) || exit_code=$?

  if [ $exit_code -ne 0 ] || echo "$output" | grep -qi "error"; then
    echo -e "${RED}✗ FAILED${NC}"
    echo "$output" | tail -20  # Show last 20 lines of error output
    FAILED=$((FAILED + 1))
  else
    # Extract and show key deployment info
    local worker_url=$(echo "$output" | grep -o "https://[^.]*\.pocc\.workers\.dev" | head -1)
    local custom_domain=$(echo "$output" | grep -o "[a-z0-9-]*\.healthchecks\.ross\.gg" | head -1)
    local deploy_time=$(($(date +%s) - deploy_start))

    echo -e "${GREEN}✓ SUCCESS${NC} ${GRAY}(${deploy_time}s)${NC}"
    [ -n "$worker_url" ] && echo -e "  ${GRAY}Workers URL:${NC} $worker_url"
    [ -n "$custom_domain" ] && echo -e "  ${GRAY}Custom Domain:${NC} https://$custom_domain"

    # Show worker details if verbose
    if echo "$output" | grep -q "Worker Startup Time"; then
      local startup_time=$(echo "$output" | grep "Worker Startup Time" | grep -o "[0-9]* ms")
      [ -n "$startup_time" ] && echo -e "  ${GRAY}Startup Time:${NC} $startup_time"
    fi
  fi

  # Small delay to avoid rate limiting
  sleep 0.3
}

echo -e "${BLUE}━━━ AWS Regions (34) ━━━${NC}"
deploy_env "aws-us-east-1" "US East (N. Virginia)"
deploy_env "aws-us-east-2" "US East (Ohio)"
deploy_env "aws-us-west-1" "US West (N. California)"
deploy_env "aws-us-west-2" "US West (Oregon)"
deploy_env "aws-af-south-1" "Africa (Cape Town)"
deploy_env "aws-ap-east-1" "Asia Pacific (Hong Kong)"
deploy_env "aws-ap-south-1" "Asia Pacific (Mumbai)"
deploy_env "aws-ap-south-2" "Asia Pacific (Hyderabad)"
deploy_env "aws-ap-northeast-1" "Asia Pacific (Tokyo)"
deploy_env "aws-ap-northeast-2" "Asia Pacific (Seoul)"
deploy_env "aws-ap-northeast-3" "Asia Pacific (Osaka)"
deploy_env "aws-ap-southeast-1" "Asia Pacific (Singapore)"
deploy_env "aws-ap-southeast-2" "Asia Pacific (Sydney)"
deploy_env "aws-ap-southeast-3" "Asia Pacific (Jakarta)"
deploy_env "aws-ap-southeast-4" "Asia Pacific (Melbourne)"
deploy_env "aws-ap-southeast-5" "Asia Pacific (Malaysia)"
deploy_env "aws-ap-southeast-6" "Asia Pacific (New Zealand)"
deploy_env "aws-ap-southeast-7" "Asia Pacific (Thailand)"
deploy_env "aws-ap-east-2" "Asia Pacific (Taipei)"
deploy_env "aws-ca-central-1" "Canada (Central)"
deploy_env "aws-ca-west-1" "Canada West (Calgary)"
deploy_env "aws-eu-central-1" "Europe (Frankfurt)"
deploy_env "aws-eu-central-2" "Europe (Zurich)"
deploy_env "aws-eu-west-1" "Europe (Ireland)"
deploy_env "aws-eu-west-2" "Europe (London)"
deploy_env "aws-eu-west-3" "Europe (Paris)"
deploy_env "aws-eu-north-1" "Europe (Stockholm)"
deploy_env "aws-eu-south-1" "Europe (Milan)"
deploy_env "aws-eu-south-2" "Europe (Spain)"
deploy_env "aws-il-central-1" "Israel (Tel Aviv)"
deploy_env "aws-me-south-1" "Middle East (Bahrain)"
deploy_env "aws-me-central-1" "Middle East (UAE)"
deploy_env "aws-mx-central-1" "Mexico (Central)"
deploy_env "aws-sa-east-1" "South America (São Paulo)"

echo ""
echo -e "${BLUE}━━━ GCP Regions (43) ━━━${NC}"
deploy_env "gcp-africa-south1" "Johannesburg"
deploy_env "gcp-asia-east1" "Taiwan"
deploy_env "gcp-asia-east2" "Hong Kong"
deploy_env "gcp-asia-northeast1" "Tokyo"
deploy_env "gcp-asia-northeast2" "Osaka"
deploy_env "gcp-asia-northeast3" "Seoul"
deploy_env "gcp-asia-south1" "Mumbai"
deploy_env "gcp-asia-south2" "Delhi"
deploy_env "gcp-asia-southeast1" "Singapore"
deploy_env "gcp-asia-southeast2" "Jakarta"
deploy_env "gcp-asia-southeast3" "Bangkok"
deploy_env "gcp-australia-southeast1" "Sydney"
deploy_env "gcp-australia-southeast2" "Melbourne"
deploy_env "gcp-europe-central2" "Warsaw"
deploy_env "gcp-europe-north1" "Finland"
deploy_env "gcp-europe-north2" "Stockholm"
deploy_env "gcp-europe-southwest1" "Madrid"
deploy_env "gcp-europe-west1" "Belgium"
deploy_env "gcp-europe-west2" "London"
deploy_env "gcp-europe-west3" "Frankfurt"
deploy_env "gcp-europe-west4" "Netherlands"
deploy_env "gcp-europe-west6" "Zurich"
deploy_env "gcp-europe-west8" "Milan"
deploy_env "gcp-europe-west9" "Paris"
deploy_env "gcp-europe-west10" "Berlin"
deploy_env "gcp-europe-west12" "Turin"
deploy_env "gcp-me-central1" "Doha"
deploy_env "gcp-me-central2" "Dammam"
deploy_env "gcp-me-west1" "Tel Aviv"
deploy_env "gcp-northamerica-northeast1" "Montreal"
deploy_env "gcp-northamerica-northeast2" "Toronto"
deploy_env "gcp-northamerica-south1" "Mexico"
deploy_env "gcp-southamerica-east1" "São Paulo"
deploy_env "gcp-southamerica-west1" "Santiago"
deploy_env "gcp-us-central1" "Iowa"
deploy_env "gcp-us-east1" "South Carolina"
deploy_env "gcp-us-east4" "Virginia"
deploy_env "gcp-us-east5" "Ohio"
deploy_env "gcp-us-south1" "Dallas"
deploy_env "gcp-us-west1" "Oregon"
deploy_env "gcp-us-west2" "Los Angeles"
deploy_env "gcp-us-west3" "Utah"
deploy_env "gcp-us-west4" "Las Vegas"

echo ""
echo -e "${BLUE}━━━ Azure Regions (56) ━━━${NC}"
deploy_env "azure-australiacentral" "Canberra"
deploy_env "azure-australiacentral2" "Canberra"
deploy_env "azure-australiaeast" "New South Wales"
deploy_env "azure-australiasoutheast" "Victoria"
deploy_env "azure-austriaeast" "Vienna"
deploy_env "azure-belgiumcentral" "Brussels"
deploy_env "azure-brazilsouth" "Sao Paulo"
deploy_env "azure-brazilsoutheast" "Rio"
deploy_env "azure-canadacentral" "Toronto"
deploy_env "azure-canadaeast" "Quebec"
deploy_env "azure-centralindia" "Pune"
deploy_env "azure-centralus" "Iowa"
deploy_env "azure-chilecentral" "Santiago"
deploy_env "azure-denmarkeast" "Copenhagen"
deploy_env "azure-eastasia" "Hong Kong"
deploy_env "azure-eastus" "Virginia"
deploy_env "azure-eastus2" "Virginia"
deploy_env "azure-francecentral" "Paris"
deploy_env "azure-francesouth" "Marseille"
deploy_env "azure-germanynorth" "Berlin"
deploy_env "azure-germanywestcentral" "Frankfurt"
deploy_env "azure-indonesiacentral" "Jakarta"
deploy_env "azure-israelcentral" "Israel"
deploy_env "azure-italynorth" "Milan"
deploy_env "azure-japaneast" "Tokyo"
deploy_env "azure-japanwest" "Osaka"
deploy_env "azure-koreacentral" "Seoul"
deploy_env "azure-koreasouth" "Busan"
deploy_env "azure-malaysiawest" "Kuala Lumpur"
deploy_env "azure-mexicocentral" "Querétaro"
deploy_env "azure-newzealandnorth" "Auckland"
deploy_env "azure-northcentralus" "Illinois"
deploy_env "azure-northeurope" "Ireland"
deploy_env "azure-norwayeast" "Norway"
deploy_env "azure-norwaywest" "Norway"
deploy_env "azure-polandcentral" "Warsaw"
deploy_env "azure-qatarcentral" "Doha"
deploy_env "azure-southafricanorth" "Johannesburg"
deploy_env "azure-southafricawest" "Cape Town"
deploy_env "azure-southcentralus" "Texas"
deploy_env "azure-southindia" "Chennai"
deploy_env "azure-southeastasia" "Singapore"
deploy_env "azure-spaincentral" "Madrid"
deploy_env "azure-swedencentral" "Gävle"
deploy_env "azure-switzerlandnorth" "Zurich"
deploy_env "azure-switzerlandwest" "Geneva"
deploy_env "azure-uaecentral" "Abu Dhabi"
deploy_env "azure-uaenorth" "Dubai"
deploy_env "azure-uksouth" "London"
deploy_env "azure-ukwest" "Cardiff"
deploy_env "azure-westcentralus" "Wyoming"
deploy_env "azure-westeurope" "Netherlands"
deploy_env "azure-westindia" "Mumbai"
deploy_env "azure-westus" "California"
deploy_env "azure-westus2" "Washington"
deploy_env "azure-westus3" "Phoenix"

echo ""
echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Deployment Summary                                      ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

END_TIME=$(date +%s)
TOTAL_TIME=$((END_TIME - START_TIME))
TOTAL_MINS=$((TOTAL_TIME / 60))
TOTAL_SECS=$((TOTAL_TIME % 60))
SUCCESS=$((TOTAL - FAILED))
SUCCESS_RATE=$((SUCCESS * 100 / TOTAL))

echo -e "${GRAY}End time:           $(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo -e "${GRAY}Total duration:     ${TOTAL_MINS}m ${TOTAL_SECS}s${NC}"
echo -e "${GRAY}Avg time/worker:    $((TOTAL_TIME / TOTAL))s${NC}"
echo ""
echo -e "Total workers:         ${BLUE}$TOTAL${NC}"
echo -e "Successfully deployed: ${GREEN}$SUCCESS${NC} ${GRAY}(${SUCCESS_RATE}%)${NC}"
echo -e "Failed deployments:    ${RED}$FAILED${NC}"
echo ""
echo -e "Breakdown by provider:"
echo -e "  AWS Regions:   ${BLUE}34${NC} workers"
echo -e "  GCP Regions:   ${BLUE}43${NC} workers"
echo -e "  Azure Regions: ${BLUE}56${NC} workers"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}✓ All workers deployed successfully!${NC}"
  echo ""
  echo -e "Test Smart Placement effectiveness:"
  echo -e "  Main site:      ${BLUE}https://healthchecks.ross.gg${NC}"
  echo -e "  Test endpoint:  ${BLUE}https://test-aws.healthchecks.ross.gg${NC}"
  echo ""
  echo -e "Example regional endpoints:"
  echo -e "  US (Regional):  ${GRAY}https://us.healthchecks.ross.gg${NC}"
  echo -e "  AWS US-East-1:  ${GRAY}https://aws-us-east-1.healthchecks.ross.gg${NC}"
  echo -e "  GCP US-East-1:  ${GRAY}https://gcp-us-east1.healthchecks.ross.gg${NC}"
  echo -e "  Azure East US:  ${GRAY}https://azure-eastus.healthchecks.ross.gg${NC}"
  exit 0
else
  echo -e "${YELLOW}⚠ Some deployments failed. Check the output above for details.${NC}"
  echo ""
  echo -e "To retry failed deployments, run:"
  echo -e "  ${GRAY}bash deploy-all-workers.sh${NC}"
  exit 1
fi
