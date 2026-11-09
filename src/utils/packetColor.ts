export const WHITE_RGB = '255,255,255';
export const FAILED_RGB = '239,68,68';

/**
 * Color ("r,g,b") for one leg of a world-map packet.
 *
 * A two-leg packet travels you → Worker (white) then Worker → target (provider color).
 * When the target's location is unknown the packet has a single you → Worker leg;
 * that leg takes the provider color so providers stay distinguishable.
 * Failed checks are drawn red on every provider-colored leg.
 */
export function legRgb(legIdx: number, legCount: number, providerRgb: string, failed: boolean): string {
  if (legIdx === 0 && legCount > 1) return WHITE_RGB;
  return failed ? FAILED_RGB : providerRgb;
}
