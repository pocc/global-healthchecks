#!/bin/bash
# Deploy all 133 cloud provider region workers using Routes to test Smart Placement

set -e

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'
NC='\033[0m' 

echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Deploying 133 Smart Placement Workers (via Routes)      ║${NC}"
echo -e "${BLUE}║  Testing placement hints at scale (AWS/GCP/Azure)        ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GRAY}Start time: $(date '+%Y-%m-%d %H:%M:%S')${NC}"

TOTAL=133
COUNT=0
FAILED=0
START_TIME=$(date +%s)

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
  echo -e "${GRAY}Elapsed: ${mins}m ${secs}s | Deploying Route...${NC}"

  local output
  local exit_code=0
  # Using wrangler deploy. Ensure your wrangler.toml has [[routes]] defined for each env.
  output=$(npx wrangler deploy --env "$env_name" 2>&1) || exit_code=$?

  if [ $exit_code -ne 0 ] || echo "$output" | grep -qi "error"; then
    echo -e "${RED}✗ FAILED${NC}"
    echo "$output" | tail -15
    FAILED=$((FAILED + 1))
  else
    # Routes appear differently in wrangler output than custom domains
    local route_url="${env_name}.healthchecks.ross.gg"
    local deploy_time=$(($(date +%s) - deploy_start))

    echo -e "${GREEN}✓ SUCCESS${NC} ${GRAY}(${deploy_time}s)${NC}"
    echo -e "  ${GRAY}Route:${NC} https://$route_url"

    if echo "$output" | grep -q "Worker Startup Time"; then
      local startup_time=$(echo "$output" | grep "Worker Startup Time" | grep -o "[0-9]* ms")
      [ -n "$startup_time" ] && echo -e "  ${GRAY}Startup Time:${NC} $startup_time"
    fi
  fi

  sleep 0.2 # Slight throttle
}

# --- Deployment Sections (Truncated for brevity, keep your full list below) ---

echo -e "${BLUE}━━━ AWS Regions (34) ━━━${NC}"
deploy_env "aws-us-east-1" "US East (N. Virginia)"
deploy_env "aws-us-east-2" "US East (Ohio)"
# ... [Add your other AWS regions here] ...

echo ""
echo -e "${BLUE}━━━ GCP Regions (43) ━━━${NC}"
deploy_env "gcp-us-central1" "Iowa"
# ... [Add your other GCP regions here] ...

echo ""
echo -e "${BLUE}━━━ Azure Regions (56) ━━━${NC}"
deploy_env "azure-southcentralus" "Texas"
# ... [Add your other Azure regions here] ...

# --- Summary Section ---

echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Deployment Summary                                      ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════════════════╝${NC}"

END_TIME=$(date +%s)
TOTAL_TIME=$((END_TIME - START_TIME))
SUCCESS=$((TOTAL - FAILED))

echo -e "Total workers:         ${BLUE}$TOTAL${NC}"
echo -e "Successfully deployed: ${GREEN}$SUCCESS${NC}"
echo -e "Failed deployments:    ${RED}$FAILED${NC}"
echo ""
echo -e "All endpoints are now active via wildcard-backed routes."
echo -e "Example: ${CYAN}https://aws-us-east-1.healthchecks.ross.gg${NC}"

exit $((FAILED == 0 ? 0 : 1))
