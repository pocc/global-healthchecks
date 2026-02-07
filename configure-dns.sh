#!/bin/bash
# Configure DNS records for regional Worker deployments

set -e

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Cloudflare API settings
ZONE_NAME="ross.gg"
API_TOKEN="${CLOUDFLARE_API_TOKEN}"

if [ -z "$API_TOKEN" ]; then
    echo "❌ Error: CLOUDFLARE_API_TOKEN not set"
    echo "Please create a .env file with your API token"
    exit 1
fi

echo "🌍 Configuring DNS records for multi-region deployment..."
echo ""

# Get Zone ID for ross.gg
echo "🔍 Looking up Zone ID for $ZONE_NAME..."
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

# Regional subdomain configurations
declare -A regions
regions[enam]="global-healthchecks-enam.workers.dev"
regions[wnam]="global-healthchecks-wnam.workers.dev"
regions[weur]="global-healthchecks-weur.workers.dev"
regions[eeur]="global-healthchecks-eeur.workers.dev"
regions[apac]="global-healthchecks-apac.workers.dev"
regions[oc]="global-healthchecks-oc.workers.dev"

declare -A region_names
region_names[enam]="US-East"
region_names[wnam]="US-West"
region_names[weur]="EU-West"
region_names[eeur]="EU-East"
region_names[apac]="Asia-Pacific"
region_names[oc]="Oceania"

# Create CNAME records for each region
for region in "${!regions[@]}"; do
    subdomain="${region}.healthchecks"
    target="${regions[$region]}"
    name="${region_names[$region]}"

    echo "🚀 Creating DNS record for $name ($subdomain)..."

    # Check if record already exists
    existing=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records?name=$subdomain.$ZONE_NAME" \
        -H "Authorization: Bearer $API_TOKEN" \
        -H "Content-Type: application/json" | \
        python3 -c "import json,sys; data=json.load(sys.stdin); print(data['result'][0]['id'] if data['result'] else '')" 2>/dev/null)

    if [ -n "$existing" ]; then
        echo "  ⚠️  Record already exists, updating..."
        response=$(curl -s -X PUT "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records/$existing" \
            -H "Authorization: Bearer $API_TOKEN" \
            -H "Content-Type: application/json" \
            --data "{
                \"type\": \"CNAME\",
                \"name\": \"$subdomain\",
                \"content\": \"$target\",
                \"ttl\": 1,
                \"proxied\": true
            }")
    else
        response=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
            -H "Authorization: Bearer $API_TOKEN" \
            -H "Content-Type: application/json" \
            --data "{
                \"type\": \"CNAME\",
                \"name\": \"$subdomain\",
                \"content\": \"$target\",
                \"ttl\": 1,
                \"proxied\": true
            }")
    fi

    success=$(echo "$response" | python3 -c "import json,sys; data=json.load(sys.stdin); print('true' if data.get('success') else 'false')")

    if [ "$success" = "true" ]; then
        echo "  ✅ $subdomain.$ZONE_NAME → $target (Proxied)"
    else
        error=$(echo "$response" | python3 -c "import json,sys; data=json.load(sys.stdin); print(data.get('errors', [{}])[0].get('message', 'Unknown error'))")
        echo "  ❌ Failed: $error"
    fi
    echo ""
done

echo "🎉 DNS configuration complete!"
echo ""
echo "📋 Configured endpoints:"
for region in enam wnam weur eeur apac oc; do
    echo "  • ${region_names[$region]}: https://${region}.healthchecks.$ZONE_NAME"
done
echo ""
echo "⏳ DNS propagation usually takes < 5 minutes"
echo "🧪 Test with: curl https://enam.healthchecks.$ZONE_NAME/api/check"
