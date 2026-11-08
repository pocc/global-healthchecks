import type { Continent } from '../types';

export const REGIONAL_SERVICES = [
  { code: 'us', name: 'United States', flag: '🇺🇸', description: 'North America' },
  { code: 'ca', name: 'Canada', flag: '🇨🇦', description: 'North America' },
  { code: 'eu', name: 'Europe', flag: '🇪🇺', description: 'GDPR Compliant' },
  { code: 'isoeu', name: 'ISO Europe', flag: '🔒', description: 'Enhanced Security' },
  { code: 'de', name: 'Germany', flag: '🇩🇪', description: 'Central Europe' },
  { code: 'jp', name: 'Japan', flag: '🇯🇵', description: 'East Asia' },
  { code: 'sg', name: 'Singapore', flag: '🇸🇬', description: 'Southeast Asia' },
  { code: 'kr', name: 'South Korea', flag: '🇰🇷', description: 'East Asia' },
  { code: 'in', name: 'India', flag: '🇮🇳', description: 'South Asia' },
  { code: 'au', name: 'Australia', flag: '🇦🇺', description: 'Oceania' },
];

export const AWS_PLACEMENT = [
  { code: 'aws-us-east-1', name: 'AWS: US East (N. Virginia)', flag: '🇺🇸', provider: 'aws' },
  { code: 'aws-us-east-2', name: 'AWS: US East (Ohio)', flag: '🇺🇸', provider: 'aws' },
  { code: 'aws-us-west-1', name: 'AWS: US West (N. California)', flag: '🇺🇸', provider: 'aws' },
  { code: 'aws-us-west-2', name: 'AWS: US West (Oregon)', flag: '🇺🇸', provider: 'aws' },
  { code: 'aws-af-south-1', name: 'AWS: Africa (Cape Town)', flag: '🇿🇦', provider: 'aws' },
  { code: 'aws-ap-east-1', name: 'AWS: Asia Pacific (Hong Kong)', flag: '🇭🇰', provider: 'aws' },
  { code: 'aws-ap-south-1', name: 'AWS: Asia Pacific (Mumbai)', flag: '🇮🇳', provider: 'aws' },
  { code: 'aws-ap-south-2', name: 'AWS: Asia Pacific (Hyderabad)', flag: '🇮🇳', provider: 'aws' },
  { code: 'aws-ap-northeast-1', name: 'AWS: Asia Pacific (Tokyo)', flag: '🇯🇵', provider: 'aws' },
  { code: 'aws-ap-northeast-2', name: 'AWS: Asia Pacific (Seoul)', flag: '🇰🇷', provider: 'aws' },
  { code: 'aws-ap-northeast-3', name: 'AWS: Asia Pacific (Osaka)', flag: '🇯🇵', provider: 'aws' },
  { code: 'aws-ap-southeast-1', name: 'AWS: Asia Pacific (Singapore)', flag: '🇸🇬', provider: 'aws' },
  { code: 'aws-ap-southeast-2', name: 'AWS: Asia Pacific (Sydney)', flag: '🇦🇺', provider: 'aws' },
  { code: 'aws-ap-southeast-3', name: 'AWS: Asia Pacific (Jakarta)', flag: '🇮🇩', provider: 'aws' },
  { code: 'aws-ap-southeast-4', name: 'AWS: Asia Pacific (Melbourne)', flag: '🇦🇺', provider: 'aws' },
  { code: 'aws-ap-southeast-5', name: 'AWS: Asia Pacific (Malaysia)', flag: '🇲🇾', provider: 'aws' },
  { code: 'aws-ap-southeast-6', name: 'AWS: Asia Pacific (New Zealand)', flag: '🇳🇿', provider: 'aws' },
  { code: 'aws-ap-southeast-7', name: 'AWS: Asia Pacific (Thailand)', flag: '🇹🇭', provider: 'aws' },
  { code: 'aws-ap-east-2', name: 'AWS: Asia Pacific (Taipei)', flag: '🇹🇼', provider: 'aws' },
  { code: 'aws-ca-central-1', name: 'AWS: Canada (Central)', flag: '🇨🇦', provider: 'aws' },
  { code: 'aws-ca-west-1', name: 'AWS: Canada West (Calgary)', flag: '🇨🇦', provider: 'aws' },
  { code: 'aws-eu-central-1', name: 'AWS: Europe (Frankfurt)', flag: '🇩🇪', provider: 'aws' },
  { code: 'aws-eu-central-2', name: 'AWS: Europe (Zurich)', flag: '🇨🇭', provider: 'aws' },
  { code: 'aws-eu-west-1', name: 'AWS: Europe (Ireland)', flag: '🇮🇪', provider: 'aws' },
  { code: 'aws-eu-west-2', name: 'AWS: Europe (London)', flag: '🇬🇧', provider: 'aws' },
  { code: 'aws-eu-west-3', name: 'AWS: Europe (Paris)', flag: '🇫🇷', provider: 'aws' },
  { code: 'aws-eu-north-1', name: 'AWS: Europe (Stockholm)', flag: '🇸🇪', provider: 'aws' },
  { code: 'aws-eu-south-1', name: 'AWS: Europe (Milan)', flag: '🇮🇹', provider: 'aws' },
  { code: 'aws-eu-south-2', name: 'AWS: Europe (Spain)', flag: '🇪🇸', provider: 'aws' },
  { code: 'aws-il-central-1', name: 'AWS: Israel (Tel Aviv)', flag: '🇮🇱', provider: 'aws' },
  { code: 'aws-me-south-1', name: 'AWS: Middle East (Bahrain)', flag: '🇧🇭', provider: 'aws' },
  { code: 'aws-me-central-1', name: 'AWS: Middle East (UAE)', flag: '🇦🇪', provider: 'aws' },
  { code: 'aws-mx-central-1', name: 'AWS: Mexico (Central)', flag: '🇲🇽', provider: 'aws' },
  { code: 'aws-sa-east-1', name: 'AWS: South America (São Paulo)', flag: '🇧🇷', provider: 'aws' },
];

