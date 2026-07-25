import { experimental_createMCPClient, tool } from 'ai';
import { z } from 'zod';
import { readVaultState } from '../casper/reader.js';
import { config, type CaliberConfig } from '../config.js';
import { log } from '../logger.js';

/**
 * Connect to the Casper MCP Server (part of the Casper agentic toolkit) and
 * expose its tools to the agent for on-chain reads. Optional and best-effort:
 * if `CALIBER_CASPER_MCP_URL` is unset or the server is unreachable, returns no
 * tools and the agent falls back to the direct RPC reader. Never throws.
 */
export async function getCasperMcpTools(mcpConfig: CaliberConfig['mcp'] = config.mcp): Promise<{
  tools: Record<string, unknown>;
  status: 'disabled' | 'connected' | 'unavailable';
  toolNames: string[];
  close: () => Promise<void>;
}> {
  const builtinTools = buildCasperToolkitTools();
  const builtinNames = Object.keys(builtinTools);
  const url = mcpConfig.casperUrl;
  if (!url) {
    if (mcpConfig.required) throw new Error('Casper MCP is required but CALIBER_CASPER_MCP_URL is unset');
    return { tools: builtinTools, status: 'disabled', toolNames: builtinNames, close: async () => {} };
  }
  try {
    const client = await experimental_createMCPClient({
      transport: { type: 'sse', url },
      name: 'caliber-casper-agent',
    });
    const externalTools = await client.tools();
    const tools = { ...builtinTools, ...namespaceExternalTools(externalTools) };
    return { tools, status: 'connected', toolNames: Object.keys(tools), close: () => client.close() };
  } catch (err) {
    log.warn('Casper MCP unavailable', { err: String(err) });
    if (mcpConfig.required) throw new Error(`Casper MCP required but unavailable: ${String(err)}`);
    return { tools: builtinTools, status: 'unavailable', toolNames: builtinNames, close: async () => {} };
  }
}

function buildCasperToolkitTools(): Record<string, unknown> {
  return {
    casper_get_vault_state: tool({
      description:
        'Read live CaliberVault state from Casper testnet: paused flag, rebalance count, and configured contract hash.',
      parameters: z.object({}),
      execute: async () => readVaultState(),
    }),
  };
}

function namespaceExternalTools(tools: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(tools).map(([name, value]) => [`casper_mcp_${name}`, value]));
}
