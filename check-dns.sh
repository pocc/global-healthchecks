#!/bin/bash
# Check current DNS configuration and show what's needed

set -e

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

API_TOKEN="${CLOUDFLARE_API_TOKEN}"
ZONE_NAME="ross.gg"

if [ -z "$API_TOKEN" ]; then
    echo "❌ Error: CLOUDFLARE_API_TOKEN not set"
    exit 1
fi

echo "🔍 Checking DNS configuration for $ZONE_NAME..."
echo ""

# Get Zone ID
ZONE_ID=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones?name=$ZONE_NAME" \
    -H "Authorization: Bearer $API_TOKEN" \
    -H "Content-Type: application/json" | \
    python3 -c "import json,sys; data=json.load(sys.stdin); print(data['result'][0]['id'] if data['success'] and data['result'] else '')")

if [ -z "$ZONE_ID" ]; then
    echo "❌ Error: Could not find Zone ID for $ZONE_NAME"
    exit 1
fi

echo "✅ Zone ID: $ZONE_ID"
echo ""

# Regional subdomains to check
declare -a subdomains=("enam.healthchecks" "wnam.healthchecks" "weur.healthchecks" "eeur.healthchecks" "apac.healthchecks" "oc.healthchecks")
declare -A targets
targets["enam.healthchecks"]="global-healthchecks-enam.workers.dev"
targets["wnam.healthchecks"]="global-healthchecks-wnam.workers.dev"
targets["weur.healthchecks"]="global-healthchecks-weur.workers.dev"
targets["eeur.healthchecks"]="global-healthchecks-eeur.workers.dev"
targets["apac.healthchecks"]="global-healthchecks-apac.workers.dev"
targets["oc.healthchecks"]="global-healthchecks-oc.workers.dev"

declare -A region_names
region_names["enam.healthchecks"]="US-East"
region_names["wnam.healthchecks"]="US-West"
region_names["weur.healthchecks"]="EU-West"
region_names["eeur.healthchecks"]="EU-East"
region_names["apac.healthchecks"]="Asia-Pacific"
region_names["oc.healthchecks"]="Oceania"

echo "📋 Checking existing DNS records..."
echo ""

missing_records=()
existing_records=()

for subdomain in "${subdomains[@]}"; do
    full_name="$subdomain.$ZONE_NAME"
    expected_target="${targets[$subdomain]}"
    region_name="${region_names[$subdomain]}"

    # Check if record exists
    record_data=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?name=$full_name" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json")

    exists=$(echo "$record_data" | python3 -c "import json,sys; data=json.load(sys.stdin); print('true' if data['result'] else 'false')")

    if [ "$exists" = "true" ]; then
        current_target=$(echo "$record_data" | python3 -c "import json,sys; data=json.load(sys.stdin); print(data['result'][0]['content'])")
        proxied=$(echo "$record_data" | python3 -c "import json,sys; data=json.load(sys.stdin); print('Yes' if data['result'][0]['proxied'] else 'No')")

        echo "✅ $region_name: $full_name"
        echo "   Target: $current_target"
        echo "   Proxied: $proxied"

        if [ "$current_target" != "$expected_target" ]; then
            echo "   ⚠️  WARNING: Target should be $expected_target"
        fi
        if [ "$proxied" != "Yes" ]; then
            echo "   ⚠️  WARNING: Should be Proxied (orange cloud)"
        fi

        existing_records+=("$subdomain")
    else
        echo "❌ $region_name: $full_name - NOT FOUND"
        missing_records+=("$subdomain")
    fi
    echo ""
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ ${#missing_records[@]} -eq 0 ]; then
    echo "🎉 All DNS records are configured!"
else
    echo "⚠️  Missing ${#missing_records[@]} DNS record(s)"
    echo ""
    echo "📝 TO ADD IN CLOUDFLARE DASHBOARD:"
    echo "   Go to: https://dash.cloudflare.com → ross.gg → DNS → Records"
    echo ""

    for subdomain in "${missing_records[@]}"; do
        target="${targets[$subdomain]}"
        region_name="${region_names[$subdomain]}"

        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "Region: $region_name"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "Type:    CNAME"
        echo "Name:    $subdomain"
        echo "Target:  $target"
        echo "Proxy:   ☁️  ON (orange cloud)"
        echo "TTL:     Auto"
        echo ""
    done
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