export const GCP_PLACEMENT = [
  { code: 'gcp-africa-south1', name: 'GCP: Johannesburg', flag: '🇿🇦', provider: 'gcp' },
  { code: 'gcp-asia-east1', name: 'GCP: Taiwan', flag: '🇹🇼', provider: 'gcp' },
  { code: 'gcp-asia-east2', name: 'GCP: Hong Kong', flag: '🇭🇰', provider: 'gcp' },
  { code: 'gcp-asia-northeast1', name: 'GCP: Tokyo', flag: '🇯🇵', provider: 'gcp' },
  { code: 'gcp-asia-northeast2', name: 'GCP: Osaka', flag: '🇯🇵', provider: 'gcp' },
  { code: 'gcp-asia-northeast3', name: 'GCP: Seoul', flag: '🇰🇷', provider: 'gcp' },
  { code: 'gcp-asia-south1', name: 'GCP: Mumbai', flag: '🇮🇳', provider: 'gcp' },
  { code: 'gcp-asia-south2', name: 'GCP: Delhi', flag: '🇮🇳', provider: 'gcp' },
  { code: 'gcp-asia-southeast1', name: 'GCP: Singapore', flag: '🇸🇬', provider: 'gcp' },
  { code: 'gcp-asia-southeast2', name: 'GCP: Jakarta', flag: '🇮🇩', provider: 'gcp' },
  { code: 'gcp-asia-southeast3', name: 'GCP: Bangkok', flag: '🇹🇭', provider: 'gcp' },
  { code: 'gcp-australia-southeast1', name: 'GCP: Sydney', flag: '🇦🇺', provider: 'gcp' },
  { code: 'gcp-australia-southeast2', name: 'GCP: Melbourne', flag: '🇦🇺', provider: 'gcp' },
  { code: 'gcp-europe-central2', name: 'GCP: Warsaw', flag: '🇵🇱', provider: 'gcp' },
  { code: 'gcp-europe-north1', name: 'GCP: Finland', flag: '🇫🇮', provider: 'gcp' },
  { code: 'gcp-europe-north2', name: 'GCP: Stockholm', flag: '🇸🇪', provider: 'gcp' },
  { code: 'gcp-europe-southwest1', name: 'GCP: Madrid', flag: '🇪🇸', provider: 'gcp' },
  { code: 'gcp-europe-west1', name: 'GCP: Belgium', flag: '🇧🇪', provider: 'gcp' },
  { code: 'gcp-europe-west2', name: 'GCP: London', flag: '🇬🇧', provider: 'gcp' },
  { code: 'gcp-europe-west3', name: 'GCP: Frankfurt', flag: '🇩🇪', provider: 'gcp' },
  { code: 'gcp-europe-west4', name: 'GCP: Netherlands', flag: '🇳🇱', provider: 'gcp' },
  { code: 'gcp-europe-west6', name: 'GCP: Zurich', flag: '🇨🇭', provider: 'gcp' },
  { code: 'gcp-europe-west8', name: 'GCP: Milan', flag: '🇮🇹', provider: 'gcp' },
  { code: 'gcp-europe-west9', name: 'GCP: Paris', flag: '🇫🇷', provider: 'gcp' },
  { code: 'gcp-europe-west10', name: 'GCP: Berlin', flag: '🇩🇪', provider: 'gcp' },
  { code: 'gcp-europe-west12', name: 'GCP: Turin', flag: '🇮🇹', provider: 'gcp' },
  { code: 'gcp-me-central1', name: 'GCP: Doha', flag: '🇶🇦', provider: 'gcp' },
  { code: 'gcp-me-central2', name: 'GCP: Dammam', flag: '🇸🇦', provider: 'gcp' },
  { code: 'gcp-me-west1', name: 'GCP: Tel Aviv', flag: '🇮🇱', provider: 'gcp' },
  { code: 'gcp-northamerica-northeast1', name: 'GCP: Montreal', flag: '🇨🇦', provider: 'gcp' },
  { code: 'gcp-northamerica-northeast2', name: 'GCP: Toronto', flag: '🇨🇦', provider: 'gcp' },
  { code: 'gcp-northamerica-south1', name: 'GCP: Mexico', flag: '🇲🇽', provider: 'gcp' },
  { code: 'gcp-southamerica-east1', name: 'GCP: São Paulo', flag: '🇧🇷', provider: 'gcp' },
  { code: 'gcp-southamerica-west1', name: 'GCP: Santiago', flag: '🇨🇱', provider: 'gcp' },
  { code: 'gcp-us-central1', name: 'GCP: Iowa', flag: '🇺🇸', provider: 'gcp' },
  { code: 'gcp-us-east1', name: 'GCP: South Carolina', flag: '🇺🇸', provider: 'gcp' },
  { code: 'gcp-us-east4', name: 'GCP: Virginia', flag: '🇺🇸', provider: 'gcp' },
  { code: 'gcp-us-east5', name: 'GCP: Ohio', flag: '🇺🇸', provider: 'gcp' },
  { code: 'gcp-us-south1', name: 'GCP: Dallas', flag: '🇺🇸', provider: 'gcp' },
  { code: 'gcp-us-west1', name: 'GCP: Oregon', flag: '🇺🇸', provider: 'gcp' },
  { code: 'gcp-us-west2', name: 'GCP: Los Angeles', flag: '🇺🇸', provider: 'gcp' },
  { code: 'gcp-us-west3', name: 'GCP: Utah', flag: '🇺🇸', provider: 'gcp' },
  { code: 'gcp-us-west4', name: 'GCP: Las Vegas', flag: '🇺🇸', provider: 'gcp' },
];

