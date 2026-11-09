/**
 * SSRF guard for check targets.
 *
 * Hosts are canonicalized with the WHATWG URL parser (the same rules browsers and the
 * Workers runtime use), so alternate IPv4 spellings like `127.1`, `2130706433`,
 * `0x7f.0.0.1` or `0177.0.0.1` are recognized as 127.0.0.1, and IPv6 is compared in
 * expanded form. Hostnames that *resolve* to private addresses aren't caught here;
 * Workers have no private network behind them and Cloudflare blocks private and
 * loopback destinations for outbound sockets.
 */

type V4Range = [base: number, prefix: number, label: string];

const ip4 = (a: number, b: number, c: number, d: number) => ((a << 24) >>> 0) + (b << 16) + (c << 8) + d;

const BLOCKED_V4: V4Range[] = [
  [ip4(0, 0, 0, 0), 8, 'Unspecified address (0/8)'],
  [ip4(10, 0, 0, 0), 8, 'Private address (10/8)'],
  [ip4(100, 64, 0, 0), 10, 'CGNAT address (100.64/10)'],
  [ip4(127, 0, 0, 0), 8, 'Loopback address (127/8)'],
  [ip4(169, 254, 0, 0), 16, 'Link-local address (169.254/16)'],
  [ip4(172, 16, 0, 0), 12, 'Private address (172.16/12)'],
  [ip4(192, 0, 0, 0), 24, 'IETF reserved address (192.0.0/24)'],
  [ip4(192, 0, 2, 0), 24, 'Documentation address (192.0.2/24)'],
  [ip4(192, 168, 0, 0), 16, 'Private address (192.168/16)'],
  [ip4(198, 18, 0, 0), 15, 'Benchmarking address (198.18/15)'],
  [ip4(198, 51, 100, 0), 24, 'Documentation address (198.51.100/24)'],
  [ip4(203, 0, 113, 0), 24, 'Documentation address (203.0.113/24)'],
  [ip4(224, 0, 0, 0), 4, 'Multicast address (224/4)'],
  [ip4(240, 0, 0, 0), 4, 'Reserved address (240/4)'],
];

const INTERNAL_NAMES = ['localhost', 'metadata.google.internal'];
const INTERNAL_SUFFIXES = ['.localhost', '.internal', '.local', '.home.arpa'];

function checkV4(addr: number): string | null {
  for (const [base, prefix, label] of BLOCKED_V4) {
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    if (((addr & mask) >>> 0) === base) return label;
  }
  return null;
}

/** Expand a canonical IPv6 address (no brackets, hex only) to 8 hextets. */
function expandV6(addr: string): number[] | null {
  const halves = addr.split('::');
  if (halves.length > 2) return null;
  const parse = (part: string) => (part ? part.split(':').map((h) => parseInt(h, 16)) : []);
  const head = parse(halves[0]);
  const tail = halves.length === 2 ? parse(halves[1]) : [];
  const fill = 8 - head.length - tail.length;
  if (fill < 0 || (halves.length === 1 && fill !== 0)) return null;
  const groups = [...head, ...Array(fill).fill(0), ...tail];
  return groups.every((g) => Number.isInteger(g) && g >= 0 && g <= 0xffff) ? groups : null;
}

function checkV6(g: number[]): string | null {
  const zeros = (from: number, to: number) => g.slice(from, to).every((x) => x === 0);
  const embeddedV4 = (hi: number, lo: number) => ((g[hi] << 16) >>> 0) + g[lo];

  if (zeros(0, 8)) return 'Unspecified address (::)';
  if (zeros(0, 7) && g[7] === 1) return 'Loopback address (::1)';
  if (zeros(0, 5) && g[5] === 0xffff) return 'IPv4-mapped IPv6 address (::ffff:0:0/96)';
  if (zeros(0, 6)) return 'IPv4-compatible IPv6 address (::/96)';
  if ((g[0] & 0xfe00) === 0xfc00) return 'Unique local address (fc00::/7)';
  if ((g[0] & 0xffc0) === 0xfe80) return 'Link-local address (fe80::/10)';
  if ((g[0] & 0xffc0) === 0xfec0) return 'Site-local address (fec0::/10)';
  if ((g[0] & 0xff00) === 0xff00) return 'Multicast address (ff00::/8)';
  if (g[0] === 0x2001 && g[1] === 0x0db8) return 'Documentation address (2001:db8::/32)';
  if (g[0] === 0x0100 && zeros(1, 4)) return 'Discard address (100::/64)';
  // Prefixes that embed an IPv4 address: block if that address is blocked
  if (g[0] === 0x0064 && g[1] === 0xff9b && zeros(2, 6)) {
    const v4 = checkV4(embeddedV4(6, 7));
    if (v4) return `NAT64 address embedding ${v4}`;
  }
  if (g[0] === 0x2002) {
    const v4 = checkV4(embeddedV4(1, 2));
    if (v4) return `6to4 address embedding ${v4}`;
  }
  return null;
}

/**
 * Returns why `host` is not allowed as a check target, or null if it's allowed.
 * Accepts hostnames, IPv4 in any notation, and IPv6 with or without brackets.
 */
export function isBlockedHost(host: string): string | null {
  const raw = host.trim().toLowerCase();
  if (!raw) return 'Empty host';
  // Only a bare host is accepted: no ports, paths, credentials or whitespace
  if (/[\s/\\?#@%]/.test(raw)) return 'Invalid host';

  const bracketed = raw.startsWith('[') && raw.endsWith(']');
  const looksV6 = bracketed || raw.includes(':');
  let hostname: string;
  try {
    hostname = new URL(`http://${looksV6 && !bracketed ? `[${raw}]` : raw}/`).hostname;
  } catch {
    return 'Invalid host';
  }

  if (hostname.startsWith('[')) {
    const groups = expandV6(hostname.slice(1, -1));
    return groups ? checkV6(groups) : 'Invalid host';
  }

  const v4 = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) return checkV4(ip4(+v4[1], +v4[2], +v4[3], +v4[4]));

  const name = hostname.replace(/\.$/, '');
  if (INTERNAL_NAMES.includes(name) || INTERNAL_SUFFIXES.some((s) => name.endsWith(s))) {
    return 'Internal hostname';
  }
  return null;
}
