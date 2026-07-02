import { readFileSync } from 'node:fs';
// casper-js-sdk ships as CommonJS; use a namespace import so Node's ESM loader
// doesn't choke on named-export detection.
import * as casper from 'casper-js-sdk';
import type { RebalanceRequest, TransactionRecord } from '@helm/shared';
import { config } from '../config.js';
import { log } from '../logger.js';

/**
 * Wraps Casper transaction construction + submission. `submit` builds a
 * TransactionV1 that calls the HelmVault `record_rebalance` entry point, signs
 * it with the agent key, and submits it to the testnet RPC via casper-js-sdk.
 *
 * In `HELM_DRY_RUN` mode it returns a synthetic `submitted` record so the full
 * UX is demoable without a funded key.
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

    if (!config.casper.vaultContractHash) {
      return { ...base, status: 'failed', error: 'HELM_VAULT_CONTRACT_HASH not set' };
    }

    try {
      const key = loadKey();
      const args = casper.Args.fromMap({ rebalance_id: casper.CLValue.newCLString(request.id) });
      const tx = new casper.ContractCallBuilder()
        .byPackageHash(config.casper.vaultContractHash)
        .entryPoint('record_rebalance')
        .runtimeArgs(args)
        .from(key.publicKey)
        .chainName(config.casper.networkName)
        .payment(config.casper.paymentMotes)
        .build();
      tx.sign(key);

      const rpc = new casper.RpcClient(new casper.HttpHandler(config.casper.rpcUrl));
      const res = await rpc.putTransaction(tx);
      const hash = res.transactionHash.transactionV1?.toHex() ?? tx.hash.toHex();
      log.info('submitted record_rebalance', { hash });
      return { ...base, status: 'submitted', deployHash: hash, submittedAt: new Date().toISOString() };
    } catch (err) {
      log.error('submit failed', { err: String(err) });
      return { ...base, status: 'failed', error: String(err) };
    }
  }

  /**
   * Wait for a submitted transaction to finalize. Returns the updated status.
   * Used by the finalization poller (M5).
   */
  async waitForFinalization(hash: string): Promise<'finalized' | 'failed'> {
    if (config.loop.dryRun) return 'finalized';
    try {
      const rpc = new casper.RpcClient(new casper.HttpHandler(config.casper.rpcUrl));
      const res = await rpc.getTransactionByTransactionHash(hash);
      const errorMessage = res.executionInfo?.executionResult?.errorMessage;
      return errorMessage ? 'failed' : 'finalized';
    } catch {
      return 'failed';
    }
  }
}

function loadKey(): casper.PrivateKey {
  const pem = readFileSync(config.casper.secretKeyPath, 'utf8');
  const algo =
    config.casper.keyAlgo === 'secp256k1'
      ? casper.KeyAlgorithm.SECP256K1
      : casper.KeyAlgorithm.ED25519;
  return casper.PrivateKey.fromPem(pem, algo);
}