export const AZURE_PLACEMENT = [
  { code: 'azure-australiacentral', name: 'Azure: Canberra', flag: '🇦🇺', provider: 'azure' },
  { code: 'azure-australiacentral2', name: 'Azure: Canberra', flag: '🇦🇺', provider: 'azure' },
  { code: 'azure-australiaeast', name: 'Azure: New South Wales', flag: '🇦🇺', provider: 'azure' },
  { code: 'azure-australiasoutheast', name: 'Azure: Victoria', flag: '🇦🇺', provider: 'azure' },
  { code: 'azure-austriaeast', name: 'Azure: Vienna', flag: '🇦🇹', provider: 'azure' },
  { code: 'azure-belgiumcentral', name: 'Azure: Brussels', flag: '🇧🇪', provider: 'azure' },
  { code: 'azure-brazilsouth', name: 'Azure: Sao Paulo', flag: '🇧🇷', provider: 'azure' },
  { code: 'azure-brazilsoutheast', name: 'Azure: Rio', flag: '🇧🇷', provider: 'azure' },
  { code: 'azure-canadacentral', name: 'Azure: Toronto', flag: '🇨🇦', provider: 'azure' },
  { code: 'azure-canadaeast', name: 'Azure: Quebec', flag: '🇨🇦', provider: 'azure' },
  { code: 'azure-centralindia', name: 'Azure: Pune', flag: '🇮🇳', provider: 'azure' },
  { code: 'azure-centralus', name: 'Azure: Iowa', flag: '🇺🇸', provider: 'azure' },
  { code: 'azure-chilecentral', name: 'Azure: Santiago', flag: '🇨🇱', provider: 'azure' },
  { code: 'azure-denmarkeast', name: 'Azure: Copenhagen', flag: '🇩🇰', provider: 'azure' },
  { code: 'azure-eastasia', name: 'Azure: Hong Kong', flag: '🇭🇰', provider: 'azure' },
  { code: 'azure-eastus', name: 'Azure: Virginia', flag: '🇺🇸', provider: 'azure' },
  { code: 'azure-eastus2', name: 'Azure: Virginia', flag: '🇺🇸', provider: 'azure' },
  { code: 'azure-francecentral', name: 'Azure: Paris', flag: '🇫🇷', provider: 'azure' },
  { code: 'azure-francesouth', name: 'Azure: Marseille', flag: '🇫🇷', provider: 'azure' },
  { code: 'azure-germanynorth', name: 'Azure: Berlin', flag: '🇩🇪', provider: 'azure' },
  { code: 'azure-germanywestcentral', name: 'Azure: Frankfurt', flag: '🇩🇪', provider: 'azure' },
  { code: 'azure-indonesiacentral', name: 'Azure: Jakarta', flag: '🇮🇩', provider: 'azure' },
  { code: 'azure-israelcentral', name: 'Azure: Israel', flag: '🇮🇱', provider: 'azure' },
  { code: 'azure-italynorth', name: 'Azure: Milan', flag: '🇮🇹', provider: 'azure' },
  { code: 'azure-japaneast', name: 'Azure: Tokyo', flag: '🇯🇵', provider: 'azure' },
  { code: 'azure-japanwest', name: 'Azure: Osaka', flag: '🇯🇵', provider: 'azure' },
  { code: 'azure-koreacentral', name: 'Azure: Seoul', flag: '🇰🇷', provider: 'azure' },
  { code: 'azure-koreasouth', name: 'Azure: Busan', flag: '🇰🇷', provider: 'azure' },
  { code: 'azure-malaysiawest', name: 'Azure: Kuala Lumpur', flag: '🇲🇾', provider: 'azure' },
  { code: 'azure-mexicocentral', name: 'Azure: Querétaro', flag: '🇲🇽', provider: 'azure' },
  { code: 'azure-newzealandnorth', name: 'Azure: Auckland', flag: '🇳🇿', provider: 'azure' },
  { code: 'azure-northcentralus', name: 'Azure: Illinois', flag: '🇺🇸', provider: 'azure' },
  { code: 'azure-northeurope', name: 'Azure: Ireland', flag: '🇮🇪', provider: 'azure' },
  { code: 'azure-norwayeast', name: 'Azure: Norway', flag: '🇳🇴', provider: 'azure' },
  { code: 'azure-norwaywest', name: 'Azure: Norway', flag: '🇳🇴', provider: 'azure' },
  { code: 'azure-polandcentral', name: 'Azure: Warsaw', flag: '🇵🇱', provider: 'azure' },
  { code: 'azure-qatarcentral', name: 'Azure: Doha', flag: '🇶🇦', provider: 'azure' },
  { code: 'azure-southafricanorth', name: 'Azure: Johannesburg', flag: '🇿🇦', provider: 'azure' },
  { code: 'azure-southafricawest', name: 'Azure: Cape Town', flag: '🇿🇦', provider: 'azure' },
  { code: 'azure-southcentralus', name: 'Azure: Texas', flag: '🇺🇸', provider: 'azure' },
  { code: 'azure-southindia', name: 'Azure: Chennai', flag: '🇮🇳', provider: 'azure' },
  { code: 'azure-southeastasia', name: 'Azure: Singapore', flag: '🇸🇬', provider: 'azure' },
  { code: 'azure-spaincentral', name: 'Azure: Madrid', flag: '🇪🇸', provider: 'azure' },
  { code: 'azure-swedencentral', name: 'Azure: Gävle', flag: '🇸🇪', provider: 'azure' },
  { code: 'azure-switzerlandnorth', name: 'Azure: Zurich', flag: '🇨🇭', provider: 'azure' },
  { code: 'azure-switzerlandwest', name: 'Azure: Geneva', flag: '🇨🇭', provider: 'azure' },
  { code: 'azure-uaecentral', name: 'Azure: Abu Dhabi', flag: '🇦🇪', provider: 'azure' },
  { code: 'azure-uaenorth', name: 'Azure: Dubai', flag: '🇦🇪', provider: 'azure' },
  { code: 'azure-uksouth', name: 'Azure: London', flag: '🇬🇧', provider: 'azure' },
  { code: 'azure-ukwest', name: 'Azure: Cardiff', flag: '🇬🇧', provider: 'azure' },
  { code: 'azure-westcentralus', name: 'Azure: Wyoming', flag: '🇺🇸', provider: 'azure' },
  { code: 'azure-westeurope', name: 'Azure: Netherlands', flag: '🇳🇱', provider: 'azure' },
  { code: 'azure-westindia', name: 'Azure: Mumbai', flag: '🇮🇳', provider: 'azure' },
  { code: 'azure-westus', name: 'Azure: California', flag: '🇺🇸', provider: 'azure' },
  { code: 'azure-westus2', name: 'Azure: Washington', flag: '🇺🇸', provider: 'azure' },
  { code: 'azure-westus3', name: 'Azure: Phoenix', flag: '🇺🇸', provider: 'azure' },
];

