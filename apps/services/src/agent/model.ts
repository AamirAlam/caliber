import { createAnthropic } from '@ai-sdk/anthropic';
import type { LanguageModelV1 } from 'ai';
import { config } from '../config.js';

/**
 * Resolve the LLM from `config.ai` (provider + model). Model-agnostic by design:
 * add other `@ai-sdk/*` providers here and switch on `config.ai.provider`.
 * Returns null when no API key is set, so callers fall back to deterministic mode.
 */
export function resolveModel(): LanguageModelV1 | null {
  if (!config.ai.apiKey) return null;
  switch (config.ai.provider) {
    case 'anthropic':
    default: {
      const anthropic = createAnthropic({ apiKey: config.ai.apiKey });
      return anthropic(config.ai.model);
    }
  }
}
