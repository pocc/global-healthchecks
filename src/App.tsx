import { useState, useEffect, useRef } from 'react';
import {
  Handshake,
  Wifi,
  WifiOff,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  Play,
  Square,
  Server,
  Download,
} from 'lucide-react';
import { COLO_TO_CITY } from './coloMapping';

interface HealthCheckRequest {
  host: string;
  port: number;
  timeout?: number;
  region?: string;
}

interface TestResult {
  region: string;
  regionName: string;
  status: 'pending' | 'connected' | 'failed';
  sent: number;
  received: number;
  latencies: number[];
  lastError?: string;
  colo?: string;
  coloCity?: string;
  cfPlacement?: string;
}

// Regional Services - User-friendly subdomains (Primary)
const REGIONAL_SERVICES = [
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

// Cloud Provider Placement Hints - AWS (34 regions)
const AWS_PLACEMENT = [
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

// Cloud Provider Placement Hints - GCP (43 regions)
const GCP_PLACEMENT = [
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

// Cloud Provider Placement Hints - Azure (56 regions)
const AZURE_PLACEMENT = [
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

/** Reverse IPv4 octets for Cymru DNS lookup: "1.2.3.4" → "4.3.2.1" */
const reverseIPv4 = (ip: string): string => ip.split('.').reverse().join('.');

/** Expand and reverse IPv6 nibbles for Cymru DNS lookup */
const reverseIPv6Nibbles = (ip: string): string => {
  const parts = ip.split('::');
  let groups: string[];
  if (parts.length === 2) {
    const left = parts[0] ? parts[0].split(':') : [];
    const right = parts[1] ? parts[1].split(':') : [];
    groups = [...left, ...Array(8 - left.length - right.length).fill('0000'), ...right];
  } else {
    groups = ip.split(':');
  }
  return groups.map(g => g.padStart(4, '0')).join('').split('').reverse().join('.');
};

const CLOUDFLARE_ASN = '13335';

function App() {
  const [host, setHost] = useState('amazon.com');
  const [port, setPort] = useState('443');
  const [hostError, setHostError] = useState('');
  const [portError, setPortError] = useState('');
  const selectedRegions = [
    ...REGIONAL_SERVICES.map((r) => r.code),
    ...AWS_PLACEMENT.map((r) => r.code),
    ...GCP_PLACEMENT.map((r) => r.code),
    ...AZURE_PLACEMENT.map((r) => r.code)
  ];
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const [isValidatingHost, setIsValidatingHost] = useState(false);
  const dnsAbortRef = useRef<AbortController | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // ASN validation: check if target IP/hostname is on Cloudflare's network (AS13335)
  // Uses Team Cymru DNS for ASN lookup, dns.google for hostname resolution
  useEffect(() => {
    dnsAbortRef.current?.abort();

    const trimmedHost = host.trim();
    if (!trimmedHost) {
      setIsValidatingHost(false);
      return;
    }

    const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const ipv6Pattern = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|::([fF]{4}(:0{1,4})?:)?((25[0-5]|(2[0-4]|1?[0-9])?[0-9])\.){3}(25[0-5]|(2[0-4]|1?[0-9])?[0-9]))$/;
    const hostnamePattern = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;

    const isIPv4 = ipv4Pattern.test(trimmedHost);
    const isIPv6 = ipv6Pattern.test(trimmedHost);
    const isHostname = !isIPv4 && !isIPv6 && hostnamePattern.test(trimmedHost);

    if (!isIPv4 && !isIPv6 && !isHostname) {
      setIsValidatingHost(false);
      return;
    }

    // Extra IPv4 validation: octets must be 0-255
    if (isIPv4) {
      const octets = trimmedHost.split('.').map(Number);
      if (!octets.every(o => o >= 0 && o <= 255)) {
        setIsValidatingHost(false);
        return;
      }
    }

    setIsValidatingHost(true);

    const abortController = new AbortController();
    dnsAbortRef.current = abortController;

    const timer = setTimeout(async () => {
      try {
        let ip = trimmedHost;
        let ipVersion: 4 | 6 = isIPv6 ? 6 : 4;

        // If hostname, resolve to IP first
        if (isHostname) {
          const dnsRes = await fetch(
            `https://dns.google/resolve?name=${encodeURIComponent(trimmedHost)}&type=A`,
            { signal: abortController.signal }
          );
          const dnsData: { Answer?: { type: number; data: string }[] } = await dnsRes.json();
          const aRecord = dnsData.Answer?.find(a => a.type === 1);
          if (!aRecord) {
            setIsValidatingHost(false);
            return;
          }
          ip = aRecord.data;
          ipVersion = 4;
        }

        // Look up ASN via Team Cymru DNS
        const cymruName = ipVersion === 6
          ? `${reverseIPv6Nibbles(ip)}.origin6.asn.cymru.com`
          : `${reverseIPv4(ip)}.origin.asn.cymru.com`;

        const asnRes = await fetch(
          `https://dns.google/resolve?name=${cymruName}&type=TXT`,
          { signal: abortController.signal }
        );
        const asnData: { Answer?: { type: number; data: string }[] } = await asnRes.json();
        const txtRecord = asnData.Answer?.find(a => a.type === 16);
        if (txtRecord) {
          // Format: "13335 | 1.1.1.0/24 | US | apnic | 2011-08-11"
          const asn = txtRecord.data.split('|')[0].trim().replace(/"/g, '');
          if (asn === CLOUDFLARE_ASN) {
            const resolvedInfo = isHostname ? ` Resolved: ${ip}.` : '';
            setHostError(
              `Target is on Cloudflare's network (AS${asn}).${resolvedInfo} Connections will be blocked.`
            );
            setIsValidatingHost(false);
            return;
          }
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        // ASN lookup failed — allow the test to proceed
      }
      setIsValidatingHost(false);
    }, 500);

    return () => {
      clearTimeout(timer);
      abortController.abort();
    };
  }, [host]);

  const validateHost = (value: string): boolean => {
    if (!value.trim()) {
      setHostError('');
      return false;
    }

    // IPv4 pattern
    const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const ipv4Match = value.match(ipv4Pattern);
    if (ipv4Match) {
      const octets = ipv4Match.slice(1).map(Number);
      if (!octets.every(octet => octet >= 0 && octet <= 255)) {
        setHostError('Invalid IPv4 address (octets must be 0-255)');
        return false;
      }
      setHostError('');
      return true;
    }

    // IPv6 pattern (simplified - covers most common cases)
    const ipv6Pattern = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|::([fF]{4}(:0{1,4})?:)?((25[0-5]|(2[0-4]|1?[0-9])?[0-9])\.){3}(25[0-5]|(2[0-4]|1?[0-9])?[0-9]))$/;
    if (ipv6Pattern.test(value)) {
      setHostError('');
      return true;
    }

    // Hostname/domain pattern
    // Allows: alphanumeric, hyphens, dots
    // Labels must start/end with alphanumeric, max 63 chars each
    const hostnamePattern = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;
    if (hostnamePattern.test(value)) {
      setHostError('');
      return true;
    }

    setHostError('Invalid hostname, IPv4, or IPv6 address');
    return false;
  };

  const handleHostChange = (value: string) => {
    setHost(value);
    if (value.trim()) {
      const isValid = validateHost(value);
      // All valid inputs need async ASN check
      setIsValidatingHost(isValid);
    } else {
      setHostError('');
      setIsValidatingHost(false);
    }
  };

  const handlePortChange = (value: string) => {
    // Strip non-digit characters
    const digits = value.replace(/\D/g, '');
    setPort(digits);
    if (!digits) {
      setPortError('');
      return;
    }
    const num = parseInt(digits, 10);
    if (num < 1 || num > 65535) {
      setPortError('Port must be between 1 and 65535');
    } else {
      setPortError('');
    }
  };

  const canRun = !isRunning && !isValidatingHost && !!host.trim() && !!port && !hostError && !portError;

  const clearResults = () => {
    setResults([]);
  };

  const getEgressColo = (result: TestResult): { colo: string; city: string } => {
    const regionType = getRegionType(result.region);
    if (regionType === 'regional') {
      return { colo: result.colo || '', city: result.coloCity || '' };
    }
    if (result.cfPlacement) {
      const colo = result.cfPlacement.split('-').slice(1).join('-').toUpperCase();
      return { colo, city: COLO_TO_CITY[colo] || '' };
    }
    // Fallback: if no cfPlacement but we have ingress, assume same
    if (result.colo) {
      return { colo: result.colo, city: result.coloCity || '' };
    }
    return { colo: '', city: '' };
  };

  const downloadCsv = () => {
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const headers = ['Region', 'Sent', 'Loss%', 'Last (ms)', 'Avg (ms)', 'Best (ms)', 'Worst (ms)', 'Ingress Colo', 'Ingress City', 'Egress Colo', 'Egress City'];
    const rows = results.map((r) => {
      const egress = getEgressColo(r);
      const loss = r.sent > 0 ? ((r.sent - r.received) / r.sent * 100).toFixed(1) : '';
      const last = r.latencies.length > 0 ? String(r.latencies[r.latencies.length - 1]) : '';
      const avg = r.latencies.length > 0 ? String(Math.round(r.latencies.reduce((a, b) => a + b, 0) / r.latencies.length)) : '';
      const best = r.latencies.length > 0 ? String(Math.min(...r.latencies)) : '';
      const worst = r.latencies.length > 0 ? String(Math.max(...r.latencies)) : '';
      return [
        escape(r.regionName),
        String(r.sent),
        loss,
        last, avg, best, worst,
        r.colo || '', r.coloCity || '',
        egress.colo, egress.city,
      ].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `healthcheck-${host}-${port}-${new Date().toISOString().slice(0, 19)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getRegionName = (code: string): string => {
    const regional = REGIONAL_SERVICES.find((r) => r.code === code);
    if (regional) return regional.name;
    const aws = AWS_PLACEMENT.find((r) => r.code === code);
    if (aws) return aws.name;
    const gcp = GCP_PLACEMENT.find((r) => r.code === code);
    if (gcp) return gcp.name;
    const azure = AZURE_PLACEMENT.find((r) => r.code === code);
    if (azure) return azure.name;
    return code;
  };

  const getRegionType = (code: string): 'regional' | 'aws' | 'gcp' | 'azure' => {
    if (REGIONAL_SERVICES.some((r) => r.code === code)) return 'regional';
    if (code.startsWith('aws-')) return 'aws';
    if (code.startsWith('gcp-')) return 'gcp';
    return 'azure';
  };

  // Group boundaries for separator rows
  const groupBoundaries = new Map<number, { label: string; color: string }>();
  let currentGroup = '';
  selectedRegions.forEach((code, index) => {
    const type = getRegionType(code);
    if (type !== currentGroup) {
      currentGroup = type;
      const labels: Record<string, { label: string; color: string }> = {
        regional: { label: 'Cloudflare Regional Services', color: 'border-orange-500/40 bg-orange-500/5 text-orange-300' },
        aws: { label: 'AWS Placement Hints', color: 'border-teal-500/40 bg-teal-500/5 text-teal-300' },
        gcp: { label: 'GCP Placement Hints', color: 'border-blue-500/40 bg-blue-500/5 text-blue-300' },
        azure: { label: 'Azure Placement Hints', color: 'border-sky-500/40 bg-sky-500/5 text-sky-300' },
      };
      groupBoundaries.set(index, labels[type]);
    }
  });

  const runSingleRound = () => {
    selectedRegions.forEach((regionCode, index) => {
      const checkRequest: HealthCheckRequest = {
        host: host.trim(),
        port: parseInt(port),
        timeout: 10000,
        region: regionCode,
      };

      const regionalEndpoint = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? '/api/check'
        : `https://${regionCode}.healthchecks.ross.gg/api/check`;

      fetch(regionalEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkRequest),
      })
        .then(async (response) => {
          const cfPlacement = response.headers.get('cf-placement');
          const data = (await response.json()) as {
            success: boolean;
            latencyMs?: number;
            error?: string;
            colo?: string;
            coloCity?: string;
          };

          setResults((prev) =>
            prev.map((r, i) =>
              i === index
                ? {
                    ...r,
                    sent: r.sent + 1,
                    status: data.success ? 'connected' as const : 'failed' as const,
                    received: data.success ? r.received + 1 : r.received,
                    latencies: data.latencyMs !== undefined ? [...r.latencies, data.latencyMs] : r.latencies,
                    lastError: data.error,
                    colo: data.colo || r.colo,
                    coloCity: data.coloCity || r.coloCity,
                    cfPlacement: cfPlacement || r.cfPlacement,
                  }
                : r
            )
          );
        })
        .catch((error) => {
          setResults((prev) =>
            prev.map((r, i) =>
              i === index
                ? {
                    ...r,
                    sent: r.sent + 1,
                    status: 'failed' as const,
                    lastError: error instanceof Error ? error.message : 'Request failed',
                  }
                : r
            )
          );
        });
    });
  };

  const runTest = () => {
    if (!host || !port) return;

    setIsRunning(true);
    setStartTime(Date.now());

    // Initialize results
    const initialResults: TestResult[] = selectedRegions.map((regionCode) => ({
      region: regionCode,
      regionName: getRegionName(regionCode),
      status: 'pending' as const,
      sent: 0,
      received: 0,
      latencies: [],
    }));
    setResults(initialResults);

    // Run first round immediately
    setTimeout(() => runSingleRound(), 0);

    // Repeat every 5 seconds
    intervalRef.current = setInterval(runSingleRound, 5000);
  };

  const stopTest = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'pending':
        return <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin" />;
      case 'connected':
        return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-3.5 h-3.5 text-red-500" />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="bg-slate-800/50 border-b border-slate-700 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-3 rounded-lg">
              <Handshake className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Handshake Speed</h1>
              <p className="text-slate-400 text-sm">
                Test connectivity across global regions in real-time
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* About / How It Works (collapsible) */}
      <div className="max-w-7xl mx-auto px-4 pt-6">
        <details className="group bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700">
          <summary className="px-6 py-4 cursor-pointer select-none flex items-center justify-between text-sm font-semibold text-slate-300 hover:text-white transition-colors list-none">
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              About This Tool
            </span>
            <svg className="w-4 h-4 text-slate-400 transition-transform group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </summary>
          <div className="px-6 pb-6 border-t border-slate-700 pt-4 space-y-4">
            <p className="text-sm text-slate-300 leading-relaxed">
              This tool performs{' '}
              <a href="https://www.cloudflare.com/learning/network-layer/what-is-a-computer-port/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">TCP pings</a>
              {' '}from <strong className="text-white">143 Cloudflare Worker endpoints</strong> deployed
              across the globe. Each endpoint opens a raw{' '}
              <a href="https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">TCP socket</a>
              {' '}to your target host:port and measures the round-trip latency
              from that location. Unlike ICMP ping, a TCP ping completes the three-way handshake (SYN → SYN-ACK → ACK)
              to verify the port is actually accepting connections. Results show which data center handled the request and how long the connection took.
            </p>

            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Two Placement Strategies</h4>
            <p className="text-sm text-slate-300 leading-relaxed">
              The 143 endpoints use two different Cloudflare mechanisms to control <em>where</em> the Worker executes:
            </p>

            {/* Diagram: Regional Services vs Targeted Placement */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {/* Regional Services */}
              <div className="bg-slate-900/50 rounded-lg border border-orange-500/20 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                  <span className="font-semibold text-orange-300 text-sm">Regional Services</span>
                  <span className="text-slate-500">(10 endpoints)</span>
                </div>
                <p className="text-slate-400">Configured on the <strong className="text-orange-300">DNS record</strong> (no worker config required). Worker is <strong className="text-orange-300">guaranteed</strong> to run inside the target region. Ingress and egress are the same colo.</p>
                <div className="flex items-center justify-center gap-2 py-2">
                  <div className="bg-slate-700 rounded px-2 py-1 text-slate-300">You</div>
                  <span className="text-slate-500">&#8594;</span>
                  <div className="bg-orange-500/20 border border-orange-500/30 rounded px-3 py-2 text-center">
                    <div className="text-orange-300 font-semibold">Edge in Region</div>
                    <div className="text-slate-400 text-[10px]">FRA (<code className="text-orange-300">de</code>)</div>
                    <div className="text-orange-400/60 text-[10px] mt-1">ingress = egress</div>
                  </div>
                  <span className="text-slate-500">&#8594;</span>
                  <div className="bg-slate-700 rounded px-2 py-1 text-slate-300">TCP Test</div>
                </div>
                <div className="text-slate-500 pt-1 border-t border-slate-700">
                  Uses region codes: <code className="bg-slate-800 px-1 rounded text-orange-300">us</code>, <code className="bg-slate-800 px-1 rounded text-orange-300">eu</code>, <code className="bg-slate-800 px-1 rounded text-orange-300">jp</code>, etc.
                </div>
                <a href="https://developers.cloudflare.com/workers/configuration/regions/" target="_blank" rel="noopener noreferrer" className="inline-block mt-1 text-orange-400 hover:text-orange-300 underline">
                  Regional Services Docs &#8599;
                </a>
              </div>

              {/* Targeted Placement */}
              <div className="bg-slate-900/50 rounded-lg border border-teal-500/20 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-teal-500"></span>
                  <span className="font-semibold text-teal-300 text-sm">Region Placement</span>
                  <span className="text-slate-500">(133 endpoints)</span>
                </div>
                <p className="text-slate-400">Configured on the <strong className="text-teal-300">worker</strong>. Request hits your nearest edge, then is <strong className="text-teal-300">forwarded</strong> to a colo near the cloud provider region.</p>
                <div className="flex items-center justify-center gap-2 py-2">
                  <div className="bg-slate-700 rounded px-2 py-1 text-slate-300">You</div>
                  <span className="text-slate-500">&#8594;</span>
                  <div className="bg-slate-700 rounded px-2 py-1 text-center">
                    <div className="text-slate-300">Nearest Edge</div>
                    <div className="text-slate-500 text-[10px]">ingress</div>
                  </div>
                  <span className="text-teal-400">&#10230;</span>
                  <div className="bg-teal-500/20 border border-teal-500/30 rounded px-2 py-2 text-center">
                    <div className="text-teal-300 font-semibold">Cloud Region Colo</div>
                    <div className="text-slate-400 text-[10px]">FRA (<code className="text-teal-300">eu-central-1</code>)</div>
                    <div className="text-slate-500 text-[10px]">egress</div>
                  </div>
                  <span className="text-slate-500">&#8594;</span>
                  <div className="bg-slate-700 rounded px-2 py-1 text-slate-300">TCP Test</div>
                </div>
                <div className="text-slate-500 pt-1 border-t border-slate-700">
                  Uses cloud region codes: <code className="bg-slate-800 px-1 rounded text-teal-300">aws:us-east-1</code>, <code className="bg-slate-800 px-1 rounded text-teal-300">gcp:europe-west1</code>, etc.
                </div>
                <a href="https://developers.cloudflare.com/workers/configuration/smart-placement/" target="_blank" rel="noopener noreferrer" className="inline-block mt-1 text-teal-400 hover:text-teal-300 underline">
                  Placement &#8599;
                </a>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">
              <strong className="text-white">Ingress Colo</strong> is the data center that first received your request.
              <strong className="text-white"> Egress Colo</strong> is where the Worker actually executed and ran the TCP test.
              This is derived from the <code className="bg-slate-800 px-1 rounded text-slate-300">cf-placement</code> response header.
              These will be the same with Regional Services and may differ for Region Placement.
            </p>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-300 leading-relaxed">
              <strong className="text-amber-200">Note:</strong> Connections to targets on Cloudflare's network (AS13335) are blocked for security reasons.
              The test button will be disabled for any target on AS13335.
            </div>

          </div>
        </details>
      </div>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Input Section */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-6 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Server className="w-5 h-5 text-primary" />
            Target Configuration
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Host Input */}
            <div>
              <label htmlFor="host" className="block text-sm font-medium text-slate-300 mb-2">
                Target IP / Hostname
              </label>
              <input
                id="host"
                type="text"
                value={host}
                onChange={(e) => handleHostChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canRun) runTest();
                }}
                placeholder="example.com, 192.168.1.1, or 2001:db8::1"
                className={`w-full px-4 py-2 bg-slate-900/50 border rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-colors ${
                  hostError
                    ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                    : 'border-slate-600 focus:ring-primary focus:border-transparent'
                }`}
              />
              {hostError && (
                <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
                  <XCircle className="w-4 h-4" />
                  {hostError}
                </p>
              )}
              {isValidatingHost && !hostError && (
                <p className="mt-1 text-sm text-slate-400 flex items-center gap-1">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Checking ASN...
                </p>
              )}
            </div>

            {/* Port Input */}
            <div>
              <label htmlFor="port" className="block text-sm font-medium text-slate-300 mb-2" title="Only TCP port testing is supported — UDP is not available via Cloudflare Workers Sockets API">
                TCP Port Number
              </label>
              <input
                id="port"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={port}
                onChange={(e) => handlePortChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canRun) runTest();
                }}
                placeholder="1-65535"
                className={`w-full px-4 py-2 bg-slate-900/50 border rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-colors ${
                  portError
                    ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                    : 'border-slate-600 focus:ring-primary focus:border-transparent'
                }`}
              />
              {portError && (
                <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
                  <XCircle className="w-4 h-4" />
                  {portError}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mb-6">
          {isRunning ? (
            <button
              onClick={stopTest}
              className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
            >
              <Square className="w-4 h-4" />
              Stop
            </button>
          ) : (
            <button
              onClick={runTest}
              disabled={!canRun}
              className="flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary-dark disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
            >
              <Play className="w-5 h-5" />
              Run Connection Tests
            </button>
          )}

          {results.length > 0 && (
            <>
              <button
                onClick={downloadCsv}
                className="flex items-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
              >
                <Download className="w-5 h-5" />
                Download CSV
              </button>
              <button
                onClick={() => { stopTest(); clearResults(); }}
                className="flex items-center gap-2 px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white font-semibold rounded-lg transition-colors"
              >
                <Trash2 className="w-5 h-5" />
                Clear Results
              </button>
            </>
          )}
        </div>

        {/* Results Dashboard */}
        {results.length > 0 && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-700 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <Wifi className="w-4 h-4 text-primary" />
                {host}:{port}
                {isRunning && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
              </h2>
              <div className="text-xs text-slate-400">
                {startTime && <>Started {new Date(startTime).toISOString().replace('T', ' ').slice(0, 19)} UTC</>}
              </div>
            </div>

            {/* Results Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/50 text-xs">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-medium text-slate-400 uppercase tracking-wider">Region</th>
                    <th className="px-3 py-1.5 text-right font-medium text-slate-400 uppercase tracking-wider w-14">Sent</th>
                    <th className="px-3 py-1.5 text-right font-medium text-slate-400 uppercase tracking-wider w-16">Loss%</th>
                    <th className="px-3 py-1.5 text-right font-medium text-slate-400 uppercase tracking-wider w-16">Last</th>
                    <th className="px-3 py-1.5 text-right font-medium text-slate-400 uppercase tracking-wider w-16">Avg</th>
                    <th className="px-3 py-1.5 text-right font-medium text-slate-400 uppercase tracking-wider w-16">Best</th>
                    <th className="px-3 py-1.5 text-right font-medium text-slate-400 uppercase tracking-wider w-16">Worst</th>
                    <th className="px-3 py-1.5 text-left font-medium text-slate-400 uppercase tracking-wider">Ingress</th>
                    <th className="px-3 py-1.5 text-left font-medium text-slate-400 uppercase tracking-wider">Egress</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50 font-mono">
                  {(() => {
                    let groupRowIndex = 0;
                    let prevType = '';
                    return results.map((result, index) => {
                    const group = groupBoundaries.get(index);
                    const regionType = getRegionType(result.region);
                    if (regionType !== prevType) {
                      groupRowIndex = 0;
                      prevType = regionType;
                    }
                    const isEvenRow = groupRowIndex % 2 === 0;
                    groupRowIndex++;
                    const rowAccent = {
                      regional: 'border-l-2 border-l-orange-500/30',
                      aws: 'border-l-2 border-l-teal-500/30',
                      gcp: 'border-l-2 border-l-blue-500/30',
                      azure: 'border-l-2 border-l-sky-500/30',
                    }[regionType];
                    const stripeBg = isEvenRow ? '' : 'bg-slate-800/30';

                    const loss = result.sent > 0 ? (result.sent - result.received) / result.sent * 100 : 0;
                    const last = result.latencies.length > 0 ? result.latencies[result.latencies.length - 1] : null;
                    const avg = result.latencies.length > 0 ? Math.round(result.latencies.reduce((a, b) => a + b, 0) / result.latencies.length) : null;
                    const best = result.latencies.length > 0 ? Math.min(...result.latencies) : null;
                    const worst = result.latencies.length > 0 ? Math.max(...result.latencies) : null;
                    const egress = getEgressColo(result);

                    return (<>
                    {group && (
                      <tr key={`group-${index}`}>
                        <td colSpan={9} className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border-l-2 ${group.color}`}>
                          {group.label}
                        </td>
                      </tr>
                    )}
                    <tr
                      key={index}
                      className={`hover:bg-slate-700/30 ${rowAccent} ${stripeBg}`}
                    >
                      <td className="px-3 py-1.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {getStatusIcon(result.status)}
                          <span className="font-sans text-white">
                            {result.regionName}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-right text-slate-300">
                        {result.sent || '-'}
                      </td>
                      <td className={`px-3 py-1.5 text-right ${loss === 0 ? 'text-green-400' : loss < 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {result.sent > 0 ? `${loss.toFixed(0)}%` : '-'}
                      </td>
                      <td className="px-3 py-1.5 text-right text-slate-300">
                        {last !== null ? last : '-'}
                      </td>
                      <td className="px-3 py-1.5 text-right text-slate-300">
                        {avg !== null ? avg : '-'}
                      </td>
                      <td className="px-3 py-1.5 text-right text-green-400">
                        {best !== null ? best : '-'}
                      </td>
                      <td className="px-3 py-1.5 text-right text-red-400">
                        {worst !== null ? worst : '-'}
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-slate-300">
                        {result.colo
                          ? <><span>{result.colo}</span><span className="text-slate-500"> ({result.coloCity || '?'})</span></>
                          : '-'}
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-slate-300">
                        {egress.colo
                          ? <><span>{egress.colo}</span><span className="text-slate-500"> ({egress.city || '?'})</span></>
                          : '-'}
                      </td>
                    </tr>
                    </>);
                  });
                  })()}
                </tbody>
              </table>
            </div>

            {/* Summary Stats */}
            <div className="px-4 py-2 bg-slate-900/30 border-t border-slate-700">
              <div className="flex gap-6 text-xs">
                <span className="text-slate-400">Regions: <span className="text-white font-semibold">{results.length}</span></span>
                <span className="text-slate-400">Connected: <span className="text-green-400 font-semibold">{results.filter((r) => r.status === 'connected').length}</span></span>
                <span className="text-slate-400">Failed: <span className="text-red-400 font-semibold">{results.filter((r) => r.status === 'failed').length}</span></span>
                <span className="text-slate-400">Pending: <span className="text-slate-300 font-semibold">{results.filter((r) => r.status === 'pending').length}</span></span>
                {results.some(r => r.latencies.length > 0) && (
                  <span className="text-slate-400">Avg: <span className="text-primary font-semibold">
                    {Math.round(results.filter(r => r.latencies.length > 0).reduce((sum, r) => sum + r.latencies.reduce((a, b) => a + b, 0) / r.latencies.length, 0) / results.filter(r => r.latencies.length > 0).length)}ms
                  </span></span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {results.length === 0 && (
          <div className="bg-slate-800/30 backdrop-blur-sm rounded-xl border border-slate-700 p-12 text-center">
            <WifiOff className="w-16 h-16 text-slate-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-slate-300 mb-2">No Test Results Yet</h3>
            <p className="text-slate-500">
              Configure your target and select regions to start testing connectivity
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-700 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <p className="text-center text-sm text-slate-500">
            Powered by Cloudflare Workers Sockets API •{' '}
            <a
              href="https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:text-primary-dark transition-colors"
            >
              Documentation
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