export const CONTINENTS: Continent[] = ['North America', 'Europe', 'Asia Pacific', 'Oceania', 'Middle East', 'South America', 'Africa'];

export const FLAG_TO_COUNTRY: Record<string, string> = {
  '🇺🇸': 'US', '🇨🇦': 'Canada', '🇲🇽': 'Mexico', '🇧🇷': 'Brazil', '🇨🇱': 'Chile',
  '🇬🇧': 'UK', '🇩🇪': 'Germany', '🇫🇷': 'France', '🇮🇪': 'Ireland', '🇮🇹': 'Italy',
  '🇪🇸': 'Spain', '🇸🇪': 'Sweden', '🇨🇭': 'Switzerland', '🇳🇱': 'Netherlands', '🇵🇱': 'Poland',
  '🇧🇪': 'Belgium', '🇫🇮': 'Finland', '🇦🇹': 'Austria', '🇳🇴': 'Norway', '🇩🇰': 'Denmark',
  '🇯🇵': 'Japan', '🇰🇷': 'South Korea', '🇮🇳': 'India', '🇸🇬': 'Singapore', '🇭🇰': 'Hong Kong',
  '🇹🇼': 'Taiwan', '🇮🇩': 'Indonesia', '🇲🇾': 'Malaysia', '🇹🇭': 'Thailand',
  '🇦🇺': 'Australia', '🇳🇿': 'New Zealand',
  '🇮🇱': 'Israel', '🇧🇭': 'Bahrain', '🇦🇪': 'UAE', '🇶🇦': 'Qatar', '🇸🇦': 'Saudi Arabia',
  '🇿🇦': 'South Africa',
  '🇪🇺': 'EU', '🔒': 'ISO EU',
};

