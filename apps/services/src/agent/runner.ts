import { generateText } from 'ai';
import type { Recommendation } from '@helm/shared';
import {
  buildRecommendation,
  decideAction,
  fallbackExplanation,
  type DecisionInput,
} from '../decision/index.js';
import { log } from '../logger.js';
import { resolveModel } from './model.js';
import { buildTools, type VaultState } from './tools.js';

const SYSTEM = `You are Helm, an AI treasury control plane for tokenized real-world assets.
Investigate the situation using your tools: read the signals and policy, call score_risk,
then call evaluate_policy for both "hold" and "rebalance". Compliance is decided ONLY by the
deterministic evaluate_policy tool — you must not assert compliance yourself. Then write a concise,
institutional explanation (2-3 sentences) of the recommended action and why it respects the policy.`;

const DEFAULT_VAULT_STATE: VaultState = { paused: false, rebalanceCount: 0, contractHash: '' };

export interface AgentResult {
  recommendation: Recommendation;
  toolTrace: string[];
}

/**
 * Run one agent turn. The deterministic `decideAction` is authoritative for the
 * action + compliance verdict; the LLM (via tool use) produces the human-facing
 * explanation. Falls back to a deterministic explanation with no API key or on error.
 */
export async function generateRecommendation(
  input: DecisionInput,
  vaultState: VaultState = DEFAULT_VAULT_STATE,
): Promise<AgentResult> {
  const decision = decideAction(input);
  const model = resolveModel();

  if (!model) {
    return {
      recommendation: buildRecommendation(input, decision, fallbackExplanation(input, decision)),
      toolTrace: ['fallback:no-llm'],
    };
  }

  try {
    const tools = buildTools({ ...input, vaultState });
    const result = await generateText({
      model,
      system: SYSTEM,
      tools,
      maxSteps: 8,
      prompt: `Assess the treasury and explain the recommended action. The deterministic engine has decided: action="${decision.action}", compliancePassed=${decision.compliancePassed}. Investigate with the tools and explain this decision.`,
    });
    const toolTrace = (result.steps ?? []).flatMap((s) =>
      (s.toolCalls ?? []).map((c) => c.toolName),
    );
    const explanation = result.text?.trim() || fallbackExplanation(input, decision);
    return { recommendation: buildRecommendation(input, decision, explanation), toolTrace };
  } catch (err) {
    log.warn('agent turn failed; using fallback explanation', { err: String(err) });
    return {
      recommendation: buildRecommendation(input, decision, fallbackExplanation(input, decision)),
      toolTrace: ['fallback:error'],
    };
  }
}
