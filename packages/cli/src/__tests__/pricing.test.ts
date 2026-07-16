import { describe, expect, it } from 'vitest';
import { shouldPreferBundledCatalog } from '../pricing.js';

describe('shouldPreferBundledCatalog', () => {
  it('prevents an older auto catalog from replacing the bundled catalog', () => {
    expect(shouldPreferBundledCatalog(
      '2026-05-29-unified-v1',
      '2026-07-16-glm-5.2-v1',
      'auto',
    )).toBe(true);
  });

  it('allows same-day and newer remote catalogs', () => {
    expect(shouldPreferBundledCatalog(
      '2026-07-16-hotfix-v2',
      '2026-07-16-glm-5.2-v1',
      'auto',
    )).toBe(false);
    expect(shouldPreferBundledCatalog(
      '2026-07-17-v1',
      '2026-07-16-glm-5.2-v1',
      'auto',
    )).toBe(false);
  });

  it('respects an explicitly pinned manual catalog', () => {
    expect(shouldPreferBundledCatalog(
      '2026-05-29-unified-v1',
      '2026-07-16-glm-5.2-v1',
      'manual',
    )).toBe(false);
  });
});
