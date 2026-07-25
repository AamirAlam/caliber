import { describe, expect, it } from 'vitest';
import { getCasperMcpTools } from './mcp.js';

describe('Casper MCP toolkit connector', () => {
  it('always exposes the built-in Casper vault-state tool when external MCP is disabled', async () => {
    const mcp = await getCasperMcpTools({ casperUrl: '', required: false });
    expect(mcp.status).toBe('disabled');
    expect(mcp.toolNames).toContain('casper_get_vault_state');
    expect(mcp.tools).toHaveProperty('casper_get_vault_state');
    await mcp.close();
  });

  it('fails closed when external Casper MCP is required but not configured', async () => {
    await expect(getCasperMcpTools({ casperUrl: '', required: true })).rejects.toThrow(
      /Casper MCP is required/,
    );
  });
});
