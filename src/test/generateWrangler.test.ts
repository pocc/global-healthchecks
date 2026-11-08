import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  AWS_REGIONS,
  AZURE_REGIONS,
  GCP_REGIONS,
  REGIONAL_SERVICES,
  generateWranglerToml,
} from '../../generate-wrangler.js';

const toml = generateWranglerToml();

describe('generate-wrangler.js', () => {
  it('matches the committed wrangler.toml (run `node generate-wrangler.js` after editing either)', () => {
    // Vitest runs from the project root.
    const committed = readFileSync(resolve(process.cwd(), 'wrangler.toml'), 'utf8');
    expect(toml).toBe(committed);
  });

  it('keeps production on its Custom Domain', () => {
    expect(toml).toContain('[env.production]\n[[env.production.routes]]\npattern = "healthchecks.ross.gg"\ncustom_domain = true\n');
  });

  it('gives every location a zone route under the wildcard hostname', () => {
    const envs = [
      ...REGIONAL_SERVICES,
      ...AWS_REGIONS.map((r) => `aws-${r}`),
      ...GCP_REGIONS.map((r) => `gcp-${r}`),
      ...AZURE_REGIONS.map((r) => `azure-${r}`),
    ];
    expect(envs).toHaveLength(143);
    expect(new Set(envs).size).toBe(envs.length);
    for (const env of envs) {
      expect(toml).toContain(`[[env.${env}.routes]]\npattern = "${env}.healthchecks.ross.gg/*"\nzone_name = "ross.gg"\n`);
    }
  });

  it('pins each cloud location with targeted placement', () => {
    for (const [provider, regions] of [['aws', AWS_REGIONS], ['gcp', GCP_REGIONS], ['azure', AZURE_REGIONS]] as const) {
      for (const region of regions) {
        expect(toml).toContain(`[env.${provider}-${region}.placement]\nmode = "targeted"\nregion = "${provider}:${region}"\n`);
      }
    }
  });

  it('leaves Regional Services hostnames without placement (assigned in Cloudflare)', () => {
    for (const env of REGIONAL_SERVICES) {
      expect(toml).not.toContain(`[env.${env}.placement]`);
    }
  });
});
