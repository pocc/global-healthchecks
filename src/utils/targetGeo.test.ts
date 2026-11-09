import { lookupTargetGeo, GEO_PROVIDERS } from './targetGeo';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('lookupTargetGeo', () => {
  it('uses ipwho.is first and returns lat/lng/city/country', async () => {
    const fetchImpl = vi.fn().mockResolvedValueOnce(json({
      success: true, latitude: 37.34, longitude: -121.89, city: 'San Jose', country: 'United States',
    }));
    await expect(lookupTargetGeo('8.8.8.8', undefined, fetchImpl)).resolves.toEqual({
      lat: 37.34, lng: -121.89, city: 'San Jose', country: 'United States',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe('https://ipwho.is/8.8.8.8');
  });

  it('falls back to geojs.io and parses its string coordinates', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(json({ success: false, message: 'Reserved range' }))
      .mockResolvedValueOnce(json({ latitude: '37.751', longitude: '-97.822', country: 'United States' }));
    await expect(lookupTargetGeo('8.8.8.8', undefined, fetchImpl)).resolves.toEqual({
      lat: 37.751, lng: -97.822, city: undefined, country: 'United States',
    });
    expect(fetchImpl.mock.calls[1][0]).toBe('https://get.geojs.io/v1/ip/geo/8.8.8.8.json');
  });

  it('falls back to the Worker proxy after network errors and HTTP errors', async () => {
    const fetchImpl = vi.fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(json({}, 429))
      .mockResolvedValueOnce(json({ lat: 51.5, lng: -0.12, city: 'London', country: 'GB' }));
    await expect(lookupTargetGeo('1.2.3.4', undefined, fetchImpl)).resolves.toMatchObject({ lat: 51.5, lng: -0.12 });
    expect(fetchImpl.mock.calls[2][0]).toBe('/api/geo-lookup?ip=1.2.3.4');
  });

  it('returns null when every provider fails or returns 0,0', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(json({ success: true, latitude: 0, longitude: 0 }))
      .mockResolvedValueOnce(json({}, 503))
      .mockResolvedValueOnce(json({ error: 'All geo providers failed' }, 503));
    await expect(lookupTargetGeo('203.0.113.1', undefined, fetchImpl)).resolves.toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(GEO_PROVIDERS.length);
  });

  it('URL-encodes IPv6 addresses', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({}, 500));
    await lookupTargetGeo('2001:db8::1', undefined, fetchImpl);
    expect(fetchImpl.mock.calls[0][0]).toBe('https://ipwho.is/2001%3Adb8%3A%3A1');
  });

  it('rethrows aborts so the caller can stop', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new DOMException('aborted', 'AbortError'));
    await expect(lookupTargetGeo('8.8.8.8', undefined, fetchImpl)).rejects.toMatchObject({ name: 'AbortError' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
