import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { LanguageModelV1 } from 'ai';
import { config } from '../config.js';

/**
 * Resolve the LLM from `config.ai` (provider + model). Model-agnostic by design.
 * Returns null when no API key is set, so callers fall back to deterministic mode.
 *
 * - `anthropic`: Claude directly via `@ai-sdk/anthropic`.
 * - `openrouter`: one key across many providers via `@openrouter/ai-sdk-provider`,
 *   with automatic provider fallbacks. Pin a specific model (e.g. `openai/gpt-4o-mini`)
 *   rather than auto-routing so the decision maker stays auditable.
 */
export function resolveModel(): LanguageModelV1 | null {
  if (!config.ai.apiKey) return null;
  switch (config.ai.provider) {
    case 'openrouter': {
      const openrouter = createOpenRouter({ apiKey: config.ai.apiKey });
      return openrouter(config.ai.model);
    }
    case 'anthropic':
    default: {
      const anthropic = createAnthropic({ apiKey: config.ai.apiKey });
      return anthropic(config.ai.model);
    }
  }
}
