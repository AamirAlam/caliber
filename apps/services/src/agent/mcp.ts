import { experimental_createMCPClient } from 'ai';

/**
 * Connect to the Casper MCP Server (part of the Casper agentic toolkit) and
 * expose its tools to the agent for on-chain reads. Optional and best-effort:
 * if `CALIBER_CASPER_MCP_URL` is unset or the server is unreachable, returns no
 * tools and the agent falls back to the direct RPC reader. Never throws.
 */
export async function getCasperMcpTools(): Promise<{
  tools: Record<string, unknown>;
  close: () => Promise<void>;
}> {
  const url = process.env.CALIBER_CASPER_MCP_URL;
  if (!url) return { tools: {}, close: async () => {} };
  try {
    const client = await experimental_createMCPClient({
      transport: { type: 'sse', url },
    });
    const tools = await client.tools();
    return { tools, close: () => client.close() };
  } catch {
    return { tools: {}, close: async () => {} };
  }
}
