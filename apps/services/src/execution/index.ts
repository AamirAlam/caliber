import type { RebalanceRequest, TransactionRecord } from '@helm/shared';
import { config } from '../config.js';
import { log } from '../logger.js';

/**
 * Wraps Casper transaction construction + submission. `submit` builds a deploy
 * that calls the HelmVault `record_rebalance` entry point, signs it with the
 * agent key, and submits it to the testnet RPC (implemented in M4 with
 * casper-js-sdk).
 *
 * In `HELM_DRY_RUN` mode (default) it returns a synthetic `submitted` record so
 * the full UX is demoable without a funded key.
 */
export class CasperExecutor {
  async submit(request: RebalanceRequest): Promise<TransactionRecord> {
    const base: TransactionRecord = {
      id: `tx_${request.id}`,
      status: 'prepared',
      entryPoint: 'record_rebalance',
      rebalanceRequestId: request.id,
      network: 'casper-testnet',
    };

    if (config.loop.dryRun) {
      const fakeHash = `dryrun-${request.id}`;
      log.info('dry-run: synthetic deploy', { deployHash: fakeHash });
      return { ...base, status: 'submitted', deployHash: fakeHash, submittedAt: new Date().toISOString() };
    }

    // TODO(M4): real casper-js-sdk path — load key, call record_rebalance, sign, putDeploy.
    throw new Error('live execution not implemented (set HELM_DRY_RUN=true or implement M4)');
  }
}
