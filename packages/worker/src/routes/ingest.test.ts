import { describe, expect, it } from 'vitest';
import { getLegacyZhipuGlmModels } from './ingest.js';

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
