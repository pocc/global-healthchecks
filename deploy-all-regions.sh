#!/bin/bash
# Deploy all 9 Smart Placement Workers for complete global coverage

set -e

# Force clear API token to use OAuth authentication instead
unset CLOUDFLARE_API_TOKEN
export CLOUDFLARE_API_TOKEN=""

echo "🌍 Deploying Global Health Checks to all 9 Smart Placement regions..."
echo ""

# Build the frontend first
echo "📦 Building frontend..."
npm run build
echo "✅ Frontend built"
echo ""

# All 9 valid Smart Placement hints
regions=("enam" "wnam" "sam" "weur" "eeur" "apac" "oc" "afr" "me")
region_names=(
  "East North America"
  "West North America"
  "South America"
  "West Europe"
  "East Europe"
  "Asia Pacific"
  "Oceania"
  "Africa"
  "Middle East"
)

echo "✨ Deploying with Smart Placement (all 9 valid hints)"
echo ""

# Deploy each regional worker
for i in "${!regions[@]}"; do
    region="${regions[$i]}"
    name="${region_names[$i]}"

    echo "🚀 Deploying $name ($region)..."
    npx wrangler deploy --config "wrangler.$region.toml" --env production
    echo "✅ $name deployed to $region.healthchecks.ross.gg"
    echo ""
done

echo "🎉 All 9 Smart Placement deployments complete!"
echo ""
echo "📋 Deployed endpoints (complete global coverage):"
for i in "${!regions[@]}"; do
    region="${regions[$i]}"
    name="${region_names[$i]}"
    echo "  • $name ($region): https://$region.healthchecks.ross.gg"
done
echo ""
echo "⚠️  Configure DNS records for 3 new regions (sam, afr, me)!"
echo ""
echo "🌍 Coverage:"
echo "  • North America: 2 regions (enam, wnam)"
echo "  • South America: 1 region (sam)"
echo "  • Europe: 2 regions (weur, eeur)"
echo "  • Asia/Pacific: 2 regions (apac, oc)"
echo "  • Africa: 1 region (afr)"
echo "  • Middle East: 1 region (me)"
