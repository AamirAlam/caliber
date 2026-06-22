import type { RebalanceRequest, TransactionRecord } from '@helm/shared';

/**
 * Wraps Casper transaction construction + submission. The real implementation
 * builds a deploy that calls the Helm vault contract's `record_rebalance`
 * entry point (see packages/contracts), signs it with the agent key, and
 * submits it to the testnet RPC.
 *
 * TODO: implement with casper-js-sdk or the Casper MCP server.
 */
export class CasperExecutor {
  async submit(_request: RebalanceRequest): Promise<TransactionRecord> {
    throw new Error('CasperExecutor.submit not implemented');
  }
}