export const REGION_TO_COUNTRY: Record<string, string> = Object.fromEntries(
  [...REGIONAL_SERVICES, ...AWS_PLACEMENT, ...GCP_PLACEMENT, ...AZURE_PLACEMENT]
    .map(r => [r.code, FLAG_TO_COUNTRY[r.flag] || r.flag])
);

export function getCountry(code: string): string {
  return REGION_TO_COUNTRY[code] || 'Unknown';
}

export function getContinent(code: string): Continent {
  if (code === 'us' || code === 'ca') return 'North America';
  if (code === 'eu' || code === 'isoeu' || code === 'de') return 'Europe';
  if (code === 'jp' || code === 'kr' || code === 'sg' || code === 'in') return 'Asia Pacific';
  if (code === 'au') return 'Oceania';

  const geo = code.replace(/^(aws|gcp|azure)-/, '');

  if (/^(us|ca|northamerica|centralus|eastus|westus|northcentralus|southcentralus|westcentralus|mexicocentral|mx)/.test(geo)) return 'North America';
  if (/^(sa-|southamerica|brazil|chile)/.test(geo)) return 'South America';
  if (/^(eu-|europe|uk|france|germany|german|italy|spain|sweden|switzerland|norway|poland|denmark|belgium|austria|northeurope|westeurope)/.test(geo)) return 'Europe';
  if (/^(af-|africa|southafrica)/.test(geo)) return 'Africa';
  if (/^(me-|il-|israel|qatar|uae)/.test(geo)) return 'Middle East';
  if (/^(australia|newzealand)/.test(geo)) return 'Oceania';
  if (/^(ap-|asia|japan|korea|india|southindia|centralindia|westindia|southeast|eastasia|malaysia|indonesia)/.test(geo)) return 'Asia Pacific';

  return 'Asia Pacific';
}

export function getRegionType(code: string): 'regional' | 'aws' | 'gcp' | 'azure' {
  if (REGIONAL_SERVICES.some((r) => r.code === code)) return 'regional';
  if (code.startsWith('aws-')) return 'aws';
  if (code.startsWith('gcp-')) return 'gcp';
  return 'azure';
}
