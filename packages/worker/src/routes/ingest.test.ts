import { describe, expect, it, vi } from 'vitest';
import type { IngestBreakdown, IngestPayload } from '@aiusage/shared';
import type { Env } from '../types.js';
import { signDeviceToken } from '../utils/token.js';
import { getLegacyDeepSeekModels, getLegacyZhipuGlmModels, handleIngest } from './ingest.js';

describe('getLegacyZhipuGlmModels', () => {
  it('returns the legacy Zhipu model keys for a Claude Code GLM breakdown', () => {
    expect(getLegacyZhipuGlmModels({
      provider: 'anthropic',
      product: 'claude-code',
      model: 'glm-5.1',
    })).toEqual(['glm-5.1', 'glm-5.1-fast']);
  });

  it('does not clean native Claude or unrelated providers', () => {
    expect(getLegacyZhipuGlmModels({
      provider: 'anthropic',
      product: 'claude-code',
      model: 'claude-opus-4-8',
    })).toEqual([]);
  });
});

describe('getLegacyDeepSeekModels', () => {
  it('returns legacy DeepSeek model keys for a Claude Code breakdown', () => {
    expect(getLegacyDeepSeekModels({
      provider: 'anthropic',
      product: 'claude-code',
      model: 'deepseek-v4-flash-vision-exp',
    })).toEqual(['deepseek-v4-flash-vision-exp', 'deepseek-v4-flash-vision-exp-fast']);
  });

  it('does not clean native DeepSeek rows for unrelated breakdowns', () => {
    expect(getLegacyDeepSeekModels({
      provider: 'deepseek',
      product: 'deepseek-chat',
      model: 'deepseek-v4-flash',
    })).toEqual([]);
  });
});

describe('handleIngest', () => {
  it('batches scoped legacy cleanup before replacement rows and daily totals', async () => {
    const secret = 'ingest-test-secret';
    const usageDate = '2026-11-18';
    const deviceId = 'test-device';
    const siteId = 'test-site';
    const token = await signDeviceToken({ siteId, deviceId, tokenVersion: 1, issuedAt: usageDate }, secret);
    const breakdown: IngestBreakdown = {
      provider: 'anthropic', product: 'claude-code', channel: 'api', project: 'test-project',
      model: 'glm-5.2', eventCount: 1, inputTokens: 100, outputTokens: 50,
      cachedInputTokens: 0, cacheWriteTokens: 0, reasoningOutputTokens: 0,
    };
    const payload: IngestPayload = {
      siteId, schemaVersion: '1', generatedAt: usageDate,
      device: { deviceId, hostname: 'test', timezone: 'UTC', appVersion: '1.8.3-local.1' },
      days: [{
        usageDate,
        breakdowns: [
          breakdown,
          { ...breakdown, model: 'deepseek-v4-flash' },
          { ...breakdown, model: 'claude-sonnet-5-5' },
        ],
      }],
    };
    const run = vi.fn();
    const batch = vi.fn(async (_statements: Array<{ sql: string; params: unknown[] }>) => []);
    const env = {
      DEVICE_TOKEN_SECRET: secret,
      DB: {
        batch,
        prepare: (sql: string) => ({
          bind: (...params: unknown[]) => ({
            sql: sql.trim(), params, run, first: async () => ({ status: 'active', token_version: 1 }),
          }),
        }),
      },
    } as unknown as Env;

    const response = await handleIngest(new Request('https://example.com/api/v1/ingest', {
      method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify(payload),
    }), env);

    expect(response.status).toBe(200);
    expect(batch).toHaveBeenCalledTimes(2);
    expect(run).toHaveBeenCalledTimes(1);
    const [writes] = batch.mock.calls[0];
    expect(writes.map(({ sql }) => sql.split(/\s+/).slice(0, 3).join(' '))).toEqual([
      'INSERT INTO daily_usage',
      'DELETE FROM daily_usage_breakdown',
      'INSERT INTO daily_usage_breakdown',
      'DELETE FROM daily_usage_breakdown',
      'INSERT INTO daily_usage_breakdown',
      'INSERT INTO daily_usage_breakdown',
      'UPDATE daily_usage SET',
    ]);
    const expectedScope = [deviceId, usageDate, breakdown.channel, breakdown.project];
    expect(writes[1].sql).toContain("provider = 'zhipu' AND product = 'glm-chat'");
    expect(writes[1].params).toEqual([...expectedScope, 'glm-5.2', 'glm-5.2-fast']);
    expect(writes[3].sql).toContain("provider = 'deepseek' AND product = 'deepseek-chat'");
    expect(writes[3].params).toEqual([...expectedScope, 'deepseek-v4-flash', 'deepseek-v4-flash-fast']);
  });
});
