#!/bin/bash
# Deploy all 143 regional/targeted placement workers
set -e

cd /Users/rj/gd/code/global-healthchecks

# Extract all env names from wrangler.toml
ENVS=$(grep '^\[env\.' wrangler.toml | sed 's/\[env\.\(.*\)\]/\1/' | sed 's/\..*$//' | sort -u)

TOTAL=$(echo "$ENVS" | wc -l | tr -d ' ')
COUNT=0
FAILED=0

for env in $ENVS; do
  COUNT=$((COUNT + 1))
  echo "[$COUNT/$TOTAL] Deploying $env..."
  if npx wrangler deploy --env "$env" 2>&1 | tail -1; then
    echo "  OK"
  else
    echo "  FAILED"
    FAILED=$((FAILED + 1))
  fi
  sleep 1
done

echo ""
echo "Done: $COUNT deployed, $FAILED failed"
