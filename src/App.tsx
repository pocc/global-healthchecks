import { useState, useEffect, useRef } from 'react';
import {
  Handshake,
  Network,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  Play,
  Square,
  Download,
  Shield,
  ChevronDown,
  Globe,
  Volume2,
  VolumeX,
  AlertTriangle,
} from 'lucide-react';
import { COLO_TO_CITY } from './coloMapping';
import WorldMap from './WorldMap';

interface HealthCheckRequest {
  host: string;
  port: number;
  timeout?: number;
  connectTimeout?: number; // TCP connect timeout (ms)
  idleTimeout?: number; // socket idle timeout (ms)
  keepAlive?: boolean; // enable TCP keep-alive
  keepAliveInitialDelay?: number; // keep-alive initial delay (ms)
  retries?: number; // number of retry attempts
  retryBackoff?: boolean; // use exponential backoff
  region?: string;
  tlsEnabled?: boolean;
  tlsServername?: string;
  minTlsVersion?: string;
  maxTlsVersion?: string;
  ciphers?: string;
  clientCert?: string;
  clientKey?: string;
  caBundlePem?: string;
  ocspStapling?: boolean;
  pinnedPublicKey?: string;
  httpEnabled?: boolean;
  httpMethod?: string;
  httpPath?: string;
  httpHeaders?: Record<string, string>;
  followRedirects?: boolean;
  maxRedirects?: number;
}

interface TestResult {
  region: string;
  regionName: string;
  status: 'pending' | 'connected' | 'failed';
  sent: number;
  received: number;
  latencies: number[];
  pingHistory: Array<{ ms: number | null; ts: number }>;
  lastError?: string;
  colo?: string;
  coloCity?: string;
  cfPlacement?: string;
  tcpMs?: number;
  tlsVersion?: string;
  tlsCipher?: string;
  tlsHandshakeMs?: number;
  httpStatusCode?: number;
  httpStatusText?: string;
  httpVersion?: string;
  httpMs?: number;
}

type TlsVersion = '' | 'TLSv1' | 'TLSv1.1' | 'TLSv1.2' | 'TLSv1.3';

const TLS_VERSIONS: { value: TlsVersion; label: string }[] = [
  { value: '', label: 'Auto' },
  { value: 'TLSv1', label: 'TLS 1.0' },
  { value: 'TLSv1.1', label: 'TLS 1.1' },
  { value: 'TLSv1.2', label: 'TLS 1.2' },
  { value: 'TLSv1.3', label: 'TLS 1.3' },
];

// TLS version ordering for range comparisons
const TLS_VER_ORDER: Record<string, number> = { 'TLSv1': 1, 'TLSv1.1': 2, 'TLSv1.2': 3, 'TLSv1.3': 4 };

// Well-known TCP port to protocol name mapping (sourced from Wikipedia)
const WELL_KNOWN_PORTS: Record<number, string> = {
  // Well-known ports (0-1023)
  1: 'TCPMUX', 7: 'Echo', 9: 'Discard', 11: 'Systat', 13: 'Daytime',
  17: 'QOTD', 19: 'CHARGEN', 20: 'FTP Data', 21: 'FTP Control',
  22: 'SSH', 23: 'Telnet', 25: 'SMTP', 37: 'Time', 43: 'WHOIS',
  49: 'TACACS+', 53: 'DNS', 70: 'Gopher', 79: 'Finger', 80: 'HTTP',
  88: 'Kerberos', 95: 'SUPDUP', 101: 'NIC Hostname', 102: 'ISO TSAP',
  104: 'DICOM', 107: 'RTelnet', 109: 'POP2', 110: 'POP3', 111: 'ONC RPC',
  113: 'Ident', 115: 'SFTP (Simple)', 119: 'NNTP', 135: 'MS EPMAP',
  137: 'NetBIOS NS', 139: 'NetBIOS Session', 143: 'IMAP', 161: 'SNMP',
  162: 'SNMP Trap', 179: 'BGP', 194: 'IRC', 199: 'SMUX',
  389: 'LDAP', 427: 'SLP', 443: 'HTTPS', 444: 'SNPP', 445: 'SMB',
  464: 'Kerberos Passwd', 465: 'SMTPS', 502: 'Modbus', 504: 'Citadel',
  515: 'LPD', 530: 'RPC', 540: 'UUCP', 543: 'Kerberos Login',
  548: 'AFP', 554: 'RTSP', 563: 'NNTPS', 587: 'SMTP Submission',
  593: 'HTTP RPC', 601: 'Reliable Syslog', 631: 'CUPS', 636: 'LDAPS',
  639: 'MSDP', 646: 'LDP', 655: 'Tinc VPN', 674: 'ACAP',
  691: 'MS Exchange Routing', 700: 'EPP', 749: 'Kerberos Admin',
  808: 'MS Net.TCP', 830: 'NETCONF SSH', 853: 'DNS over TLS',
  860: 'iSCSI', 873: 'rsync', 902: 'VMware ESXi', 953: 'BIND RNDC',
  989: 'FTPS Data', 990: 'FTPS Control', 992: 'Telnet over TLS',
  993: 'IMAPS', 995: 'POP3S',
  // Registered ports (1024-49151) — commonly used
  1080: 'SOCKS Proxy', 1099: 'Java RMI', 1194: 'OpenVPN',
  1433: 'MS SQL', 1434: 'MS SQL Monitor', 1494: 'Citrix ICA',
  1521: 'Oracle DB', 1527: 'Apache Derby', 1666: 'Perforce',
  1688: 'MS KMS', 1720: 'H.323', 1723: 'PPTP', 1812: 'RADIUS Auth',
  1813: 'RADIUS Acct', 1883: 'MQTT', 1935: 'RTMP', 1965: 'Gemini',
  2000: 'Cisco SCCP', 2049: 'NFS', 2082: 'cPanel', 2083: 'cPanel TLS',
  2181: 'ZooKeeper', 2375: 'Docker', 2376: 'Docker TLS',
  2377: 'Docker Swarm', 2380: 'etcd', 2483: 'Oracle DB',
  2484: 'Oracle DB TLS', 3000: 'Grafana / Node Dev', 3050: 'Firebird DB',
  3128: 'Squid Proxy', 3260: 'iSCSI', 3268: 'MS Global Catalog',
  3269: 'MS Global Catalog TLS', 3306: 'MySQL', 3389: 'RDP',
  3478: 'STUN', 3690: 'SVN', 3868: 'Diameter',
  4222: 'NATS', 4443: 'Pharos', 4505: 'Salt Master (Pub)',
  4506: 'Salt Master (Req)', 4840: 'OPC UA', 4848: 'GlassFish Admin',
  5000: 'UPnP / Flask Dev', 5004: 'RTP', 5044: 'Logstash / Beats',
  5060: 'SIP', 5061: 'SIP TLS', 5173: 'Vite Dev', 5201: 'iPerf3',
  5222: 'XMPP Client', 5269: 'XMPP Server', 5432: 'PostgreSQL',
  5601: 'Kibana', 5666: 'Nagios NRPE', 5671: 'AMQP TLS', 5672: 'AMQP',
  5900: 'VNC', 5938: 'TeamViewer', 5984: 'CouchDB',
  5985: 'WinRM HTTP', 5986: 'WinRM HTTPS', 6000: 'X11', 6379: 'Redis',
  6432: 'PgBouncer', 6443: 'Kubernetes API', 6513: 'NETCONF TLS',
  6514: 'Syslog TLS', 6660: 'IRC (Alt)', 6697: 'IRC TLS',
  6881: 'BitTorrent', 7001: 'WebLogic', 7474: 'Neo4j',
  7687: 'Neo4j Bolt', 8000: 'HTTP Alt / Dev', 8008: 'HTTP Alt',
  8009: 'Apache JServ (AJP)', 8080: 'HTTP Proxy / Alt',
  8088: 'Asterisk Admin', 8089: 'Splunk Mgmt', 8118: 'Privoxy',
  8140: 'Puppet Master', 8333: 'Bitcoin', 8384: 'Syncthing',
  8388: 'Shadowsocks', 8443: 'HTTPS Alt', 8448: 'Matrix Federation',
  8500: 'ColdFusion / Consul', 8728: 'MikroTik API',
  8729: 'MikroTik API TLS', 8787: 'Cloudflare Workers Dev',
  8883: 'MQTT TLS', 8888: 'HTTP Alt / Dev', 8983: 'Apache Solr',
  9000: 'SonarQube', 9001: 'Tor ORPort', 9042: 'Cassandra',
  9050: 'Tor SOCKS', 9090: 'Cockpit / Prometheus', 9092: 'Kafka',
  9100: 'Printer (JetDirect)', 9200: 'Elasticsearch',
  9229: 'Node.js Debug', 9300: 'Elasticsearch Transport',
  9418: 'Git', 9443: 'VMware vCenter',
  10000: 'NDMP / Webmin', 10050: 'Zabbix Agent', 10051: 'Zabbix Server',
  11211: 'Memcached', 11434: 'Ollama', 15672: 'RabbitMQ Mgmt',
  25565: 'Minecraft', 27017: 'MongoDB', 32400: 'Plex',
};

// ── DNS-over-HTTPS helpers ──
// Known DoH providers that support the JSON API (?name=X&type=Y with Accept: application/dns-json)
const JSON_DOH_HOSTS = new Set(['cloudflare-dns.com', 'dns.google']);
function isJsonDohProvider(url: string): boolean {
  try { return JSON_DOH_HOSTS.has(new URL(url).hostname); }
  catch { return false; }
}

// Build a minimal DNS wire-format query (RFC 1035 §4.1)
function buildDnsWireQuery(name: string, qtype: number): Uint8Array {
  const header = new Uint8Array(12);
  crypto.getRandomValues(header.subarray(0, 2)); // random ID
  header[2] = 0x01; // RD (recursion desired)
  header[5] = 0x01; // QDCOUNT = 1
  const q: number[] = [];
  for (const label of name.split('.')) {
    q.push(label.length);
    for (let i = 0; i < label.length; i++) q.push(label.charCodeAt(i));
  }
  q.push(0, (qtype >> 8) & 0xff, qtype & 0xff, 0, 1); // root + QTYPE + QCLASS=IN
  const msg = new Uint8Array(12 + q.length);
  msg.set(header);
  msg.set(q, 12);
  return msg;
}

// Parse A/AAAA records from a DNS wire-format response
function parseDnsWireResponse(buf: ArrayBuffer, qtype: number): string | null {
  const d = new Uint8Array(buf);
  if (d.length < 12) return null;
  let off = 12;
  // Skip question section
  const qdcount = (d[4] << 8) | d[5];
  for (let i = 0; i < qdcount; i++) {
    while (off < d.length) {
      if (d[off] === 0) { off++; break; }
      if ((d[off] & 0xc0) === 0xc0) { off += 2; break; }
      off += d[off] + 1;
    }
    off += 4; // QTYPE + QCLASS
  }
  // Parse answer section
  const ancount = (d[6] << 8) | d[7];
  for (let i = 0; i < ancount; i++) {
    while (off < d.length) {
      if (d[off] === 0) { off++; break; }
      if ((d[off] & 0xc0) === 0xc0) { off += 2; break; }
      off += d[off] + 1;
    }
    const rtype = (d[off] << 8) | d[off + 1];
    off += 8; // TYPE(2) + CLASS(2) + TTL(4)
    const rdlen = (d[off] << 8) | d[off + 1];
    off += 2;
    if (rtype === qtype) {
      if (rtype === 1 && rdlen === 4) {
        return `${d[off]}.${d[off + 1]}.${d[off + 2]}.${d[off + 3]}`;
      }
      if (rtype === 28 && rdlen === 16) {
        const parts: string[] = [];
        for (let j = 0; j < 16; j += 2)
          parts.push(((d[off + j] << 8) | d[off + j + 1]).toString(16));
        // Compress longest run of zero groups
        let bs = -1, bl = 0, cs = -1, cl = 0;
        parts.forEach((p, idx) => {
          if (p === '0') { if (cs < 0) cs = idx; cl++; if (cl > bl) { bs = cs; bl = cl; } }
          else { cs = -1; cl = 0; }
        });
        if (bl >= 2) {
          const before = parts.slice(0, bs).join(':');
          const after = parts.slice(bs + bl).join(':');
          return (before || '') + '::' + (after || '');
        }
        return parts.join(':');
      }
    }
    off += rdlen;
  }
  return null;
}

