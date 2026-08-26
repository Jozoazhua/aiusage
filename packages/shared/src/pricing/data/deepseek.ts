import type { ProductPricing } from '../types.js';

/**
 * DeepSeek。
 * 单价 USD / 1M tokens，按 1 USD = 7.2 CNY 将官方人民币高峰价折算为美元。
 * 来源：https://api-docs.deepseek.com/zh-cn/quick_start/pricing/
 * 最近核对：2026-08-26
 */
export const deepseek: Record<string, ProductPricing> = {
  'deepseek-chat': {
    models: {
      'deepseek-v4-flash': {
        currency: 'USD',
        input_per_million: 0.4166666667,
        cached_input_per_million: 0.0138888889,
        output_per_million: 1.25,
      },
      'deepseek-v4-pro': {
        currency: 'USD',
        input_per_million: 1.25,
        cached_input_per_million: 0.0416666667,
        output_per_million: 3.75,
      },
      'deepseek-v4-flash-vision-exp': {
        currency: 'USD',
        input_per_million: 0.4166666667,
        cached_input_per_million: 0.0138888889,
        output_per_million: 1.25,
      },
      // 兼容别名（chat = v4-flash 非思考，reasoner = v4-flash 思考），按 v4-flash 同价计
      'deepseek-chat': {
        currency: 'USD',
        notes: 'alias for v4-flash non-thinking',
        input_per_million: 0.4166666667,
        cached_input_per_million: 0.0138888889,
        output_per_million: 1.25,
      },
      'deepseek-reasoner': {
        currency: 'USD',
        notes: 'alias for v4-flash thinking',
        input_per_million: 0.4166666667,
        cached_input_per_million: 0.0138888889,
        output_per_million: 1.25,
      },
    },
  },
};
