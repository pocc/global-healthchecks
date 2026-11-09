import { isBlockedHost } from './ssrf';

describe('isBlockedHost', () => {
  it.each([
    'github.com',
    'sub.example.co.uk',
    '8.8.8.8',
    '1.1.1.1',
    '172.32.0.1', // just outside 172.16/12
    '100.128.0.1', // just outside 100.64/10
    '[2001:4860:4860::8888]',
    '2606:4700::1111', // unbracketed IPv6 is parsed too
    '[64:ff9b::808:808]', // NAT64 embedding 8.8.8.8
    'example.com.', // trailing dot
  ])('allows %s', (host) => {
    expect(isBlockedHost(host)).toBeNull();
  });

  it.each([
    ['127.0.0.1', 'Loopback'],
    ['127.1', 'Loopback'], // shortened
    ['2130706433', 'Loopback'], // decimal integer
    ['0x7f000001', 'Loopback'], // hex integer
    ['0x7f.0.0.1', 'Loopback'], // hex octet
    ['0177.0.0.1', 'Loopback'], // octal octet
    ['0300.0250.0.1', 'Private address (192.168/16)'], // octal 192.168.0.1
    ['10.0.0.1', 'Private address (10/8)'],
    ['172.16.5.4', 'Private address (172.16/12)'],
    ['192.168.1.1', 'Private address (192.168/16)'],
    ['169.254.169.254', 'Link-local'],
    ['100.64.0.1', 'CGNAT'],
    ['0.0.0.0', 'Unspecified'],
    ['198.18.0.1', 'Benchmarking'],
    ['224.0.0.1', 'Multicast'],
    ['255.255.255.255', 'Reserved'],
    ['[::1]', 'Loopback'],
    ['[0:0:0:0:0:0:0:1]', 'Loopback'],
    ['::1', 'Loopback'],
    ['[::]', 'Unspecified'],
    ['[::ffff:127.0.0.1]', 'IPv4-mapped'],
    ['[::ffff:8.8.8.8]', 'IPv4-mapped'],
    ['[fe80::1]', 'Link-local'],
    ['[fd12:3456::1]', 'Unique local'],
    ['[ff02::1]', 'Multicast'],
    ['[2001:db8::1]', 'Documentation'],
    ['[64:ff9b::a00:1]', 'NAT64 address embedding Private address (10/8)'],
    ['[2002:7f00:1::]', '6to4 address embedding Loopback'],
    ['localhost', 'Internal hostname'],
    ['LOCALHOST.', 'Internal hostname'],
    ['app.localhost', 'Internal hostname'],
    ['metadata.google.internal', 'Internal hostname'],
    ['printer.local', 'Internal hostname'],
    ['router.home.arpa', 'Internal hostname'],
  ])('blocks %s', (host, reason) => {
    expect(isBlockedHost(host)).toContain(reason);
  });

  it.each(['', '   ', 'evil.com/path', 'user@evil.com', 'evil.com:80', 'a b.com', 'evil.com#x', '[::1'])(
    'rejects malformed host %j',
    (host) => {
      expect(isBlockedHost(host)).toMatch(/Empty host|Invalid host/);
    },
  );
});
