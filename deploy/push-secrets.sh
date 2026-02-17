#!/bin/bash
# Push API_SECRET to all workers that are missing it
set -e

# Load API_SECRET from .dev.vars (format: KEY=VALUE)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEVVARS="$SCRIPT_DIR/../.dev.vars"
if [ ! -f "$DEVVARS" ]; then
  echo "Error: .dev.vars not found at $DEVVARS"
  exit 1
fi
SECRET_VALUE=$(grep '^API_SECRET=' "$DEVVARS" | cut -d'=' -f2-)
if [ -z "$SECRET_VALUE" ]; then
  echo "Error: API_SECRET not found in .dev.vars"
  exit 1
fi

cd "$SCRIPT_DIR/.."
ENVS=$(grep '^\[env\.' wrangler.toml | grep -v '\.placement\]' | sed 's/\[env\.\(.*\)\]/\1/')

TOTAL=$(echo "$ENVS" | wc -l | tr -d ' ')
COUNT=0
SKIPPED=0
FAILED=0

for env in $ENVS; do
  WORKER_NAME="global-healthchecks-${env}"
  COUNT=$((COUNT + 1))
  
  # Check if secret already exists
  EXISTING=$(npx wrangler secret list --name "$WORKER_NAME" 2>/dev/null | grep -c '"API_SECRET"' || true)
  
  if [ "$EXISTING" -gt "0" ]; then
    echo "[$COUNT/$TOTAL] $WORKER_NAME — already has API_SECRET, skipping"
    SKIPPED=$((SKIPPED + 1))
  else
    echo "[$COUNT/$TOTAL] $WORKER_NAME — pushing secret..."
    if echo "$SECRET_VALUE" | npx wrangler secret put API_SECRET --name "$WORKER_NAME" 2>&1 | tail -1; then
      echo "  OK"
    else
      echo "  FAILED"
      FAILED=$((FAILED + 1))
    fi
  fi
done

echo ""
echo "Done: $COUNT processed, $SKIPPED skipped (already had secret), $FAILED failed"
