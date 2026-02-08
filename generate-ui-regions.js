/**
 * Generate TypeScript constants for App.tsx with all cloud provider regions
 */

const AWS_REGIONS = [
  { code: 'us-east-1', name: 'US East (N. Virginia)', flag: '🇺🇸' },
  { code: 'us-east-2', name: 'US East (Ohio)', flag: '🇺🇸' },
  { code: 'us-west-1', name: 'US West (N. California)', flag: '🇺🇸' },
  { code: 'us-west-2', name: 'US West (Oregon)', flag: '🇺🇸' },
  { code: 'af-south-1', name: 'Africa (Cape Town)', flag: '🇿🇦' },
  { code: 'ap-east-1', name: 'Asia Pacific (Hong Kong)', flag: '🇭🇰' },
  { code: 'ap-south-1', name: 'Asia Pacific (Mumbai)', flag: '🇮🇳' },
  { code: 'ap-south-2', name: 'Asia Pacific (Hyderabad)', flag: '🇮🇳' },
  { code: 'ap-northeast-1', name: 'Asia Pacific (Tokyo)', flag: '🇯🇵' },
  { code: 'ap-northeast-2', name: 'Asia Pacific (Seoul)', flag: '🇰🇷' },
  { code: 'ap-northeast-3', name: 'Asia Pacific (Osaka)', flag: '🇯🇵' },
  { code: 'ap-southeast-1', name: 'Asia Pacific (Singapore)', flag: '🇸🇬' },
  { code: 'ap-southeast-2', name: 'Asia Pacific (Sydney)', flag: '🇦🇺' },
  { code: 'ap-southeast-3', name: 'Asia Pacific (Jakarta)', flag: '🇮🇩' },
  { code: 'ap-southeast-4', name: 'Asia Pacific (Melbourne)', flag: '🇦🇺' },
  { code: 'ap-southeast-5', name: 'Asia Pacific (Malaysia)', flag: '🇲🇾' },
  { code: 'ap-southeast-6', name: 'Asia Pacific (New Zealand)', flag: '🇳🇿' },
  { code: 'ap-southeast-7', name: 'Asia Pacific (Thailand)', flag: '🇹🇭' },
  { code: 'ap-east-2', name: 'Asia Pacific (Taipei)', flag: '🇹🇼' },
  { code: 'ca-central-1', name: 'Canada (Central)', flag: '🇨🇦' },
  { code: 'ca-west-1', name: 'Canada West (Calgary)', flag: '🇨🇦' },
  { code: 'eu-central-1', name: 'Europe (Frankfurt)', flag: '🇩🇪' },
  { code: 'eu-central-2', name: 'Europe (Zurich)', flag: '🇨🇭' },
  { code: 'eu-west-1', name: 'Europe (Ireland)', flag: '🇮🇪' },
  { code: 'eu-west-2', name: 'Europe (London)', flag: '🇬🇧' },
  { code: 'eu-west-3', name: 'Europe (Paris)', flag: '🇫🇷' },
  { code: 'eu-north-1', name: 'Europe (Stockholm)', flag: '🇸🇪' },
  { code: 'eu-south-1', name: 'Europe (Milan)', flag: '🇮🇹' },
  { code: 'eu-south-2', name: 'Europe (Spain)', flag: '🇪🇸' },
  { code: 'il-central-1', name: 'Israel (Tel Aviv)', flag: '🇮🇱' },
  { code: 'me-south-1', name: 'Middle East (Bahrain)', flag: '🇧🇭' },
  { code: 'me-central-1', name: 'Middle East (UAE)', flag: '🇦🇪' },
  { code: 'mx-central-1', name: 'Mexico (Central)', flag: '🇲🇽' },
  { code: 'sa-east-1', name: 'South America (São Paulo)', flag: '🇧🇷' },
];