// Unified DoH resolver: JSON API for Cloudflare/Google, RFC 8484 wire format for others
async function dohResolve(
  provider: string, name: string, rrType: 'A' | 'AAAA', signal: AbortSignal,
): Promise<string | null> {
  const typeNum = rrType === 'AAAA' ? 28 : 1;
  if (isJsonDohProvider(provider)) {
    const res = await fetch(
      `${provider}?name=${encodeURIComponent(name)}&type=${rrType}`,
      { signal, headers: { Accept: 'application/dns-json' } },
    );
    const data: { Answer?: { type: number; data: string }[] } = await res.json();
    return data.Answer?.find(a => a.type === typeNum)?.data ?? null;
  }
  // RFC 8484 wire format (GET with ?dns= to avoid CORS preflight)
  const query = buildDnsWireQuery(name, typeNum);
  const b64 = btoa(String.fromCharCode(...query)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const sep = provider.includes('?') ? '&' : '?';
  const res = await fetch(
    `${provider}${sep}dns=${b64}`,
    { signal, headers: { Accept: 'application/dns-message' } },
  );
  const buf = await res.arrayBuffer();
  return parseDnsWireResponse(buf, typeNum);
}

// NS lookup always uses Google JSON API (wire-format NS parsing requires name decompression)
const NS_DOH = 'https://dns.google/resolve';

// Complete list of OpenSSL TLS cipher suites with version compatibility
// minVer/maxVer use TLS_VER_ORDER: TLSv1=1, TLSv1.1=2, TLSv1.2=3, TLSv1.3=4
const TLS_CIPHERS: { name: string; group: string; minVer: number; maxVer: number }[] = [
  // TLS 1.3 Only -exclusive cipher suites, not interchangeable with 1.2
  { name: 'TLS_AES_128_GCM_SHA256', group: 'TLS 1.3 Only', minVer: 4, maxVer: 4 },
  { name: 'TLS_AES_256_GCM_SHA384', group: 'TLS 1.3 Only', minVer: 4, maxVer: 4 },
  { name: 'TLS_CHACHA20_POLY1305_SHA256', group: 'TLS 1.3 Only', minVer: 4, maxVer: 4 },
  // ECDHE + AEAD (TLS 1.2 only -PFS + authenticated encryption)
  { name: 'ECDHE-ECDSA-AES128-GCM-SHA256', group: 'ECDHE + AEAD', minVer: 3, maxVer: 3 },
  { name: 'ECDHE-RSA-AES128-GCM-SHA256', group: 'ECDHE + AEAD', minVer: 3, maxVer: 3 },
  { name: 'ECDHE-ECDSA-AES256-GCM-SHA384', group: 'ECDHE + AEAD', minVer: 3, maxVer: 3 },
  { name: 'ECDHE-RSA-AES256-GCM-SHA384', group: 'ECDHE + AEAD', minVer: 3, maxVer: 3 },
  { name: 'ECDHE-ECDSA-CHACHA20-POLY1305', group: 'ECDHE + AEAD', minVer: 3, maxVer: 3 },
  { name: 'ECDHE-RSA-CHACHA20-POLY1305', group: 'ECDHE + AEAD', minVer: 3, maxVer: 3 },
  // DHE + AEAD (TLS 1.2 only -PFS + authenticated encryption)
  { name: 'DHE-RSA-AES128-GCM-SHA256', group: 'DHE + AEAD', minVer: 3, maxVer: 3 },
  { name: 'DHE-RSA-AES256-GCM-SHA384', group: 'DHE + AEAD', minVer: 3, maxVer: 3 },
  { name: 'DHE-RSA-CHACHA20-POLY1305', group: 'DHE + AEAD', minVer: 3, maxVer: 3 },
  // ECDHE + CBC with SHA-2 PRF (TLS 1.2 only)
  { name: 'ECDHE-ECDSA-AES128-SHA256', group: 'ECDHE + CBC', minVer: 3, maxVer: 3 },
  { name: 'ECDHE-RSA-AES128-SHA256', group: 'ECDHE + CBC', minVer: 3, maxVer: 3 },
  { name: 'ECDHE-ECDSA-AES256-SHA384', group: 'ECDHE + CBC', minVer: 3, maxVer: 3 },
  { name: 'ECDHE-RSA-AES256-SHA384', group: 'ECDHE + CBC', minVer: 3, maxVer: 3 },
  // Legacy ECDHE -SHA-1 (TLS 1.0–1.2)
  { name: 'ECDHE-ECDSA-AES128-SHA', group: 'Legacy ECDHE', minVer: 1, maxVer: 3 },
  { name: 'ECDHE-RSA-AES128-SHA', group: 'Legacy ECDHE', minVer: 1, maxVer: 3 },
  { name: 'ECDHE-ECDSA-AES256-SHA', group: 'Legacy ECDHE', minVer: 1, maxVer: 3 },
  { name: 'ECDHE-RSA-AES256-SHA', group: 'Legacy ECDHE', minVer: 1, maxVer: 3 },
  // Legacy DHE -SHA-2 are TLS 1.2 only, SHA-1 are TLS 1.0–1.2
  { name: 'DHE-RSA-AES128-SHA256', group: 'Legacy DHE', minVer: 3, maxVer: 3 },
  { name: 'DHE-RSA-AES256-SHA256', group: 'Legacy DHE', minVer: 3, maxVer: 3 },
  { name: 'DHE-RSA-AES128-SHA', group: 'Legacy DHE', minVer: 1, maxVer: 3 },
  { name: 'DHE-RSA-AES256-SHA', group: 'Legacy DHE', minVer: 1, maxVer: 3 },
  // RSA (No PFS) -static RSA key exchange, TLS 1.2 only
  { name: 'AES128-GCM-SHA256', group: 'RSA (No PFS)', minVer: 3, maxVer: 3 },
  { name: 'AES256-GCM-SHA384', group: 'RSA (No PFS)', minVer: 3, maxVer: 3 },
  { name: 'AES128-SHA256', group: 'RSA (No PFS)', minVer: 3, maxVer: 3 },
  { name: 'AES256-SHA256', group: 'RSA (No PFS)', minVer: 3, maxVer: 3 },
  // Legacy RSA -static RSA, SHA-1 (TLS 1.0–1.2)
  { name: 'AES128-SHA', group: 'Legacy RSA', minVer: 1, maxVer: 3 },
  { name: 'AES256-SHA', group: 'Legacy RSA', minVer: 1, maxVer: 3 },
  // Insecure -3DES, vulnerable to Sweet32 (TLS 1.0–1.2)
  { name: 'DES-CBC3-SHA', group: 'Insecure', minVer: 1, maxVer: 3 },
];

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

// Continent mapping for region filtering
type Continent = 'North America' | 'South America' | 'Europe' | 'Asia Pacific' | 'Middle East' | 'Africa' | 'Oceania';
const CONTINENTS: Continent[] = ['North America', 'Europe', 'Asia Pacific', 'Oceania', 'Middle East', 'South America', 'Africa'];

// Flag emoji → country name mapping (derived from provider region data)
const FLAG_TO_COUNTRY: Record<string, string> = {
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

const REGION_TO_COUNTRY: Record<string, string> = Object.fromEntries(
  [...REGIONAL_SERVICES, ...AWS_PLACEMENT, ...GCP_PLACEMENT, ...AZURE_PLACEMENT]
    .map(r => [r.code, FLAG_TO_COUNTRY[r.flag] || r.flag])
);

function getCountry(code: string): string {
  return REGION_TO_COUNTRY[code] || 'Unknown';
}

function getContinent(code: string): Continent {
  // Cloudflare Regional Services
  if (code === 'us' || code === 'ca') return 'North America';
  if (code === 'eu' || code === 'isoeu' || code === 'de') return 'Europe';
  if (code === 'jp' || code === 'kr' || code === 'sg' || code === 'in') return 'Asia Pacific';
  if (code === 'au') return 'Oceania';

  // Strip provider prefix for pattern matching
  const geo = code.replace(/^(aws|gcp|azure)-/, '');

  // North America
  if (/^(us|ca|northamerica|centralus|eastus|westus|northcentralus|southcentralus|westcentralus|mexicocentral|mx)/.test(geo)) return 'North America';
  // South America
  if (/^(sa-|southamerica|brazil|chile)/.test(geo)) return 'South America';
  // Europe
  if (/^(eu-|europe|uk|france|germany|german|italy|spain|sweden|switzerland|norway|poland|denmark|belgium|austria|northeurope|westeurope)/.test(geo)) return 'Europe';
  // Africa
  if (/^(af-|africa|southafrica)/.test(geo)) return 'Africa';
  // Middle East
  if (/^(me-|il-|israel|qatar|uae)/.test(geo)) return 'Middle East';
  // Oceania
  if (/^(australia|newzealand)/.test(geo)) return 'Oceania';
  // Asia Pacific (catch-all for ap-*, asia-*, japan*, korea*, india*, southeast*, eastasia, malaysia, indonesia)
  if (/^(ap-|asia|japan|korea|india|southindia|centralindia|westindia|southeast|eastasia|malaysia|indonesia)/.test(geo)) return 'Asia Pacific';

  return 'Asia Pacific'; // fallback
}

const CLOUDFLARE_ASN = '13335';

// ASN cache -localStorage-backed with 7-day TTL
const ASN_CACHE_KEY = 'asn-cache';
const ASN_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

function getAsnCache(): Record<string, { asn: string; name?: string; ts: number }> {
  try {
    return JSON.parse(localStorage.getItem(ASN_CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

function getCachedAsn(ip: string): { asn: string; name?: string } | null {
  const cache = getAsnCache();
  const entry = cache[ip];
  if (entry && Date.now() - entry.ts < ASN_CACHE_TTL) return { asn: entry.asn, name: entry.name };
  return null;
}

function setCachedAsn(ip: string, asn: string, name?: string): void {
  const cache = getAsnCache();
  cache[ip] = { asn, name, ts: Date.now() };
  // Prune expired entries while we're at it
  for (const key of Object.keys(cache)) {
    if (Date.now() - cache[key].ts >= ASN_CACHE_TTL) delete cache[key];
  }
  try { localStorage.setItem(ASN_CACHE_KEY, JSON.stringify(cache)); } catch { /* quota */ }
}

function App() {
  const params = new URLSearchParams(window.location.search);
  const hasUrlHostname = !!params.get('hostname');
  const [host, setHost] = useState(params.get('hostname') || 'globo.com');
  const [port, setPort] = useState(params.get('port') || '443');
  const [hostError, setHostError] = useState('');
  const [portError, setPortError] = useState('');
  const [resolvedIp, setResolvedIp] = useState('');
  const [dnsError, setDnsError] = useState('');
  const [dnsWarning, setDnsWarning] = useState('');
  const [resolvedAsn, setResolvedAsn] = useState('');
  const [resolvedAsnName, setResolvedAsnName] = useState('');
  const [authNs, setAuthNs] = useState<string[]>([]);
  const [hostTouched, setHostTouched] = useState(hasUrlHostname);

  // Detect whether the host input is a hostname (not an IP)
  const ipv4Re = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const ipv6Re = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|::([fF]{4}(:0{1,4})?:)?((25[0-5]|(2[0-4]|1?[0-9])?[0-9])\.){3}(25[0-5]|(2[0-4]|1?[0-9])?[0-9]))$/;
  const trimmedHost = host.trim();
  const isHostnameInput = trimmedHost.length > 0 && !ipv4Re.test(trimmedHost) && !ipv6Re.test(trimmedHost);
  const selectedRegions = [
    ...REGIONAL_SERVICES.map((r) => r.code),
    ...AWS_PLACEMENT.map((r) => r.code),
    ...GCP_PLACEMENT.map((r) => r.code),
    ...AZURE_PLACEMENT.map((r) => r.code)
  ];
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  // TCP Only / Full Stack mode
  const [layer, setLayer] = useState<'l4' | 'l7'>((params.get('layer') as 'l4' | 'l7') || 'l4');

  // L4 TCP options
  const [connectTimeout, setConnectTimeout] = useState(params.get('connectTimeout') || '5000');
  const [totalTimeout, setTotalTimeout] = useState(params.get('totalTimeout') || '10000');
  const [idleTimeout, setIdleTimeout] = useState(params.get('idleTimeout') || '');
  const [tcpKeepAlive, setTcpKeepAlive] = useState(params.get('keepAlive') === '1');
  const [keepAliveDelay, setKeepAliveDelay] = useState(params.get('keepAliveDelay') || '1000');
  const [retryCount, setRetryCount] = useState(params.get('retries') || '0');
  const [retryBackoff, setRetryBackoff] = useState(params.get('backoff') === '1');
  const [tcpAdvancedOpen, setTcpAdvancedOpen] = useState(
    !!params.get('connectTimeout') || !!params.get('idleTimeout') || params.get('keepAlive') === '1' || (parseInt(params.get('retries') || '0') > 0)
  );

  // About modal
  const [aboutOpen, setAboutOpen] = useState(false);
  const [speedSlider, setSpeedSlider] = useState(50); // 0-100 log scale → 1x-100x
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [speedPanelOpen, setSpeedPanelOpen] = useState(false);
  const speedMultiplier = Math.pow(100, speedSlider / 100); // 1x at 0, 10x at 50, 100x at 100
  const [continentFilter, setContinentFilter] = useState<Continent | null>(null);
  const [countryFilter, setCountryFilter] = useState<string | null>(null);

  // TLS options (Layer 7 only)
  const [tlsServername, setTlsServername] = useState(params.get('sni') || host.trim());
  const [minTlsVersion, setMinTlsVersion] = useState<TlsVersion>((params.get('minTls') as TlsVersion) || '');
  const [maxTlsVersion, setMaxTlsVersion] = useState<TlsVersion>((params.get('maxTls') as TlsVersion) || '');
  const [selectedCiphers, setSelectedCiphers] = useState<Set<string>>(() => {
    const c = params.get('ciphers');
    return c ? new Set(c.split(',')) : new Set();
  });
  const [ciphersOpen, setCiphersOpen] = useState(true);
  const [cipherFilter, setCipherFilter] = useState('');

  // TLS Advanced options
  const [tlsAdvancedOpen, setTlsAdvancedOpen] = useState(
    !!params.get('ciphers') || !!params.get('ocsp') || !!params.get('pin')
  );
  const [clientCert, setClientCert] = useState('');
  const [clientKey, setClientKey] = useState('');
  const [caBundlePem, setCaBundlePem] = useState('');
  const [ocspStapling, setOcspStapling] = useState(params.get('ocsp') === '1');
  const [pinnedPublicKey, setPinnedPublicKey] = useState(params.get('pin') || '');

  // Filter ciphers to only those compatible with the selected TLS version range
  const userMin = minTlsVersion ? TLS_VER_ORDER[minTlsVersion] : 1;
  const userMax = maxTlsVersion ? TLS_VER_ORDER[maxTlsVersion] : 4;
  const availableCiphers = TLS_CIPHERS.filter(c => c.maxVer >= userMin && c.minVer <= userMax);

  // Clear out-of-range cipher selections when version changes
  useEffect(() => {
    if (selectedCiphers.size === 0) return;
    const validNames = new Set(availableCiphers.map(c => c.name));
    const filtered = new Set([...selectedCiphers].filter(name => validNames.has(name)));
    if (filtered.size !== selectedCiphers.size) {
      setSelectedCiphers(filtered.size === availableCiphers.length ? new Set() : filtered);
    }
  }, [minTlsVersion, maxTlsVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // DNS options (Full Stack mode)
  const [dohProvider, setDohProvider] = useState(params.get('doh') || 'https://cloudflare-dns.com/dns-query');
  const [dnsRecordType, setDnsRecordType] = useState<'A' | 'AAAA'>((params.get('dns') as 'A' | 'AAAA') || 'A');

  // HTTP options -always active in Full Stack mode
  const [httpMethod, setHttpMethod] = useState(params.get('method') || 'HEAD');
  const [customHttpMethod, setCustomHttpMethod] = useState('PROPFIND');
  const [httpPath, setHttpPath] = useState(params.get('path') || '/');
  const [expectedStatus, setExpectedStatus] = useState(params.get('expect') || '200');
  const [httpHeadersRaw, setHttpHeadersRaw] = useState(() => {
    const h = params.get('headers');
    return h ? atob(h) : 'User-Agent: Mozilla/5.0\nAccept: text/html';
  });
  const [httpAdvancedOpen, setHttpAdvancedOpen] = useState(
    params.get('redirects') === '1' || params.get('auth') === 'basic'
  );
  const [followRedirects, setFollowRedirects] = useState(params.get('redirects') === '1');
  const [maxRedirects, setMaxRedirects] = useState(params.get('maxRedirects') || '5');
  const [httpAuthType, setHttpAuthType] = useState<'none' | 'basic'>((params.get('auth') as 'none' | 'basic') || 'none');
  const [httpAuthUser, setHttpAuthUser] = useState(params.get('user') || '');
  const [httpAuthPass, setHttpAuthPass] = useState('');

  const [isValidatingHost, setIsValidatingHost] = useState(false);
  const dnsAbortRef = useRef<AbortController | null>(null);
  const lastAsnHostRef = useRef('');
  const lastNsHostRef = useRef('');
  const dnsCacheRef = useRef<Map<string, string>>(new Map()); // "host|type|provider" → resolved IP
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [homeLocation, setHomeLocation] = useState<{ lat: number; lng: number; city?: string; country?: string; colo?: string } | null>(null);
  const [targetLocation, setTargetLocation] = useState<{ lat: number; lng: number; city?: string; country?: string } | null>(null);

  // API secret for authenticated requests
  const apiSecret = import.meta.env.VITE_API_SECRET || '';

  // Fetch user's geolocation from Cloudflare edge on mount
  useEffect(() => {
    const geoUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? '/api/geo'
      : 'https://healthchecks.ross.gg/api/geo';
    fetch(geoUrl)
      .then(res => {
        if (!res.ok) throw new Error(`geo fetch failed: ${res.status}`);
        return res.json() as Promise<{ lat: number | null; lng: number | null; city?: string; country?: string; colo?: string }>;
      })
      .then((data) => {
        if (data.lat != null && data.lng != null) {
          setHomeLocation({ lat: data.lat, lng: data.lng, city: data.city || undefined, country: data.country || undefined, colo: data.colo || undefined });
        }
      })
      .catch(() => { /* geo lookup failed -no home marker */ });
  }, []);

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

    const hostVal = host.trim();
    if (!hostVal) {
      setIsValidatingHost(false);
      setResolvedIp('');
      setDnsError('');
      setDnsWarning('');
      return;
    }

    const ipv4Pattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const ipv6Pattern = /^(([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|::([fF]{4}(:0{1,4})?:)?((25[0-5]|(2[0-4]|1?[0-9])?[0-9])\.){3}(25[0-5]|(2[0-4]|1?[0-9])?[0-9]))$/;
    const hostnamePattern = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)*[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?$/;

    const isIPv4 = ipv4Pattern.test(hostVal);
    const isIPv6 = ipv6Pattern.test(hostVal);
    const isHostname = !isIPv4 && !isIPv6 && hostnamePattern.test(hostVal);

    // Fast path: if hostname has a cached DNS result for this record type, use it instantly
    if (isHostname) {
      const cacheKey = `${hostVal}|${dnsRecordType}|${dohProvider}`;
      const cached = dnsCacheRef.current.get(cacheKey);
      if (cached) {
        setResolvedIp(cached);
        setDnsError('');
        setIsValidatingHost(false);
        return;
      }
    }

    // Clear resolved state when input changes
    setResolvedIp('');
    setDnsError('');
    setDnsWarning('');
    setResolvedAsn('');
    setResolvedAsnName('');
    // Only clear NS if the host actually changed (NS is record-type-independent)
    if (lastNsHostRef.current !== hostVal) {
      setAuthNs([]);
    }

    if (!isIPv4 && !isIPv6 && !isHostname) {
      setIsValidatingHost(false);
      return;
    }

    // Extra IPv4 validation: octets must be 0-255
    if (isIPv4) {
      const octets = hostVal.split('.').map(Number);
      if (!octets.every(o => o >= 0 && o <= 255)) {
        setIsValidatingHost(false);
        return;
      }
    }

    setIsValidatingHost(true);

    const abortController = new AbortController();
    dnsAbortRef.current = abortController;
    // Combine user abort with 5s timeout to prevent infinite hangs
    const signal = AbortSignal.any([abortController.signal, AbortSignal.timeout(5000)]);

    const timer = setTimeout(async () => {
      try {
        let ip = hostVal;
        let ipVersion: 4 | 6 = isIPv6 ? 6 : 4;

        // If hostname, resolve to IP via selected DoH provider and record type
        if (isHostname) {
          const cacheKey = `${hostVal}|${dnsRecordType}|${dohProvider}`;
          const cached = dnsCacheRef.current.get(cacheKey);
          if (cached) {
            ip = cached;
            ipVersion = cached.includes(':') ? 6 : 4;
            setResolvedIp(ip);
          } else {
            const resolved = await dohResolve(dohProvider, hostVal, dnsRecordType, signal);
            if (!resolved) {
              // Fallback: try the other record type
              const fallbackType = dnsRecordType === 'AAAA' ? 'A' : 'AAAA';
              const fbResolved = await dohResolve(dohProvider, hostVal, fallbackType, signal);
              if (!fbResolved) {
                setDnsError(`No A or AAAA record found for ${hostVal}`);
                setIsValidatingHost(false);
                return;
              }
              ip = fbResolved;
              ipVersion = fallbackType === 'AAAA' ? 6 : 4;
              dnsCacheRef.current.set(`${hostVal}|${fallbackType}|${dohProvider}`, ip);
              setDnsWarning(`No ${dnsRecordType} record for ${hostVal}; switched to ${fallbackType}`);
              setDnsRecordType(fallbackType);
            } else {
              ip = resolved;
              ipVersion = dnsRecordType === 'AAAA' ? 6 : 4;
              dnsCacheRef.current.set(cacheKey, ip);
            }
            setResolvedIp(ip);
          }
        }

        // Fetch authoritative NS records (always via Google JSON API — wire NS parsing is complex)
        if (isHostname && lastNsHostRef.current !== hostVal) {
          try {
            const nsRes = await fetch(
              `${NS_DOH}?name=${encodeURIComponent(hostVal)}&type=NS`,
              { signal, headers: { 'Accept': 'application/dns-json' } }
            );
            const nsData: { Answer?: { type: number; data: string }[], Authority?: { type: number; data: string }[] } = await nsRes.json();
            const nsRecords = (nsData.Answer ?? nsData.Authority ?? [])
              .filter(a => a.type === 2)
              .map(a => a.data.replace(/\.$/, ''));
            setAuthNs(nsRecords);
            lastNsHostRef.current = hostVal;
          } catch {
            // NS lookup optional
          }
        } else if (!isHostname) {
          setAuthNs([]);
          lastNsHostRef.current = '';
        }

        // ASN + geo: skip if only DoH settings changed (same host as last check)
        const hostKey = isHostname ? hostVal : ip;
        if (lastAsnHostRef.current === hostKey) {
          // Host unchanged -DNS re-resolved but skip ASN/geo
          setIsValidatingHost(false);
          return;
        }

        // ASN + geo checks only after user interaction (skip for prepopulated default)
        if (hostTouched) {
          // Check cache by IP first, then by hostname (A/AAAA share the same ASN)
          const cached = getCachedAsn(ip) ?? (isHostname ? getCachedAsn(hostVal) : null);
          let asnNumber: string | undefined;
          let asnName: string | undefined;
          if (cached !== null) {
            asnNumber = cached.asn;
            asnName = cached.name;
            setResolvedAsn(`AS${cached.asn}`);
            setResolvedAsnName(cached.name || '');
            if (cached.asn === CLOUDFLARE_ASN) {
              const resolvedInfo = isHostname ? ` Resolved: ${ip}.` : '';
              setHostError(
                `Target is on Cloudflare's network (AS${cached.asn}).${resolvedInfo} Connections will be blocked.`
              );
              setIsValidatingHost(false);
              lastAsnHostRef.current = hostKey;
              return;
            }
          } else {
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
              asnNumber = txtRecord.data.split('|')[0].trim().replace(/"/g, '');
              setResolvedAsn(`AS${asnNumber}`);
              if (asnNumber === CLOUDFLARE_ASN) {
                setCachedAsn(ip, asnNumber);
                if (isHostname) setCachedAsn(hostVal, asnNumber);
                const resolvedInfo = isHostname ? ` Resolved: ${ip}.` : '';
                setHostError(
                  `Target is on Cloudflare's network (AS${asnNumber}).${resolvedInfo} Connections will be blocked.`
                );
                setIsValidatingHost(false);
                lastAsnHostRef.current = hostKey;
                return;
              }
            }
          }

          // Look up ASN org name via Team Cymru (AS<number>.asn.cymru.com TXT)
          if (asnNumber && !asnName) {
            try {
              const nameRes = await fetch(
                `https://dns.google/resolve?name=AS${asnNumber}.asn.cymru.com&type=TXT`,
                { signal: abortController.signal }
              );
              const nameData: { Answer?: { type: number; data: string }[] } = await nameRes.json();
              const nameTxt = nameData.Answer?.find(a => a.type === 16);
              if (nameTxt) {
                // Format: "16509 | US | arin | 2005-09-29 | AMAZON-02 - Amazon.com, Inc., US"
                const parts = nameTxt.data.replace(/"/g, '').split('|');
                if (parts.length >= 5) {
                  const orgField = parts[4].trim();
                  const dashIdx = orgField.indexOf(' - ');
                  if (dashIdx !== -1) {
                    // Extract human-readable name after " - ", strip trailing ", XX" country code
                    asnName = orgField.substring(dashIdx + 3).trim().replace(/,\s*[A-Z]{2}$/, '').trim();
                  } else {
                    // No separator — use full field, strip trailing country code
                    asnName = orgField.replace(/,\s*[A-Z]{2}$/, '').trim();
                  }
                  setResolvedAsnName(asnName);
                }
              }
            } catch {
              // Name lookup optional
            }
            // Cache with name
            setCachedAsn(ip, asnNumber, asnName);
            if (isHostname) setCachedAsn(hostVal, asnNumber, asnName);
          }
        }

        lastAsnHostRef.current = hostKey;

        // Geo lookup (always run if we have an IP)
        const geoProviders = [
          {
            url: (ipAddr: string) => `https://ipwho.is/${ipAddr}`,
            parse: (d: any) => d.success !== false && d.latitude && d.longitude
              ? { lat: d.latitude, lng: d.longitude, city: d.city, country: d.country }
              : null,
          },
          {
            url: (ipAddr: string) => `https://freeipapi.com/api/json/${ipAddr}`,
            parse: (d: any) => d.latitude && d.longitude
              ? { lat: d.latitude, lng: d.longitude, city: d.cityName, country: d.countryName }
              : null,
          },
          {
            url: (ipAddr: string) => `https://reallyfreegeoip.org/json/${encodeURIComponent(ipAddr)}`,
            parse: (d: any) => d.latitude && d.longitude
              ? { lat: d.latitude, lng: d.longitude, city: d.city, country: d.country_name }
              : null,
          },
        ];
        let geoResult: { lat: number; lng: number; city?: string; country?: string } | null = null;
        for (const provider of geoProviders) {
          try {
            const geoRes = await fetch(provider.url(ip), { signal: abortController.signal });
            if (!geoRes.ok) continue;
            const geoData = await geoRes.json();
            geoResult = provider.parse(geoData);
            if (geoResult) break;
          } catch {
            // Try next provider
          }
        }
        setTargetLocation({
          lat: geoResult?.lat ?? 0,
          lng: geoResult?.lng ?? 0,
          city: geoResult?.city || undefined,
          country: geoResult?.country || undefined,
        });
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return;
        // ASN lookup failed -allow the test to proceed
      }
      setIsValidatingHost(false);
    }, 500);

    return () => {
      clearTimeout(timer);
      abortController.abort();
    };
  }, [host, hostTouched, dnsRecordType]); // eslint-disable-line react-hooks/exhaustive-deps -- dohProvider read at fetch time; changing it shouldn't re-resolve

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
    setHostTouched(true);
    // Auto-update SNI servername when hostname changes
    const trimmed = value.trim();
    if (trimmed && !ipv4Re.test(trimmed) && !ipv6Re.test(trimmed)) {
      setTlsServername(trimmed);
    }
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

  const canRun = !isRunning && !isValidatingHost && !!host.trim() && !!port && !hostError && !portError && !dnsError
    && (!isHostnameInput || resolvedIp !== '')
    && dohProvider.startsWith('https://');

  const clearResults = () => {
    setResults([]);
  };

  // Reset tester and clear results when any config setting changes
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
    setResults([]);
    setStartTime(null);
  }, [host, port, layer, dohProvider, dnsRecordType, minTlsVersion, maxTlsVersion, selectedCiphers, tlsServername, httpMethod, httpPath, expectedStatus, httpHeadersRaw, followRedirects, maxRedirects, httpAuthType, httpAuthUser, httpAuthPass, clientCert, clientKey, caBundlePem, ocspStapling, pinnedPublicKey, connectTimeout, totalTimeout, idleTimeout, tcpKeepAlive, keepAliveDelay, retryCount, retryBackoff]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync config to URL query string (only non-default values)
  useEffect(() => {
    const url = new URL(window.location.href);
    const p = url.searchParams;
    const set = (key: string, value: string, def: string) => {
      if (value !== def) p.set(key, value);
      else p.delete(key);
    };
    set('hostname', host.trim(), 'globo.com');
    set('port', port, '443');
    set('layer', layer, 'l4');
    // L4 TCP controls
    set('connectTimeout', connectTimeout, '5000');
    set('totalTimeout', totalTimeout, '10000');
    if (idleTimeout) p.set('idleTimeout', idleTimeout); else p.delete('idleTimeout');
    if (tcpKeepAlive) { p.set('keepAlive', '1'); set('keepAliveDelay', keepAliveDelay, '1000'); }
    else { p.delete('keepAlive'); p.delete('keepAliveDelay'); }
    if (parseInt(retryCount) > 0) { p.set('retries', retryCount); if (retryBackoff) p.set('backoff', '1'); else p.delete('backoff'); }
    else { p.delete('retries'); p.delete('backoff'); }
    // L7 config
    set('doh', dohProvider, 'https://cloudflare-dns.com/dns-query');
    set('dns', dnsRecordType, 'A');
    if (tlsServername !== host.trim()) p.set('sni', tlsServername);
    else p.delete('sni');
    set('minTls', minTlsVersion, '');
    set('maxTls', maxTlsVersion, '');
    if (selectedCiphers.size > 0) p.set('ciphers', [...selectedCiphers].join(','));
    else p.delete('ciphers');
    set('method', httpMethod, 'HEAD');
    set('path', httpPath, '/');
    set('expect', expectedStatus, '200');
    const defaultHeaders = 'User-Agent: Mozilla/5.0\nAccept: text/html';
    if (httpHeadersRaw !== defaultHeaders) p.set('headers', btoa(httpHeadersRaw));
    else p.delete('headers');
    if (followRedirects) { p.set('redirects', '1'); set('maxRedirects', maxRedirects, '5'); }
    else { p.delete('redirects'); p.delete('maxRedirects'); }
    if (httpAuthType !== 'none') { p.set('auth', httpAuthType); if (httpAuthUser) p.set('user', httpAuthUser); else p.delete('user'); }
    else { p.delete('auth'); p.delete('user'); }
    if (ocspStapling) p.set('ocsp', '1'); else p.delete('ocsp');
    if (pinnedPublicKey) p.set('pin', pinnedPublicKey); else p.delete('pin');
    window.history.replaceState(null, '', url.toString());
  }, [host, port, layer, connectTimeout, totalTimeout, idleTimeout, tcpKeepAlive, keepAliveDelay, retryCount, retryBackoff, dohProvider, dnsRecordType, tlsServername, minTlsVersion, maxTlsVersion, selectedCiphers, httpMethod, httpPath, expectedStatus, httpHeadersRaw, followRedirects, maxRedirects, httpAuthType, httpAuthUser, ocspStapling, pinnedPublicKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const getEgressColo = (result: TestResult): { colo: string; city: string; raw?: string } => {
    const regionType = getRegionType(result.region);
    if (regionType === 'regional') {
      return { colo: result.colo || '', city: result.coloCity || '' };
    }
    if (result.cfPlacement) {
      const parts = result.cfPlacement.split('-');
      const prefix = parts[0]?.toLowerCase();
      if ((prefix === 'local' || prefix === 'remote') && parts.length >= 2) {
        const colo = parts.slice(1).join('-').toUpperCase();
        if (colo) {
          return { colo, city: COLO_TO_CITY[colo] || '' };
        }
      }
      // Non-standard cf-placement format -return raw value for red pillbox
      return { colo: '', city: '', raw: result.cfPlacement };
    }
    // Fallback: if no cfPlacement but we have ingress, assume same
    if (result.colo) {
      return { colo: result.colo, city: result.coloCity || '' };
    }
    return { colo: '', city: '' };
  };

  const downloadCsv = () => {
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const headers = ['Region', 'Loss%', 'Avg (ms)', 'Best (ms)', 'Worst (ms)', 'Ingress Colo', 'Ingress City', 'Egress Colo', 'Egress City'];
    if (layer === 'l7') {
      headers.push('TCP (ms)', 'TLS (ms)', 'TTFB (ms)');
    }
    const rows = results.map((r) => {
      const egress = getEgressColo(r);
      const loss = r.sent > 0 ? ((r.sent - r.received) / r.sent * 100).toFixed(1) : '';
      const avg = r.latencies.length > 0 ? String(Math.round(r.latencies.reduce((a, b) => a + b, 0) / r.latencies.length)) : '';
      const best = r.latencies.length > 0 ? String(Math.min(...r.latencies)) : '';
      const worst = r.latencies.length > 0 ? String(Math.max(...r.latencies)) : '';
      const cols = [
        escape(r.regionName),
        loss,
        avg, best, worst,
        r.colo || '', escape(r.coloCity || ''),
        egress.colo, escape(egress.city),
      ];
      if (layer === 'l7') {
        cols.push(
          r.tcpMs !== undefined ? String(r.tcpMs) : '',
          r.tlsHandshakeMs !== undefined ? String(r.tlsHandshakeMs) : '',
          r.httpMs !== undefined ? String(r.httpMs) : '',
        );
      }
      return cols.join(',');
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

  const runSingleRound = () => {
    selectedRegions.forEach((regionCode, index) => {
      // Parse custom headers from raw text
      const parsedHeaders: Record<string, string> = {};
      if (httpHeadersRaw.trim()) {
        for (const line of httpHeadersRaw.split('\n')) {
          const colonIdx = line.indexOf(':');
          if (colonIdx > 0) {
            parsedHeaders[line.slice(0, colonIdx).trim()] = line.slice(colonIdx + 1).trim();
          }
        }
      }

      // Inject Basic auth header if configured
      if (layer === 'l7' && httpAuthType === 'basic' && httpAuthUser) {
        parsedHeaders['Authorization'] = `Basic ${btoa(`${httpAuthUser}:${httpAuthPass}`)}`;
      }

      const checkRequest: HealthCheckRequest = {
        host: resolvedIp || host.trim(),
        port: parseInt(port),
        timeout: parseInt(totalTimeout) || 10000,
        connectTimeout: parseInt(connectTimeout) || 5000,
        ...(idleTimeout && { idleTimeout: parseInt(idleTimeout) }),
        ...(tcpKeepAlive && { keepAlive: true, keepAliveInitialDelay: parseInt(keepAliveDelay) || 1000 }),
        ...(parseInt(retryCount) > 0 && { retries: parseInt(retryCount), retryBackoff }),
        region: regionCode,
        ...(layer === 'l7' && {
          tlsEnabled: true,
          ...(tlsServername && { tlsServername }),
          ...(minTlsVersion && { minTlsVersion }),
          ...(maxTlsVersion && { maxTlsVersion }),
          ...(selectedCiphers.size > 0 && { ciphers: [...selectedCiphers].join(':') }),
          ...(clientCert && { clientCert }),
          ...(clientKey && { clientKey }),
          ...(caBundlePem && { caBundlePem }),
          ...(ocspStapling && { ocspStapling: true }),
          ...(pinnedPublicKey && { pinnedPublicKey }),
          httpEnabled: true,
          httpMethod,
          httpPath,
          ...(Object.keys(parsedHeaders).length > 0 && { httpHeaders: parsedHeaders }),
          ...(followRedirects && { followRedirects: true, maxRedirects: parseInt(maxRedirects) || 5 }),
        }),
      };

      const regionalEndpoint = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? `/api/check?secret=${apiSecret}`
        : `https://${regionCode}.healthchecks.ross.gg/api/check?secret=${apiSecret}`;

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
            tcpMs?: number;
            tlsVersion?: string;
            tlsCipher?: string;
            tlsHandshakeMs?: number;
            httpStatusCode?: number;
            httpStatusText?: string;
            httpVersion?: string;
            httpMs?: number;
          };

          setResults((prev) =>
            prev.map((r, i) =>
              i === index
                ? {
                    ...r,
                    sent: r.sent + 1,
                    status: (() => {
                      if (!data.success) return 'failed' as const;
                      if (layer === 'l7' && expectedStatus.trim() && data.httpStatusCode !== undefined) {
                        return String(data.httpStatusCode) === expectedStatus.trim() ? 'connected' as const : 'failed' as const;
                      }
                      return 'connected' as const;
                    })(),
                    received: (() => {
                      if (!data.success) return r.received;
                      if (layer === 'l7' && expectedStatus.trim() && data.httpStatusCode !== undefined) {
                        return String(data.httpStatusCode) === expectedStatus.trim() ? r.received + 1 : r.received;
                      }
                      return r.received + 1;
                    })(),
                    latencies: data.latencyMs !== undefined ? [...r.latencies, data.latencyMs] : r.latencies,
                    pingHistory: [...r.pingHistory, { ms: data.success && data.latencyMs !== undefined ? data.latencyMs : null, ts: Date.now() }],
                    lastError: data.error,
                    colo: data.colo || r.colo,
                    coloCity: data.coloCity || r.coloCity,
                    cfPlacement: cfPlacement || r.cfPlacement,
                    tcpMs: data.tcpMs ?? r.tcpMs,
                    tlsVersion: data.tlsVersion || r.tlsVersion,
                    tlsCipher: data.tlsCipher || r.tlsCipher,
                    tlsHandshakeMs: data.tlsHandshakeMs ?? r.tlsHandshakeMs,
                    httpStatusCode: data.httpStatusCode ?? r.httpStatusCode,
                    httpStatusText: data.httpStatusText || r.httpStatusText,
                    httpVersion: data.httpVersion || r.httpVersion,
                    httpMs: data.httpMs ?? r.httpMs,
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
                    pingHistory: [...r.pingHistory, { ms: null, ts: Date.now() }],
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
      pingHistory: [],
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
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <a href="/" className="flex items-center gap-3 no-underline">
              <div className="bg-primary/10 p-2.5 rounded-lg">
                <Handshake className="w-7 h-7 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Handshake Speed</h1>
                <p className="text-slate-400 text-xs">
                  Test Global Cloudflare TCP connectivity to your origin server
                </p>
              </div>
            </a>
            <button
              onClick={() => setAboutOpen(true)}
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              About
            </button>
          </div>
        </div>
      </header>

      {/* About Modal */}
      {aboutOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4" onClick={() => setAboutOpen(false)}>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative bg-slate-800 border border-slate-700 rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between rounded-t-xl">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                About This Tool
              </h2>
              <button
                onClick={() => setAboutOpen(false)}
                className="text-slate-400 hover:text-white transition-colors p-1"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 pb-6 pt-4 space-y-4">
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

              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Two Placement Strategies</h3>
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
                      <div className="text-slate-500 text-[10px]">ingress{homeLocation?.colo ? ` (${homeLocation.colo})` : ''}</div>
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
                These colos will be the same with Regional Services and may differ for Region Placement.
              </p>

              <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-300 leading-relaxed">
                <strong className="text-amber-200">Note:</strong> Connections to targets on Cloudflare's network (AS13335) are blocked for security reasons.
                The test button will be disabled for any target on AS13335.
              </div>

              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Test Modes &amp; OSI Layers</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                This tool supports two testing modes. <strong className="text-white">TCP Only</strong> opens
                a raw socket at the Transport Layer (L4) and measures the three-way handshake.{' '}
                <strong className="text-white">Full Stack</strong> builds on top of that:
                after TCP, it establishes a TLS session with configurable version and cipher constraints (L5/L6),
                then optionally sends an HTTP request and measures time to first byte (L7).
                Each phase is timed independently.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-1.5 pr-3 text-slate-400 font-medium">Action</th>
                      <th className="text-left py-1.5 pr-3 text-slate-400 font-medium">OSI Layer</th>
                      <th className="text-left py-1.5 pr-3 text-slate-400 font-medium">Analogy</th>
                      <th className="text-left py-1.5 text-slate-400 font-medium">Measured</th>
                    </tr>
                  </thead>
                  <tbody className="text-slate-300">
                    <tr className="border-b border-slate-700/50">
                      <td className="py-1.5 pr-3">TCP three-way handshake</td>
                      <td className="py-1.5 pr-3"><span className="text-blue-400">Layer 4</span> - Transport</td>
                      <td className="py-1.5 pr-3 text-slate-400 italic">Dialing the phone</td>
                      <td className="py-1.5 font-mono text-slate-400">TCP ms</td>
                    </tr>
                    <tr className="border-b border-slate-700/50">
                      <td className="py-1.5 pr-3">TLS handshake &amp; session establishment</td>
                      <td className="py-1.5 pr-3"><span className="text-yellow-400">Layer 5</span> - Session</td>
                      <td className="py-1.5 pr-3 text-slate-400 italic">Starting the meeting, agreeing on terms</td>
                      <td className="py-1.5 font-mono text-slate-400" rowSpan={2}>TLS ms</td>
                    </tr>
                    <tr className="border-b border-slate-700/50">
                      <td className="py-1.5 pr-3">Cipher selection &amp; encryption</td>
                      <td className="py-1.5 pr-3"><span className="text-purple-400">Layer 6</span> - Presentation</td>
                      <td className="py-1.5 pr-3 text-slate-400 italic">Choosing the translator</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 pr-3">HTTP request &amp; time to first byte</td>
                      <td className="py-1.5 pr-3"><span className="text-green-400">Layer 7</span> - Application</td>
                      <td className="py-1.5 pr-3 text-slate-400 italic">Having the conversation</td>
                      <td className="py-1.5 font-mono text-slate-400">TTFB</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">
                In a typical browser or <code className="bg-slate-800 px-1 rounded text-slate-300">curl</code> request,
                TLS session setup happens automatically inside the networking stack, and the caller never touches
                Layer 5 or 6 directly. This tool is different: the Worker uses{' '}
                <a href="https://developers.cloudflare.com/workers/runtime-apis/nodejs/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 underline">node:tls</a>
                {' '}to act as a <em>Session Manager</em>, explicitly controlling the TLS handshake parameters
                (min/max version, cipher suites, SNI) that normally live below the application's reach.
                Because you're choosing <em>which</em> ciphers to offer and measuring handshake latency
                and protocol compatibility, <span className="text-white uppercase">you</span> operate at <strong className="text-white">Layer 5</strong>,
                managing the dialogue between client and server, not just consuming it.
              </p>

              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Color Thresholds</h3>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500"></span><span className="text-slate-300">&lt; 100ms</span></span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-500"></span><span className="text-slate-300">100-250ms</span></span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500"></span><span className="text-slate-300">&gt; 250ms</span></span>
              </div>

              <div className="border-t border-slate-700 pt-3 mt-1">
                <p className="text-xs text-slate-500 text-center">
                  Powered by Cloudflare Workers Sockets API •{' '}
                  <a href="https://developers.cloudflare.com/workers/runtime-apis/tcp-sockets/" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary-dark transition-colors">Documentation</a>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-4">
        {/* Input Section */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 p-4 mb-4">
          <div className={`grid grid-cols-1 ${isHostnameInput ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-3 mb-3`}>
            {/* Host Input */}
            <div>
              <label htmlFor="host" className="block text-xs font-medium text-slate-400 mb-1">
                {isHostnameInput ? 'Hostname' : 'Target Hostname / IP'}
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
                  hostError || dnsError
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
              {dnsError && !hostError && (
                <p className="mt-1 text-sm text-red-400 flex items-center gap-1">
                  <XCircle className="w-4 h-4" />
                  {dnsError}
                </p>
              )}
              {dnsWarning && !hostError && !dnsError && (
                <p className="mt-1 text-sm text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  {dnsWarning}
                </p>
              )}
              {isValidatingHost && !hostError && !dnsError && (
                <p className="mt-1 text-sm text-slate-400 flex items-center gap-1">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Resolving...
                </p>
              )}
              {isHostnameInput && authNs.length > 0 && (
                <p className="mt-1 text-[11px] text-slate-500 font-mono truncate" title={authNs.join(', ')}>
                  NS: {authNs.join(', ')}
                </p>
              )}
              {!isHostnameInput && resolvedAsn && (
                <p className="mt-1 text-[11px] text-slate-500 font-mono truncate" title={resolvedAsnName ? `ASN: ${resolvedAsn.replace('AS', '')} (${resolvedAsnName})` : resolvedAsn}>
                  {resolvedAsnName ? `ASN: ${resolvedAsn.replace('AS', '')} (${resolvedAsnName})` : resolvedAsn}
                </p>
              )}
            </div>

            {/* Resolved IP (only shown when hostname detected) */}
            {isHostnameInput && (
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  IP Address
                </label>
                <input
                  type="text"
                  readOnly
                  value={resolvedIp || (isValidatingHost ? '' : '')}
                  placeholder={isValidatingHost ? 'Resolving...' : 'Auto-resolved from hostname'}
                  className="w-full px-4 py-2 bg-slate-900/30 border border-slate-700 rounded-lg text-slate-400 placeholder-slate-600 cursor-not-allowed font-mono"
                />
                {resolvedAsn && (
                  <p className="mt-1 text-[11px] text-slate-500 font-mono truncate" title={resolvedAsnName ? `ASN: ${resolvedAsn.replace('AS', '')} (${resolvedAsnName})` : resolvedAsn}>
                    {resolvedAsnName ? `ASN: ${resolvedAsn.replace('AS', '')} (${resolvedAsnName})` : resolvedAsn}
                  </p>
                )}
              </div>
            )}

            {/* Port Input */}
            <div>
              <label htmlFor="port" className="block text-xs font-medium text-slate-400 mb-1" title="Only TCP port testing is supported. UDP is not available via Cloudflare Workers Sockets API.">
                TCP Port
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
              {!portError && port && (
                <p className="mt-1 text-[11px] text-slate-500 font-mono truncate">
                  {WELL_KNOWN_PORTS[parseInt(port)] || 'Unknown Port'}
                </p>
              )}
            </div>
          </div>

          {/* Advanced Connection Configuration (collapsible) */}
          <div className="mb-3">
            <button
              onClick={() => setTcpAdvancedOpen(!tcpAdvancedOpen)}
              className="flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-slate-300 transition-colors mb-2"
            >
              <ChevronDown className={`w-4 h-4 transition-transform ${tcpAdvancedOpen ? 'rotate-180' : ''}`} />
              Advanced Connection Configuration
              {(connectTimeout !== '5000' || totalTimeout !== '10000' || idleTimeout || tcpKeepAlive || parseInt(retryCount) > 0) && (
                <span className="text-[10px] text-primary">(configured)</span>
              )}
            </button>
              {tcpAdvancedOpen && (
                <div className="border border-slate-700 rounded-lg bg-slate-900/50 p-3 space-y-4">
                  {/* Timeouts */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="connectTimeout" className="block text-xs font-medium text-slate-400 mb-1">Connect Timeout (ms)</label>
                      <input
                        id="connectTimeout"
                        type="text"
                        inputMode="numeric"
                        value={connectTimeout}
                        onChange={(e) => setConnectTimeout(e.target.value.replace(/\D/g, ''))}
                        placeholder="5000"
                        className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">TCP handshake timeout (like curl --connect-timeout)</p>
                    </div>
                    <div>
                      <label htmlFor="totalTimeout" className="block text-xs font-medium text-slate-400 mb-1">Total Timeout (ms)</label>
                      <input
                        id="totalTimeout"
                        type="text"
                        inputMode="numeric"
                        value={totalTimeout}
                        onChange={(e) => setTotalTimeout(e.target.value.replace(/\D/g, ''))}
                        placeholder="10000"
                        className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">Total operation timeout (like curl -m/--max-time)</p>
                    </div>
                  </div>

                  {/* Idle Timeout */}
                  <div>
                    <label htmlFor="idleTimeout" className="block text-xs font-medium text-slate-400 mb-1">Idle Timeout (ms)</label>
                    <input
                      id="idleTimeout"
                      type="text"
                      inputMode="numeric"
                      value={idleTimeout}
                      onChange={(e) => setIdleTimeout(e.target.value.replace(/\D/g, ''))}
                      placeholder="Not set"
                      className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary placeholder-slate-500"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">Emit timeout if socket is idle for this duration (socket.setTimeout)</p>
                  </div>

                  {/* TCP Keep-Alive */}
                  <div className="border-t border-slate-700 pt-3">
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={tcpKeepAlive}
                          onChange={(e) => setTcpKeepAlive(e.target.checked)}
                          className="rounded border-slate-600 bg-slate-800 text-primary focus:ring-primary focus:ring-offset-0"
                        />
                        <span className="text-xs text-slate-300">TCP Keep-Alive</span>
                      </label>
                      {tcpKeepAlive && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-slate-500">initial delay</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={keepAliveDelay}
                            onChange={(e) => setKeepAliveDelay(e.target.value.replace(/\D/g, ''))}
                            className="w-20 px-2 py-0.5 bg-slate-900/50 border border-slate-600 rounded text-white text-xs font-mono text-center focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <span className="text-[10px] text-slate-500">ms</span>
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">Enable TCP keep-alive probes (socket.setKeepAlive). CF infrastructure has its own 30s keep-alive interval.</p>
                  </div>

                  {/* Retry Logic */}
                  <div className="border-t border-slate-700 pt-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <label htmlFor="retryCount" className="text-xs text-slate-300">Retries</label>
                        <input
                          id="retryCount"
                          type="text"
                          inputMode="numeric"
                          value={retryCount}
                          onChange={(e) => setRetryCount(e.target.value.replace(/\D/g, ''))}
                          className="w-12 px-2 py-0.5 bg-slate-900/50 border border-slate-600 rounded text-white text-xs font-mono text-center focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      {parseInt(retryCount) > 0 && (
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={retryBackoff}
                            onChange={(e) => setRetryBackoff(e.target.checked)}
                            className="rounded border-slate-600 bg-slate-800 text-primary focus:ring-primary focus:ring-offset-0"
                          />
                          <span className="text-xs text-slate-300">Exponential backoff with jitter</span>
                        </label>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">Retry failed connections (like curl --retry). Backoff uses 2^n * 100ms base + random jitter.</p>
                  </div>
                </div>
              )}
          </div>

          {/* TCP Only / Full Stack Toggle */}
          <div className="mb-3">
            <div className="inline-flex rounded-lg border border-slate-600 overflow-hidden">
              <button
                onClick={() => setLayer('l4')}
                className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  layer === 'l4'
                    ? 'bg-primary text-white'
                    : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Network className="w-3.5 h-3.5" />
                TCP Only
              </button>
              <button
                onClick={() => setLayer('l7')}
                className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-1.5 ${
                  layer === 'l7'
                    ? 'bg-primary text-white'
                    : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                Full Stack (DNS + TLS + HTTP)
              </button>
            </div>
          </div>

          {/* DNS + TLS + HTTP Options (Full Stack only) */}
          {layer === 'l7' && (
            <div className="border border-slate-700 rounded-lg p-4 space-y-4 bg-slate-900/30">
              {/* DNS Configuration */}
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" />
                DNS Configuration
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Record Type Preference</label>
                  <div className="inline-flex rounded-lg border border-slate-600 overflow-hidden">
                    <button
                      onClick={() => setDnsRecordType('A')}
                      className={`px-4 py-2 text-sm font-medium transition-colors ${
                        dnsRecordType === 'A'
                          ? 'bg-primary text-white'
                          : 'bg-slate-900/50 text-slate-400 hover:text-white'
                      }`}
                    >
                      A (IPv4)
                    </button>
                    <button
                      onClick={() => setDnsRecordType('AAAA')}
                      className={`px-4 py-2 text-sm font-medium transition-colors ${
                        dnsRecordType === 'AAAA'
                          ? 'bg-primary text-white'
                          : 'bg-slate-900/50 text-slate-400 hover:text-white'
                      }`}
                    >
                      AAAA (IPv6)
                    </button>
                  </div>
                </div>
                <div>
                  <label htmlFor="dohProvider" className="block text-xs font-medium text-slate-400 mb-1">
                    DoH Endpoint <span className="text-slate-500">(any DNS-over-HTTPS URL)</span>
                  </label>
                  <input
                    id="dohProvider"
                    type="text"
                    value={dohProvider}
                    onChange={(e) => setDohProvider(e.target.value)}
                    placeholder="https://cloudflare-dns.com/dns-query"
                    className={`w-full px-3 py-2 bg-slate-900/50 border rounded-lg text-white text-sm font-mono focus:outline-none focus:ring-2 transition-colors ${
                      dohProvider && !dohProvider.startsWith('https://')
                        ? 'border-red-500 focus:ring-red-500'
                        : 'border-slate-600 focus:ring-primary'
                    }`}
                  />
                  <div className="flex gap-1.5 mt-1.5">
                    {[
                      { label: 'Cloudflare', url: 'https://cloudflare-dns.com/dns-query' },
                      { label: 'Google', url: 'https://dns.google/resolve' },
                      { label: 'Quad9', url: 'https://dns.quad9.net/dns-query' },
                    ].map((p) => (
                      <button
                        key={p.label}
                        onClick={() => setDohProvider(p.url)}
                        className={`text-xs px-2 py-0.5 rounded transition-colors ${
                          dohProvider === p.url
                            ? 'bg-primary/20 text-primary border border-primary/40'
                            : 'bg-slate-800 text-slate-400 hover:text-white border border-transparent'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  {dohProvider && !dohProvider.startsWith('https://') && (
                    <p className="mt-1 text-xs text-red-400">DoH endpoint must use HTTPS</p>
                  )}
                </div>
              </div>

              {/* TLS Configuration */}
              <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2 border-t border-slate-700 pt-4">
                <Shield className="w-4 h-4 text-primary" />
                TLS Configuration
              </h3>

              {/* TLS Servername (SNI) */}
              <div>
                <label htmlFor="tlsServername" className="block text-xs font-medium text-slate-400 mb-1">Servername (SNI)</label>
                <input
                  id="tlsServername"
                  type="text"
                  value={tlsServername}
                  onChange={(e) => setTlsServername(e.target.value)}
                  placeholder="e.g. example.com"
                  className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder-slate-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">Server Name Indication sent during TLS handshake. Auto-populated from hostname.</p>
              </div>

              {/* Min / Max TLS Version */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="minTls" className="block text-xs font-medium text-slate-400 mb-1">Min TLS Version</label>
                  <select
                    id="minTls"
                    value={minTlsVersion}
                    onChange={(e) => setMinTlsVersion(e.target.value as TlsVersion)}
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {TLS_VERSIONS.map((v) => (
                      <option key={v.value} value={v.value}>{v.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="maxTls" className="block text-xs font-medium text-slate-400 mb-1">Max TLS Version</label>
                  <select
                    id="maxTls"
                    value={maxTlsVersion}
                    onChange={(e) => setMaxTlsVersion(e.target.value as TlsVersion)}
                    className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {TLS_VERSIONS.map((v) => (
                      <option key={v.value} value={v.value}>{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* TLS Advanced */}
              <div>
                <button
                  onClick={() => setTlsAdvancedOpen(!tlsAdvancedOpen)}
                  className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-300 transition-colors"
                >
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${tlsAdvancedOpen ? 'rotate-180' : ''}`} />
                  Advanced
                  {(selectedCiphers.size > 0 || clientCert || caBundlePem || ocspStapling || pinnedPublicKey) && (
                    <span className="text-[10px] text-primary">(configured)</span>
                  )}
                </button>
                {tlsAdvancedOpen && (
                  <div className="mt-2 border border-slate-700 rounded-lg bg-slate-900/50 p-3 space-y-4">
                    {/* Cipher Suites */}
                    <div>
                      <button
                        onClick={() => setCiphersOpen(!ciphersOpen)}
                        className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-300 transition-colors"
                      >
                        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${ciphersOpen ? 'rotate-180' : ''}`} />
                        Cipher Suites {selectedCiphers.size > 0 ? `(${selectedCiphers.size}/${availableCiphers.length} selected)` : `(all ${availableCiphers.length} -- default)`}
                      </button>
                      {ciphersOpen && (
                        <div className="mt-2 border border-slate-700 rounded-lg bg-slate-900/50 p-3">
                          <div className="flex gap-2 mb-3 pb-2 border-b border-slate-700 flex-wrap items-center">
                            <button onClick={() => setSelectedCiphers(new Set())} className="text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800">All (default)</button>
                            <button onClick={() => setSelectedCiphers(new Set(availableCiphers.filter(c => c.group === 'ECDHE + AEAD' || c.group === 'TLS 1.3 Only').map(c => c.name)))} className="text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800">Modern Only</button>
                            <input
                              type="text"
                              value={cipherFilter}
                              onChange={(e) => setCipherFilter(e.target.value)}
                              placeholder="Filter ciphers..."
                              className="ml-auto px-2 py-0.5 bg-slate-900/50 border border-slate-600 rounded text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary placeholder-slate-500 w-44"
                            />
                          </div>
                          {(() => {
                            const availableNames = new Set(availableCiphers.map(c => c.name));
                            const filterLower = cipherFilter.toLowerCase();
                            const groups: { name: string; ciphers: typeof TLS_CIPHERS }[] = [];
                            let currentGroupName = '';
                            for (const cipher of TLS_CIPHERS) {
                              if (cipherFilter && !cipher.name.toLowerCase().includes(filterLower) && !cipher.group.toLowerCase().includes(filterLower)) continue;
                              if (cipher.group !== currentGroupName) {
                                currentGroupName = cipher.group;
                                groups.push({ name: cipher.group, ciphers: [] });
                              }
                              groups[groups.length - 1].ciphers.push(cipher);
                            }
                            return (
                              <div style={{ columns: 3, columnGap: '1rem' }}>
                                {groups.map((group) => (
                                  <div key={group.name} className="mb-2" style={{ breakInside: 'avoid' }}>
                                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1 px-1">{group.name}</div>
                                    {group.ciphers.map((cipher) => {
                                      const isAvailable = availableNames.has(cipher.name);
                                      return (
                                        <label key={cipher.name} className={`flex items-center gap-1.5 px-1 py-0.5 rounded ${isAvailable ? 'hover:bg-slate-800/50 cursor-pointer' : 'opacity-40 cursor-not-allowed'}`}>
                                          <input
                                            type="checkbox"
                                            disabled={!isAvailable}
                                            checked={isAvailable && (selectedCiphers.size === 0 || selectedCiphers.has(cipher.name))}
                                            onChange={(e) => {
                                              const next = new Set(selectedCiphers.size === 0 ? availableCiphers.map(c => c.name) : selectedCiphers);
                                              if (e.target.checked) next.add(cipher.name);
                                              else next.delete(cipher.name);
                                              if (next.size === availableCiphers.length) setSelectedCiphers(new Set());
                                              else setSelectedCiphers(next);
                                            }}
                                            className="rounded border-slate-600 bg-slate-800 text-primary focus:ring-primary focus:ring-offset-0 disabled:opacity-50 shrink-0"
                                          />
                                          <span className={`text-xs font-mono truncate ${isAvailable ? 'text-slate-300' : 'text-slate-600 line-through'}`}>{cipher.name}</span>
                                        </label>
                                      );
                                    })}
                                  </div>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>

                    {/* Mutual TLS (mTLS) */}
                    <div className="border-t border-slate-700 pt-3">
                      <div className="text-xs font-medium text-slate-400 mb-2">Mutual TLS (mTLS)</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Client Certificate (PEM)</label>
                          <textarea
                            value={clientCert}
                            onChange={(e) => setClientCert(e.target.value)}
                            placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                            rows={3}
                            className="w-full px-2 py-1.5 bg-slate-900/50 border border-slate-600 rounded text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary placeholder-slate-600 resize-y"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-slate-500 mb-0.5">Private Key (PEM)</label>
                          <textarea
                            value={clientKey}
                            onChange={(e) => setClientKey(e.target.value)}
                            placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
                            rows={3}
                            className="w-full px-2 py-1.5 bg-slate-900/50 border border-slate-600 rounded text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary placeholder-slate-600 resize-y"
                          />
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">Authenticate the Worker to the origin (like curl --cert / --key)</p>
                    </div>

                    {/* Custom Trust Store */}
                    <div className="border-t border-slate-700 pt-3">
                      <div className="text-xs font-medium text-slate-400 mb-2">Custom Trust Store</div>
                      <textarea
                        value={caBundlePem}
                        onChange={(e) => setCaBundlePem(e.target.value)}
                        placeholder="-----BEGIN CERTIFICATE-----&#10;...&#10;-----END CERTIFICATE-----"
                        rows={3}
                        className="w-full px-2 py-1.5 bg-slate-900/50 border border-slate-600 rounded text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary placeholder-slate-600 resize-y"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">CA bundle for verifying private/internal CAs (like curl --cacert)</p>
                    </div>

                    {/* OCSP Stapling + Certificate Pinning */}
                    <div className="border-t border-slate-700 pt-3 space-y-3">
                      <div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={ocspStapling}
                            onChange={(e) => setOcspStapling(e.target.checked)}
                            className="rounded border-slate-600 bg-slate-800 text-primary focus:ring-primary focus:ring-offset-0"
                          />
                          <span className="text-xs text-slate-300">Request OCSP Stapling</span>
                        </label>
                        <p className="text-[10px] text-slate-500 mt-1 ml-6">Verify certificate revocation status (like curl --cert-status)</p>
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5">Public Key Pin (SHA-256)</label>
                        <input
                          type="text"
                          value={pinnedPublicKey}
                          onChange={(e) => setPinnedPublicKey(e.target.value)}
                          placeholder="sha256//YhKJG3T6+...="
                          className="w-full px-2 py-1.5 bg-slate-900/50 border border-slate-600 rounded text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary placeholder-slate-500"
                        />
                        <p className="text-[10px] text-slate-500 mt-1">Pin against a specific public key hash (like curl --pinnedpubkey)</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* HTTP Configuration -always active in Full Stack mode */}
              <div className="border-t border-slate-700 pt-4">
                <h3 className="text-sm font-semibold text-slate-300 mb-3 flex items-center gap-2">
                  <Network className="w-4 h-4 text-primary" />
                  HTTP Request
                </h3>
                <div className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label htmlFor="httpMethod" className="block text-xs font-medium text-slate-400 mb-1">Method</label>
                      <select
                        id="httpMethod"
                        value={['GET','HEAD','POST','PUT','DELETE','CONNECT','OPTIONS','TRACE','PATCH'].includes(httpMethod) ? httpMethod : '_custom'}
                        onChange={(e) => {
                          if (e.target.value === '_custom') setHttpMethod(customHttpMethod);
                          else setHttpMethod(e.target.value);
                        }}
                        className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      >
                        <option value="GET">GET</option>
                        <option value="HEAD">HEAD</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="DELETE">DELETE</option>
                        <option value="CONNECT">CONNECT</option>
                        <option value="OPTIONS">OPTIONS</option>
                        <option value="TRACE">TRACE</option>
                        <option value="PATCH">PATCH</option>
                        <option value="_custom">METHOD TO THE MADNESS -- custom method</option>
                      </select>
                      {!['GET','HEAD','POST','PUT','DELETE','CONNECT','OPTIONS','TRACE','PATCH'].includes(httpMethod) && (
                        <input
                          type="text"
                          value={customHttpMethod}
                          onChange={(e) => { const v = e.target.value.toUpperCase(); setCustomHttpMethod(v); setHttpMethod(v); }}
                          placeholder="PROPFIND"
                          className="w-full mt-2 px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary placeholder-slate-500"
                        />
                      )}
                    </div>
                    <div>
                      <label htmlFor="httpPath" className="block text-xs font-medium text-slate-400 mb-1">Path</label>
                      <input
                        id="httpPath"
                        type="text"
                        value={httpPath}
                        onChange={(e) => setHttpPath(e.target.value)}
                        placeholder="/"
                        className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                    <div>
                      <label htmlFor="expectedStatus" className="block text-xs font-medium text-slate-400 mb-1">Expected Response</label>
                      <input
                        id="expectedStatus"
                        type="text"
                        value={expectedStatus}
                        onChange={(e) => setExpectedStatus(e.target.value)}
                        placeholder="200"
                        className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="httpHeaders" className="block text-xs font-medium text-slate-400 mb-1">
                      Custom Headers <span className="text-slate-500">(one per line, Key: Value)</span>
                    </label>
                    <textarea
                      id="httpHeaders"
                      value={httpHeadersRaw}
                      onChange={(e) => setHttpHeadersRaw(e.target.value)}
                      placeholder={"User-Agent: Mozilla/5.0\nAccept: text/html"}
                      rows={3}
                      className="w-full px-3 py-2 bg-slate-900/50 border border-slate-600 rounded-lg text-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary resize-y"
                    />
                  </div>

                  {/* Advanced HTTP Options */}
                  <div>
                    <button
                      onClick={() => setHttpAdvancedOpen(!httpAdvancedOpen)}
                      className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-300 transition-colors"
                    >
                      <ChevronDown className={`w-3.5 h-3.5 transition-transform ${httpAdvancedOpen ? 'rotate-180' : ''}`} />
                      Advanced
                    </button>
                    {httpAdvancedOpen && (
                      <div className="mt-2 border border-slate-700 rounded-lg bg-slate-900/50 p-3 space-y-4">
                        {/* Redirect Handling */}
                        <div>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={followRedirects}
                                onChange={(e) => setFollowRedirects(e.target.checked)}
                                className="rounded border-slate-600 bg-slate-800 text-primary focus:ring-primary focus:ring-offset-0"
                              />
                              <span className="text-xs text-slate-300">Follow redirects</span>
                            </label>
                            {followRedirects && (
                              <div className="flex items-center gap-1.5">
                                <span className="text-[10px] text-slate-500">max</span>
                                <input
                                  type="text"
                                  value={maxRedirects}
                                  onChange={(e) => setMaxRedirects(e.target.value.replace(/\D/g, ''))}
                                  className="w-12 px-2 py-0.5 bg-slate-900/50 border border-slate-600 rounded text-white text-xs font-mono text-center focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                              </div>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-500 mt-1">Automatically follow 3xx redirects (like curl -L)</p>
                        </div>

                        {/* Authentication */}
                        <div>
                          <label className="block text-xs font-medium text-slate-400 mb-1.5">Authentication</label>
                          <div className="inline-flex rounded-lg border border-slate-600 overflow-hidden mb-2">
                            <button
                              onClick={() => setHttpAuthType('none')}
                              className={`px-3 py-1 text-xs font-medium transition-colors ${
                                httpAuthType === 'none' ? 'bg-primary text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                              }`}
                            >
                              None
                            </button>
                            <button
                              onClick={() => setHttpAuthType('basic')}
                              className={`px-3 py-1 text-xs font-medium transition-colors ${
                                httpAuthType === 'basic' ? 'bg-primary text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                              }`}
                            >
                              Basic
                            </button>
                          </div>
                          {httpAuthType === 'basic' && (
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-[10px] text-slate-500 mb-0.5">Username</label>
                                <input
                                  type="text"
                                  value={httpAuthUser}
                                  onChange={(e) => setHttpAuthUser(e.target.value)}
                                  placeholder="user"
                                  className="w-full px-2 py-1.5 bg-slate-900/50 border border-slate-600 rounded text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary placeholder-slate-500"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] text-slate-500 mb-0.5">Password</label>
                                <input
                                  type="password"
                                  value={httpAuthPass}
                                  onChange={(e) => setHttpAuthPass(e.target.value)}
                                  placeholder="pass"
                                  className="w-full px-2 py-1.5 bg-slate-900/50 border border-slate-600 rounded text-white text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary placeholder-slate-500"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mb-4">
          {isRunning ? (
            <button
              onClick={stopTest}
              className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
            >
              <Square className="w-4 h-4" />
              Stop
            </button>
          ) : (
            <button
              onClick={runTest}
              disabled={!canRun}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary hover:bg-primary-dark disabled:bg-slate-700 disabled:text-slate-500 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
            >
              <Play className="w-4 h-4" />
              Run Connection Tests
            </button>
          )}

          {results.length > 0 && (
            <>
              <button
                onClick={downloadCsv}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors text-sm"
              >
                <Download className="w-4 h-4" />
                CSV
              </button>
              <button
                onClick={() => { stopTest(); clearResults(); }}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg transition-colors text-sm"
              >
                <Trash2 className="w-4 h-4" />
                Clear
              </button>
            </>
          )}
        </div>

        {/* World Map */}
        <div className="mb-4 relative">
          <WorldMap
            results={continentFilter || countryFilter ? results.filter(r => {
              if (continentFilter && getContinent(r.region) !== continentFilter) return false;
              if (countryFilter && getCountry(r.region) !== countryFilter) return false;
              return true;
            }) : results}
            allRegions={continentFilter || countryFilter ? selectedRegions.filter(code => {
              if (continentFilter && getContinent(code) !== continentFilter) return false;
              if (countryFilter && getCountry(code) !== countryFilter) return false;
              return true;
            }) : selectedRegions}
            homeLocation={homeLocation}
            targetLocation={targetLocation}
            speedMultiplier={speedMultiplier}
            soundEnabled={soundEnabled}
          />
          {/* Demo overlay — empty state message over the map */}
          {!results.some(r => r.sent > 0) && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl transition-opacity duration-500 pointer-events-none">
              <div className="text-center">
                <Network className="w-12 h-12 text-slate-500 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-slate-300 mb-1">No Test Results Yet</h3>
                <p className="text-slate-500 text-sm">
                  Configure your target above and click Run to start testing TCP connectivity
                </p>
              </div>
            </div>
          )}
          {/* Hidden-ish speed control — subtle badge in bottom-right corner */}
          <div className="absolute bottom-2 right-2 flex items-end gap-1">
            {speedPanelOpen && (
              <div className="flex items-center gap-2 bg-slate-900/80 backdrop-blur-sm border border-slate-700/50 rounded-md px-2.5 py-1.5 animate-in fade-in slide-in-from-right-2 duration-200">
                <span className="text-[9px] text-slate-600 font-mono select-none">1×</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={speedSlider}
                  onChange={(e) => {
                    let v = Number(e.target.value);
                    if (Math.abs(v - 50) <= 3) v = 50;
                    setSpeedSlider(v);
                  }}
                  className="w-20 h-1 appearance-none bg-slate-700 rounded-full cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-slate-400 [&::-webkit-slider-thumb]:hover:bg-white"
                />
                <span className="text-[9px] text-slate-600 font-mono select-none">100×</span>
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className={`ml-1 p-0.5 rounded transition-colors ${soundEnabled ? 'text-primary' : 'text-slate-600 hover:text-slate-400'}`}
                  title={soundEnabled ? 'Sound on' : 'Sound off'}
                >
                  {soundEnabled ? <Volume2 className="w-3 h-3" /> : <VolumeX className="w-3 h-3" />}
                </button>
              </div>
            )}
            <button
              onClick={() => setSpeedPanelOpen(!speedPanelOpen)}
              className="text-[10px] font-mono text-slate-600 hover:text-slate-400 transition-colors py-0.5 rounded bg-slate-900/40 border border-transparent hover:border-slate-700/50 select-none w-[38px] text-center"
              title="Animation speed"
            >
              {speedMultiplier < 10 ? speedMultiplier.toFixed(1) : Math.round(speedMultiplier)}×
            </button>
          </div>
        </div>

        {/* Results Dashboard */}
        {results.length > 0 && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl border border-slate-700 overflow-hidden">
            <div className="px-4 py-2 border-b border-slate-700">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Network className="w-4 h-4 text-primary" />
                  {host}:{port}
                  {results.length > 0 && (
                    <span className="text-slate-400 font-normal">
                      &middot; {Math.max(...results.map(r => r.sent))} pings sent
                    </span>
                  )}
                  {isRunning && <Loader2 className="w-3 h-3 animate-spin text-slate-400" />}
                </h2>
                {startTime && <span className="text-xs text-slate-500 ml-auto">{new Date(startTime).toISOString().replace('T', ' ').slice(0, 19)} UTC</span>}
              </div>
              <div className="flex gap-4 text-xs mt-1">
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
              {/* Continent filter chips */}
              <div className="flex flex-wrap gap-1 mt-1.5">
                <button
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => { setContinentFilter(null); setCountryFilter(null); }}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${continentFilter === null ? 'bg-slate-600 text-white' : 'bg-slate-700/50 text-slate-500 hover:text-slate-300'}`}
                >
                  All
                </button>
                {CONTINENTS.map(c => {
                  const count = results.filter(r => getContinent(r.region) === c).length;
                  if (count === 0) return null;
                  return (
                    <button
                      key={c}
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => { setContinentFilter(continentFilter === c ? null : c); setCountryFilter(null); }}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${continentFilter === c ? 'bg-slate-600 text-white' : 'bg-slate-700/50 text-slate-500 hover:text-slate-300'}`}
                    >
                      {c} <span className="opacity-60">{count}</span>
                    </button>
                  );
                })}
              </div>
              {/* Country filter chips (2nd row, when continent selected) */}
              {continentFilter && (() => {
                const continentResults = results.filter(r => getContinent(r.region) === continentFilter);
                const countries = [...new Set(continentResults.map(r => getCountry(r.region)))].sort();
                if (countries.length === 0) return null;
                return (
                  <div className="flex flex-wrap gap-1 mt-1">
                    <button
                      onMouseDown={e => e.preventDefault()}
                      onClick={() => setCountryFilter(null)}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${countryFilter === null ? 'bg-slate-500 text-white' : 'bg-slate-700/50 text-slate-500 hover:text-slate-300'}`}
                    >
                      All
                    </button>
                    {countries.map(country => {
                      const count = continentResults.filter(r => getCountry(r.region) === country).length;
                      return (
                        <button
                          key={country}
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => setCountryFilter(countryFilter === country ? null : country)}
                          className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${countryFilter === country ? 'bg-slate-500 text-white' : 'bg-slate-700/50 text-slate-500 hover:text-slate-300'}`}
                        >
                          {country} <span className="opacity-60">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Results Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-900/50 text-xs">
                  <tr>
                    <th className="px-3 py-1.5 text-left font-medium text-slate-400 uppercase tracking-wider">Region</th>
                    <th className="px-3 py-1.5 text-right font-medium text-slate-400 uppercase tracking-wider w-16">Loss%</th>
                    <th className="px-3 py-1.5 text-right font-medium text-slate-400 uppercase tracking-wider w-16">Avg</th>
                    <th className="px-3 py-1.5 text-right font-medium text-slate-400 uppercase tracking-wider w-16">Best</th>
                    <th className="px-3 py-1.5 text-right font-medium text-slate-400 uppercase tracking-wider w-16">Worst</th>
                    <th className="px-3 py-1.5 text-left font-medium text-slate-400 uppercase tracking-wider" style={{ width: 240 }} title="The data center that first received your request (nearest to your location)">Ingress <svg className="w-3 h-3 inline-block text-slate-500 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></th>
                    <th className="px-3 py-1.5 text-left font-medium text-slate-400 uppercase tracking-wider" style={{ width: 240 }} title="Where the Worker actually executed and ran the TCP test (derived from cf-placement header)">Egress <svg className="w-3 h-3 inline-block text-slate-500 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg></th>
                    {layer === 'l7' && (
                      <>
                        <th className="px-3 py-1.5 text-right font-medium text-slate-400 uppercase tracking-wider w-16">TCP ms</th>
                        <th className="px-3 py-1.5 text-right font-medium text-slate-400 uppercase tracking-wider w-16">TLS ms</th>
                        <th className="px-3 py-1.5 text-right font-medium text-slate-400 uppercase tracking-wider w-16">TTFB</th>
                      </>
                    )}
                    <th className="px-3 py-1.5 text-left font-medium text-slate-400 uppercase tracking-wider w-[104px]">History</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50 font-mono">
                  {(() => {
                    let groupRowIndex = 0;
                    let prevType = '';
                    let filtered = continentFilter ? results.filter(r => getContinent(r.region) === continentFilter) : results;
                    if (countryFilter) filtered = filtered.filter(r => getCountry(r.region) === countryFilter);
                    const groupLabels: Record<string, { label: string; color: string }> = {
                      regional: { label: 'Cloudflare Regional Services', color: 'border-[#F38020]/40 bg-[#F38020]/5 text-[#F38020]' },
                      aws: { label: 'AWS Placement Hints', color: 'border-[#FACC15]/40 bg-[#FACC15]/5 text-[#FACC15]' },
                      gcp: { label: 'GCP Placement Hints', color: 'border-[#34A853]/40 bg-[#34A853]/5 text-[#34A853]' },
                      azure: { label: 'Azure Placement Hints', color: 'border-[#0078D4]/40 bg-[#0078D4]/5 text-[#0078D4]' },
                    };
                    return filtered.map((result, fi) => {
                    const regionType = getRegionType(result.region);
                    const showGroup = regionType !== prevType;
                    if (showGroup) {
                      groupRowIndex = 0;
                      prevType = regionType;
                    }
                    const isEvenRow = groupRowIndex % 2 === 0;
                    groupRowIndex++;
                    const rowAccent = {
                      regional: 'border-l-2 border-l-[#F38020]/30',
                      aws: 'border-l-2 border-l-[#FACC15]/30',
                      gcp: 'border-l-2 border-l-[#34A853]/30',
                      azure: 'border-l-2 border-l-[#0078D4]/30',
                    }[regionType];
                    const stripeBg = isEvenRow
                      ? { regional: 'bg-[#F38020]/[0.04]', aws: 'bg-[#FACC15]/[0.04]', gcp: 'bg-[#34A853]/[0.04]', azure: 'bg-[#0078D4]/[0.04]' }[regionType]
                      : { regional: 'bg-[#F38020]/[0.07]', aws: 'bg-[#FACC15]/[0.07]', gcp: 'bg-[#34A853]/[0.07]', azure: 'bg-[#0078D4]/[0.07]' }[regionType];

                    const loss = result.sent > 0 ? (result.sent - result.received) / result.sent * 100 : 0;
                    const avg = result.latencies.length > 0 ? Math.round(result.latencies.reduce((a, b) => a + b, 0) / result.latencies.length) : null;
                    const best = result.latencies.length > 0 ? Math.min(...result.latencies) : null;
                    const worst = result.latencies.length > 0 ? Math.max(...result.latencies) : null;
                    const egress = getEgressColo(result);
                    const grp = showGroup ? groupLabels[regionType] : null;

                    return (<>
                    {grp && (
                      <tr key={`group-${fi}`}>
                        <td colSpan={layer === 'l4' ? 8 : 11} className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border-l-2 ${grp.color}`}>
                          {grp.label}
                        </td>
                      </tr>
                    )}
                    <tr
                      key={fi}
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
                      <td className={`px-3 py-1.5 text-right ${loss === 0 ? 'text-green-400' : loss < 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {result.sent > 0 ? `${loss.toFixed(0)}%` : '-'}
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
                      <td className="px-3 py-1.5 whitespace-nowrap text-slate-300 overflow-hidden text-ellipsis" style={{ maxWidth: 240 }}>
                        {result.colo
                          ? <><span>{result.colo}</span><span className="text-slate-500"> ({result.coloCity || '?'})</span></>
                          : '-'}
                      </td>
                      <td className="px-3 py-1.5 whitespace-nowrap text-slate-300 overflow-hidden text-ellipsis" style={{ maxWidth: 240 }}>
                        {egress.colo
                          ? <><span>{egress.colo}</span><span className="text-slate-500"> ({egress.city || '?'})</span></>
                          : egress.raw
                            ? <span className="bg-red-500/20 border border-red-500/40 text-red-300 text-xs px-2 py-0.5 rounded-full">{egress.raw}</span>
                            : '-'}
                      </td>
                      {layer === 'l7' && (
                        <>
                          <td className="px-3 py-1.5 text-right text-slate-300">
                            {result.tcpMs !== undefined ? result.tcpMs : '-'}
                          </td>
                          <td className="px-3 py-1.5 text-right text-slate-300">
                            {result.tlsHandshakeMs !== undefined ? result.tlsHandshakeMs : '-'}
                          </td>
                          <td className="px-3 py-1.5 text-right text-slate-300">
                            {result.httpMs !== undefined ? result.httpMs : '-'}
                          </td>
                        </>
                      )}
                      <td className="px-3 py-1.5">
                        {result.pingHistory.length > 0 && (
                          <div className="flex items-end gap-px overflow-hidden" style={{ height: 14, width: 104 }}>
                            {result.pingHistory.slice(-50).map((ping, pi) => {
                              const ts = new Date(ping.ts).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
                              if (ping.ms === null) {
                                return <div key={pi} title="FAIL" style={{ width: 2, height: 14, backgroundColor: '#ef4444', flexShrink: 0, cursor: 'pointer' }} onClick={() => navigator.clipboard.writeText(`FAIL @ ${ts}`)} />;
                              }
                              const color = ping.ms < 100 ? '#22c55e' : ping.ms < 300 ? '#eab308' : '#f97316';
                              const maxMs = worst || 500;
                              const h = Math.max(3, Math.round((ping.ms / maxMs) * 14));
                              return <div key={pi} title={`${ping.ms}ms`} style={{ width: 2, height: Math.min(h, 14), backgroundColor: color, flexShrink: 0, cursor: 'pointer' }} onClick={() => navigator.clipboard.writeText(`${ping.ms}ms @ ${ts}`)} />;
                            })}
                          </div>
                        )}
                      </td>
                    </tr>
                    </>);
                  });
                  })()}
                </tbody>
              </table>
            </div>

          </div>
        )}

      </main>

    </div>
  );
}

export default App;
