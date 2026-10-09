import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { catalog as bundledCatalog } from '@aiusage/shared';

const { home } = vi.hoisted(() => ({
  home: `${process.env.TMPDIR ?? '/tmp'}/aiusage-pricing-test-${process.pid}`,
}));

vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os');
  return { ...actual, homedir: () => home };
});

const { resolvePricingCatalog, shouldPreferBundledCatalog } = await import('../pricing.js');

async function writeCache(version: string): Promise<void> {
  await mkdir(join(home, '.aiusage'), { recursive: true });
  await writeFile(join(home, '.aiusage', 'pricing-cache.json'), JSON.stringify({
    fetchedAt: new Date().toISOString(),
    sourceUrl: 'https://example.com/pricing',
    catalog: { ...bundledCatalog, version },
  }));
}

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

describe('resolvePricingCatalog', () => {
  beforeEach(async () => {
    await rm(home, { recursive: true, force: true });
  });

  afterEach(async () => {
    await rm(home, { recursive: true, force: true });
    vi.unstubAllGlobals();
  });

  it('auto 模式下未过期缓存旧于内置目录时改用内置目录', async () => {
    await writeCache('2000-01-01-old');
    const resolved = await resolvePricingCatalog({});
    expect(resolved.info.source).toBe('bundled');
    expect(resolved.info.version).toBe(bundledCatalog.version);
  });

  it('auto 模式下缓存不旧于内置目录时沿用缓存', async () => {
    await writeCache('9999-12-31-new');
    const resolved = await resolvePricingCatalog({});
    expect(resolved.info.source).toBe('cache');
    expect(resolved.info.version).toBe('9999-12-31-new');
  });

  it('manual 模式保留用户固定的缓存版本', async () => {
    await writeCache('2000-01-01-old');
    const resolved = await resolvePricingCatalog({ pricing: { mode: 'manual' } });
    expect(resolved.info.source).toBe('cache');
    expect(resolved.info.version).toBe('2000-01-01-old');
  });

  it('auto 模式下远端目录旧于内置目录时改用内置目录', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ...bundledCatalog, version: '2000-01-01-old' })));
    vi.stubGlobal('fetch', fetchMock);
    const resolved = await resolvePricingCatalog({}, { forceRefresh: true });
    expect(fetchMock).toHaveBeenCalled();
    expect(resolved.info.source).toBe('bundled');
  });
});