const GCP_REGIONS = [
  { code: 'africa-south1', name: 'Johannesburg', flag: '🇿🇦' },
  { code: 'asia-east1', name: 'Taiwan', flag: '🇹🇼' },
  { code: 'asia-east2', name: 'Hong Kong', flag: '🇭🇰' },
  { code: 'asia-northeast1', name: 'Tokyo', flag: '🇯🇵' },
  { code: 'asia-northeast2', name: 'Osaka', flag: '🇯🇵' },
  { code: 'asia-northeast3', name: 'Seoul', flag: '🇰🇷' },
  { code: 'asia-south1', name: 'Mumbai', flag: '🇮🇳' },
  { code: 'asia-south2', name: 'Delhi', flag: '🇮🇳' },
  { code: 'asia-southeast1', name: 'Singapore', flag: '🇸🇬' },
  { code: 'asia-southeast2', name: 'Jakarta', flag: '🇮🇩' },
  { code: 'asia-southeast3', name: 'Bangkok', flag: '🇹🇭' },
  { code: 'australia-southeast1', name: 'Sydney', flag: '🇦🇺' },
  { code: 'australia-southeast2', name: 'Melbourne', flag: '🇦🇺' },
  { code: 'europe-central2', name: 'Warsaw', flag: '🇵🇱' },
  { code: 'europe-north1', name: 'Finland', flag: '🇫🇮' },
  { code: 'europe-north2', name: 'Stockholm', flag: '🇸🇪' },
  { code: 'europe-southwest1', name: 'Madrid', flag: '🇪🇸' },
  { code: 'europe-west1', name: 'Belgium', flag: '🇧🇪' },
  { code: 'europe-west2', name: 'London', flag: '🇬🇧' },
  { code: 'europe-west3', name: 'Frankfurt', flag: '🇩🇪' },
  { code: 'europe-west4', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'europe-west6', name: 'Zurich', flag: '🇨🇭' },
  { code: 'europe-west8', name: 'Milan', flag: '🇮🇹' },
  { code: 'europe-west9', name: 'Paris', flag: '🇫🇷' },
  { code: 'europe-west10', name: 'Berlin', flag: '🇩🇪' },
  { code: 'europe-west12', name: 'Turin', flag: '🇮🇹' },
  { code: 'me-central1', name: 'Doha', flag: '🇶🇦' },
  { code: 'me-central2', name: 'Dammam', flag: '🇸🇦' },
  { code: 'me-west1', name: 'Tel Aviv', flag: '🇮🇱' },
  { code: 'northamerica-northeast1', name: 'Montreal', flag: '🇨🇦' },
  { code: 'northamerica-northeast2', name: 'Toronto', flag: '🇨🇦' },
  { code: 'northamerica-south1', name: 'Mexico', flag: '🇲🇽' },
  { code: 'southamerica-east1', name: 'São Paulo', flag: '🇧🇷' },
  { code: 'southamerica-west1', name: 'Santiago', flag: '🇨🇱' },
  { code: 'us-central1', name: 'Iowa', flag: '🇺🇸' },
  { code: 'us-east1', name: 'South Carolina', flag: '🇺🇸' },
  { code: 'us-east4', name: 'Virginia', flag: '🇺🇸' },
  { code: 'us-east5', name: 'Ohio', flag: '🇺🇸' },
  { code: 'us-south1', name: 'Dallas', flag: '🇺🇸' },
  { code: 'us-west1', name: 'Oregon', flag: '🇺🇸' },
  { code: 'us-west2', name: 'Los Angeles', flag: '🇺🇸' },
  { code: 'us-west3', name: 'Utah', flag: '🇺🇸' },
  { code: 'us-west4', name: 'Las Vegas', flag: '🇺🇸' },
];

