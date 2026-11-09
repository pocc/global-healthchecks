import { legRgb, WHITE_RGB, FAILED_RGB } from './packetColor';

const AWS = '250,204,21';

describe('legRgb', () => {
  it('draws the you → Worker leg white when a Worker → target leg follows', () => {
    expect(legRgb(0, 2, AWS, false)).toBe(WHITE_RGB);
    expect(legRgb(0, 2, AWS, true)).toBe(WHITE_RGB);
  });

  it('draws the Worker → target leg in the provider color', () => {
    expect(legRgb(1, 2, AWS, false)).toBe(AWS);
  });

  it('uses the provider color for a single-leg packet (target location unknown, issue #1)', () => {
    expect(legRgb(0, 1, AWS, false)).toBe(AWS);
  });

  it('draws failed checks red on provider-colored legs', () => {
    expect(legRgb(1, 2, AWS, true)).toBe(FAILED_RGB);
    expect(legRgb(0, 1, AWS, true)).toBe(FAILED_RGB);
  });
});
