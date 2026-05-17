import type { CostStatus } from '@aiusage/shared';
import catalogData from './pricing.json';

export interface ModelPricing {
  input_per_million_usd: number;
  output_per_million_usd: number;
  cached_input_per_million_usd: number | null;
  cache_write_5m_per_million_usd: number;
  cache_write_1h_per_million_usd: number;
}

export interface PricingCatalog {
  version: string;
  aliases: Record<string, string>;
  providers: Record<string, Record<string, { models: Record<string, ModelPricing> }>>;
}

const catalog: PricingCatalog = catalogData as PricingCatalog;

export function getPricingCatalog(): PricingCatalog {
  return catalog;
}

function resolveModelPricing(
  provider: string,
  product: string,
  model: string,
): { resolvedModel: string; pricing: ModelPricing } | null {
  const models = catalog.providers[provider]?.[product]?.models;
  if (!models) return null;

  const aliasResolved = catalog.aliases[model];
  if (aliasResolved && models[aliasResolved]) {
    return { resolvedModel: aliasResolved, pricing: models[aliasResolved] };
  }

  if (models[model]) {
    return { resolvedModel: model, pricing: models[model] };
  }

  for (const knownModel of Object.keys(models).sort((a, b) => b.length - a.length)) {
    if (model.startsWith(`${knownModel}-`)) {
      return { resolvedModel: knownModel, pricing: models[knownModel] };
    }
  }

  return null;
}

interface CostResult {
  estimatedCostUsd: number;
  costStatus: CostStatus;
  pricingVersion: string;
}

const FAST_MULTIPLIER = 6;

export function calculateCost(
  provider: string,
  product: string,
  model: string,
  tokens: {
    inputTokens: number;
    cachedInputTokens: number;
    cacheWriteTokens: number;
    cacheWrite5mTokens?: number;
    cacheWrite1hTokens?: number;
    outputTokens: number;
  },
): CostResult {
  const totalTokens =
    tokens.inputTokens +
    tokens.cachedInputTokens +
    tokens.cacheWriteTokens +
    tokens.outputTokens;

  if (totalTokens === 0) {
    return { estimatedCostUsd: 0, costStatus: 'exact', pricingVersion: catalog.version };
  }

  // 检测 fast 模式（model 名以 -fast 结尾）
  const isFast = model.endsWith('-fast');
  const baseModel = isFast ? model.replace(/-fast$/, '') : model;

  const resolved = resolveModelPricing(provider, product, baseModel);

  if (!resolved) {
    return { estimatedCostUsd: 0, costStatus: 'unavailable', pricingVersion: catalog.version };
  }

  const { resolvedModel, pricing } = resolved;
  const costStatus: CostStatus = resolvedModel !== baseModel ? 'estimated' : 'exact';

  const cost =
    (tokens.inputTokens / 1_000_000) * pricing.input_per_million_usd +
    (tokens.cachedInputTokens / 1_000_000) * (pricing.cached_input_per_million_usd ?? 0) +
    ((tokens.cacheWrite5mTokens ?? tokens.cacheWriteTokens) / 1_000_000) * pricing.cache_write_5m_per_million_usd +
    ((tokens.cacheWrite1hTokens ?? 0) / 1_000_000) * pricing.cache_write_1h_per_million_usd +
    (tokens.outputTokens / 1_000_000) * pricing.output_per_million_usd;

  const finalCost = isFast ? cost * FAST_MULTIPLIER : cost;

  return {
    estimatedCostUsd: Math.round(finalCost * 10000) / 10000,
    costStatus,
    pricingVersion: catalog.version,
  };
}

export function getWorstCostStatus(statuses: CostStatus[]): CostStatus {
  if (statuses.includes('unavailable')) return 'unavailable';
  if (statuses.includes('estimated')) return 'estimated';
  return 'exact';
}
