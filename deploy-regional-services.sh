#!/bin/bash
# Deploy all Regional Services Workers for compliance-grade multi-region testing

set -e

# Unset API token to use OAuth authentication instead
unset CLOUDFLARE_API_TOKEN

echo "🌍 Deploying Global Health Checks to 11 Regional Services regions..."
echo ""

# Build the frontend first
echo "📦 Building frontend..."
npm run build
echo "✅ Frontend built"
echo ""

# Regional Services regions (compliance boundaries)
regions=("us" "fedramp" "ca" "eu" "isoeu" "de" "jp" "sg" "kr" "in" "au")
region_names=(
  "United States"
  "US FedRAMP"
  "Canada"
  "Europe (GDPR)"
  "ISO Europe"
  "Germany"
  "Japan"
  "Singapore"
  "South Korea"
  "India"
  "Australia"
)

echo "🔐 Deploying with Regional Services (compliance-grade boundaries)"
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

echo "🎉 All Regional Services deployments complete!"
echo ""
echo "📋 Deployed endpoints (Regional Services mode):"
for i in "${!regions[@]}"; do
    region="${regions[$i]}"
    name="${region_names[$i]}"
    echo "  • $name: https://$region.healthchecks.ross.gg"
done
echo ""
echo "🔐 All Workers use Regional Services with guaranteed geographic boundaries"
echo "⚠️  Configure DNS records for new regions! See REGIONAL_SERVICES_SETUP.md"