const AZURE_REGIONS = [
  { code: 'australiacentral', name: 'Canberra', flag: '🇦🇺' },
  { code: 'australiacentral2', name: 'Canberra', flag: '🇦🇺' },
  { code: 'australiaeast', name: 'New South Wales', flag: '🇦🇺' },
  { code: 'australiasoutheast', name: 'Victoria', flag: '🇦🇺' },
  { code: 'austriaeast', name: 'Vienna', flag: '🇦🇹' },
  { code: 'belgiumcentral', name: 'Brussels', flag: '🇧🇪' },
  { code: 'brazilsouth', name: 'Sao Paulo', flag: '🇧🇷' },
  { code: 'brazilsoutheast', name: 'Rio', flag: '🇧🇷' },
  { code: 'canadacentral', name: 'Toronto', flag: '🇨🇦' },
  { code: 'canadaeast', name: 'Quebec', flag: '🇨🇦' },
  { code: 'centralindia', name: 'Pune', flag: '🇮🇳' },
  { code: 'centralus', name: 'Iowa', flag: '🇺🇸' },
  { code: 'chilecentral', name: 'Santiago', flag: '🇨🇱' },
  { code: 'denmarkeast', name: 'Copenhagen', flag: '🇩🇰' },
  { code: 'eastasia', name: 'Hong Kong', flag: '🇭🇰' },
  { code: 'eastus', name: 'Virginia', flag: '🇺🇸' },
  { code: 'eastus2', name: 'Virginia', flag: '🇺🇸' },
  { code: 'francecentral', name: 'Paris', flag: '🇫🇷' },
  { code: 'francesouth', name: 'Marseille', flag: '🇫🇷' },
  { code: 'germanynorth', name: 'Berlin', flag: '🇩🇪' },
  { code: 'germanywestcentral', name: 'Frankfurt', flag: '🇩🇪' },
  { code: 'indonesiacentral', name: 'Jakarta', flag: '🇮🇩' },
  { code: 'israelcentral', name: 'Israel', flag: '🇮🇱' },
  { code: 'italynorth', name: 'Milan', flag: '🇮🇹' },
  { code: 'japaneast', name: 'Tokyo', flag: '🇯🇵' },
  { code: 'japanwest', name: 'Osaka', flag: '🇯🇵' },
  { code: 'koreacentral', name: 'Seoul', flag: '🇰🇷' },
  { code: 'koreasouth', name: 'Busan', flag: '🇰🇷' },
  { code: 'malaysiawest', name: 'Kuala Lumpur', flag: '🇲🇾' },
  { code: 'mexicocentral', name: 'Querétaro', flag: '🇲🇽' },
  { code: 'newzealandnorth', name: 'Auckland', flag: '🇳🇿' },
  { code: 'northcentralus', name: 'Illinois', flag: '🇺🇸' },
  { code: 'northeurope', name: 'Ireland', flag: '🇮🇪' },
  { code: 'norwayeast', name: 'Norway', flag: '🇳🇴' },
  { code: 'norwaywest', name: 'Norway', flag: '🇳🇴' },
  { code: 'polandcentral', name: 'Warsaw', flag: '🇵🇱' },
  { code: 'qatarcentral', name: 'Doha', flag: '🇶🇦' },
  { code: 'southafricanorth', name: 'Johannesburg', flag: '🇿🇦' },
  { code: 'southafricawest', name: 'Cape Town', flag: '🇿🇦' },
  { code: 'southcentralus', name: 'Texas', flag: '🇺🇸' },
  { code: 'southindia', name: 'Chennai', flag: '🇮🇳' },
  { code: 'southeastasia', name: 'Singapore', flag: '🇸🇬' },
  { code: 'spaincentral', name: 'Madrid', flag: '🇪🇸' },
  { code: 'swedencentral', name: 'Gävle', flag: '🇸🇪' },
  { code: 'switzerlandnorth', name: 'Zurich', flag: '🇨🇭' },
  { code: 'switzerlandwest', name: 'Geneva', flag: '🇨🇭' },
  { code: 'uaecentral', name: 'Abu Dhabi', flag: '🇦🇪' },
  { code: 'uaenorth', name: 'Dubai', flag: '🇦🇪' },
  { code: 'uksouth', name: 'London', flag: '🇬🇧' },
  { code: 'ukwest', name: 'Cardiff', flag: '🇬🇧' },
  { code: 'westcentralus', name: 'Wyoming', flag: '🇺🇸' },
  { code: 'westeurope', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'westindia', name: 'Mumbai', flag: '🇮🇳' },
  { code: 'westus', name: 'California', flag: '🇺🇸' },
  { code: 'westus2', name: 'Washington', flag: '🇺🇸' },
  { code: 'westus3', name: 'Phoenix', flag: '🇺🇸' },
];

// Generate TypeScript code
let output = `// Cloud Provider Placement Hints - AWS (${AWS_REGIONS.length} regions)\n`;
output += `const AWS_PLACEMENT = [\n`;
AWS_REGIONS.forEach(({ code, name, flag }) => {
  output += `  { code: 'aws-${code}', name: 'AWS: ${name}', flag: '${flag}', provider: 'aws' },\n`;
});
output += `];\n\n`;

output += `// Cloud Provider Placement Hints - GCP (${GCP_REGIONS.length} regions)\n`;
output += `const GCP_PLACEMENT = [\n`;
GCP_REGIONS.forEach(({ code, name, flag }) => {
  output += `  { code: 'gcp-${code}', name: 'GCP: ${name}', flag: '${flag}', provider: 'gcp' },\n`;
});
output += `];\n\n`;

output += `// Cloud Provider Placement Hints - Azure (${AZURE_REGIONS.length} regions)\n`;
output += `const AZURE_PLACEMENT = [\n`;
AZURE_REGIONS.forEach(({ code, name, flag }) => {
  output += `  { code: 'azure-${code}', name: 'Azure: ${name}', flag: '${flag}', provider: 'azure' },\n`;
});
output += `];\n`;

console.log(output);
console.log(`\n// Add to selectedRegions initialization:`);
console.log(`const selectedRegions = [`);
console.log(`  ...REGIONAL_SERVICES.map((r) => r.code),`);
console.log(`  ...AWS_PLACEMENT.map((r) => r.code),`);
console.log(`  ...GCP_PLACEMENT.map((r) => r.code),`);
console.log(`  ...AZURE_PLACEMENT.map((r) => r.code)`);
console.log(`];`);
console.log(`\n// Total regions: ${10 + AWS_REGIONS.length + GCP_REGIONS.length + AZURE_REGIONS.length}`);
