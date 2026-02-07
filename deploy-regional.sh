#!/bin/bash
# Deploy all regional Workers for multi-region testing

set -e

echo "🌍 Deploying Global Health Checks to multiple regions..."
echo ""

# Build the frontend first
echo "📦 Building frontend..."
npm run build
echo "✅ Frontend built"
echo ""

# Deploy each regional worker
regions=("enam" "wnam" "weur" "eeur" "apac" "oc")
region_names=("US-East" "US-West" "EU-West" "EU-East" "Asia-Pacific" "Oceania")

for i in "${!regions[@]}"; do
    region="${regions[$i]}"
    name="${region_names[$i]}"

    echo "🚀 Deploying $name ($region)..."
    wrangler deploy --config "wrangler.$region.toml" --env production
    echo "✅ $name deployed to $region.healthchecks.ross.gg"
    echo ""
done

echo "🎉 All regional deployments complete!"
echo ""
echo "📋 Deployed endpoints:"
for i in "${!regions[@]}"; do
    region="${regions[$i]}"
    name="${region_names[$i]}"
    echo "  • $name: https://$region.healthchecks.ross.gg"
done
echo ""
echo "⚠️  Don't forget to configure DNS records! See REGIONAL_SETUP.md"
