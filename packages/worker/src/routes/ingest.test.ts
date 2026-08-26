import { describe, expect, it } from 'vitest';
import { getLegacyDeepSeekModels, getLegacyZhipuGlmModels } from './ingest.js';

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
