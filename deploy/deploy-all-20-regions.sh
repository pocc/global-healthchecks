#!/bin/bash
# Deploy all 20 Workers: 6 original + 11 regional + 3 new = complete global coverage

set -e

# Force clear API token to use OAuth authentication instead
unset CLOUDFLARE_API_TOKEN
export CLOUDFLARE_API_TOKEN=""

echo "🌍 Deploying Global Health Checks to ALL 20 regional endpoints..."
echo ""

# Build the frontend first
echo "📦 Building frontend..."
npm run build
echo "✅ Frontend built"
echo ""

# All 20 Workers (6 original + 11 regional + 3 new)
regions=(
  # Original 6 Smart Placement
  "enam" "wnam" "weur" "eeur" "apac" "oc"
  # 11 Regional Services subdomains (using valid Smart Placement hints)
  "us" "fedramp" "ca" "eu" "isoeu" "de" "jp" "sg" "kr" "in" "au"
  # 3 New Smart Placement
  "sam" "afr" "me"
)

region_names=(
  # Original 6
  "East North America (enam)"
  "West North America (wnam)"
  "West Europe (weur)"
  "East Europe (eeur)"
  "Asia Pacific (apac)"
  "Oceania (oc)"
  # 11 Regional
  "United States (→ enam)"
  "US FedRAMP (→ enam)"
  "Canada (→ enam)"
  "Europe (→ weur)"
  "ISO Europe (→ weur)"
  "Germany (→ eeur)"
  "Japan (→ apac)"
  "Singapore (→ apac)"
  "South Korea (→ apac)"
  "India (→ apac)"
  "Australia (→ oc)"
  # 3 New
  "South America (sam)"
  "Africa (afr)"
  "Middle East (me)"
)

echo "✨ Deploying 20 Workers with Smart Placement hints"
echo ""

# Deploy each worker
for i in "${!regions[@]}"; do
    region="${regions[$i]}"
    name="${region_names[$i]}"

    echo "🚀 Deploying $name..."
    npx wrangler deploy --config "wrangler.$region.toml" --env production || echo "⚠️  Failed to deploy $region (may need DNS)"
    echo ""
done

echo "🎉 Deployment complete!"
echo ""
echo "📋 All 20 endpoints:"
echo ""
echo "Original Smart Placement (6):"
for region in enam wnam weur eeur apac oc; do
    echo "  • https://$region.healthchecks.ross.gg"
done
echo ""
echo "Regional Services subdomains (11):"
for region in us fedramp ca eu isoeu de jp sg kr in au; do
    echo "  • https://$region.healthchecks.ross.gg"
done
echo ""
echo "New Smart Placement (3):"
for region in sam afr me; do
    echo "  • https://$region.healthchecks.ross.gg"
done
echo ""
echo "⚠️  Configure DNS for 14 new subdomains (11 regional + 3 new)!"
