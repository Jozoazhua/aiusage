import { describe, expect, it } from 'vitest';
import { getLegacyClaudeGlmModels } from './ingest.js';

describe('getLegacyClaudeGlmModels', () => {
  it('returns the legacy Claude model keys for a Zhipu GLM breakdown', () => {
    expect(getLegacyClaudeGlmModels({
      provider: 'zhipu',
      product: 'glm-chat',
      model: 'glm-5.1',
    })).toEqual(['glm-5.1', 'glm-5.1-fast']);
  });

  it('does not clean native Claude or unrelated providers', () => {
    expect(getLegacyClaudeGlmModels({
      provider: 'anthropic',
      product: 'claude-code',
      model: 'claude-opus-4-8',
    })).toEqual([]);
  });
});
