#!/bin/bash
# Test if Smart Placement hints actually affect worker execution location

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Testing Smart Placement Hint Effectiveness             ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

# Create a temporary wrangler.toml for testing
cat > wrangler-test.toml <<EOF
name = "global-healthchecks"
main = "src/worker.ts"
compatibility_date = "2025-02-07"
compatibility_flags = ["nodejs_compat"]
account_id = "e7452b39fc737014144e3b3fca412900"

assets = { directory = "dist", binding = "ASSETS" }
workers_dev = true

# Test with AWS US East placement hint
[env.test-aws-us-east]
route = { pattern = "test-aws.healthchecks.ross.gg/*", zone_name = "ross.gg" }
[env.test-aws-us-east.placement]
region = "aws:us-east-1"

# Test with GCP Europe placement hint
[env.test-gcp-europe]
route = { pattern = "test-gcp.healthchecks.ross.gg/*", zone_name = "ross.gg" }
[env.test-gcp-europe.placement]
region = "gcp:europe-west1"

# Test with Azure Asia placement hint
[env.test-azure-asia]
route = { pattern = "test-azure.healthchecks.ross.gg/*", zone_name = "ross.gg" }
[env.test-azure-asia.placement]
region = "azure:southeastasia"

[observability.logs]
enabled = true
invocation_logs = true
EOF

echo -e "${YELLOW}Deploying test workers with placement hints...${NC}"
echo ""

echo -e "${BLUE}1. Deploying AWS us-east-1 hint worker...${NC}"
npx wrangler@3 deploy --env test-aws-us-east --config wrangler-test.toml

echo -e "${BLUE}2. Deploying GCP europe-west1 hint worker...${NC}"
npx wrangler@3 deploy --env test-gcp-europe --config wrangler-test.toml

echo -e "${BLUE}3. Deploying Azure southeastasia hint worker...${NC}"
npx wrangler@3 deploy --env test-azure-asia --config wrangler-test.toml

echo ""
echo -e "${GREEN}✓ Test workers deployed!${NC}"
echo ""
echo -e "${YELLOW}Now testing each endpoint...${NC}"
echo ""

# Function to test an endpoint
test_endpoint() {
  local url="$1"
  local hint="$2"

  echo -e "${BLUE}━━━ Testing: $hint ━━━${NC}"
  echo -e "URL: $url"

  # Make request and capture headers
  response=$(curl -s -D - "$url/api/check" -X POST -H "Content-Type: application/json" -d '{"host":"1.1.1.1","port":443}' -o /dev/null)

  # Extract cf-placement header
  placement=$(echo "$response" | grep -i "cf-placement:" | cut -d' ' -f2- | tr -d '\r')

  # Extract colo from response body
  colo=$(curl -s "$url/api/check" -X POST -H "Content-Type: application/json" -d '{"host":"1.1.1.1","port":443}' | grep -o '"colo":"[^"]*"' | cut -d'"' -f4)

  echo -e "Placement: ${GREEN}$placement${NC}"
  echo -e "Colo: ${GREEN}$colo${NC}"

  if [[ $placement == local-* ]]; then
    echo -e "${YELLOW}⚠ Hint IGNORED - Running locally${NC}"
  elif [[ $placement == remote-* ]]; then
    echo -e "${GREEN}✓ Hint HONORED - Forwarded to remote colo${NC}"
  else
    echo -e "${YELLOW}? Unknown placement status${NC}"
  fi

  echo ""
}

# Test each endpoint
test_endpoint "https://test-aws.healthchecks.ross.gg" "AWS us-east-1"
test_endpoint "https://test-gcp.healthchecks.ross.gg" "GCP europe-west1"
test_endpoint "https://test-azure.healthchecks.ross.gg" "Azure southeastasia"

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Test Summary                                            ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "If you see 'remote-XXX' placement headers, Smart Placement hints"
echo -e "are working and we should proceed with the 143-worker deployment."
echo ""
echo -e "If you see 'local-XXX' placement headers, Smart Placement hints"
echo -e "are being ignored and the massive deployment won't be useful."
echo ""
echo -e "${YELLOW}Cleanup: Remove test config file${NC}"
rm -f wrangler-test.toml
