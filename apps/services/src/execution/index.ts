import { readFileSync } from 'node:fs';
// casper-js-sdk ships as CommonJS with everything on the default export; use a
// default import for values and a type-only import for annotations.
import casper from 'casper-js-sdk';
import type { PrivateKey } from 'casper-js-sdk';
import type { RebalanceRequest, TransactionRecord } from '@caliber/shared';
import { config } from '../config.js';
import { log } from '../logger.js';

/**
 * Wraps Casper transaction construction + submission. `submit` builds a
 * TransactionV1 that calls the CaliberVault `record_rebalance` entry point, signs
 * it with the agent key, and submits it to the testnet RPC via casper-js-sdk.
 *
 * In `CALIBER_DRY_RUN` mode it returns a synthetic `submitted` record so local
 * development can exercise the execution path without a funded key.
 */
/**
 * blake2b-256 hash of the decision's canonical content (legs, amounts, policy,
 * snapshot, risk). Anchored on-chain inside the recorded rebalance id so the
 * audit stamp is verifiable against the off-chain record.
 */
export function decisionContentHash(
  rebalance: RebalanceRequest,
  ctx: { policyId: string; snapshotId: string; riskScore: number },
): string {
  const canonical = JSON.stringify({
    rebalanceId: rebalance.id,
    policyId: ctx.policyId,
    snapshotId: ctx.snapshotId,
    riskScore: ctx.riskScore,
    legs: rebalance.legs.map((leg) => ({
      from: leg.fromAssetId,
      to: leg.toAssetId,
      weight: leg.weight,
      amount: leg.amount,
    })),
  });
  return Buffer.from(casper.byteHash(Buffer.from(canonical, 'utf8'))).toString('hex');
}

export class CasperExecutor {
  async submit(request: RebalanceRequest, contentHash?: string): Promise<TransactionRecord> {
    // The deployed contract records a single string; suffixing the content hash
    // anchors the decision digest without a contract change.
    const recordedId = contentHash ? `${request.id}:${contentHash}` : request.id;
    const base: TransactionRecord = {
      id: `tx_${request.id}`,
      status: 'prepared',
      entryPoint: 'record_rebalance',
      rebalanceRequestId: request.id,
      contentHash,
      network: 'casper-testnet',
    };

    if (config.loop.dryRun) {
      const fakeHash = `dryrun-${request.id}`;
      log.info('dry-run: synthetic deploy', { deployHash: fakeHash });
      return { ...base, status: 'submitted', deployHash: fakeHash, submittedAt: new Date().toISOString() };
    }

    if (!config.casper.vaultContractHash) {
      return { ...base, status: 'failed', error: 'CALIBER_VAULT_CONTRACT_HASH not set' };
    }

    try {
      const key = loadKey();
      const args = casper.Args.fromMap({ rebalance_id: casper.CLValue.newCLString(recordedId) });
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
  async waitForFinalization(hash: string): Promise<'pending' | 'finalized' | 'failed'> {
    if (config.loop.dryRun) return 'finalized';
    try {
      const rpc = new casper.RpcClient(new casper.HttpHandler(config.casper.rpcUrl));
      const res = await rpc.getTransactionByTransactionHash(hash);
      const errorMessage = res.executionInfo?.executionResult?.errorMessage;
      if (!res.executionInfo?.executionResult) return 'pending';
      return errorMessage ? 'failed' : 'finalized';
    } catch (err) {
      const msg = String(err);
      if (/not found|No such|404|missing/i.test(msg)) return 'pending';
      log.warn('finalization lookup failed', { hash, err: msg });
      return 'pending';
    }
  }
}

function loadKey(): PrivateKey {
  const pem = readFileSync(config.casper.secretKeyPath, 'utf8');
  const algo =
    config.casper.keyAlgo === 'secp256k1'
      ? casper.KeyAlgorithm.SECP256K1
      : casper.KeyAlgorithm.ED25519;
  return casper.PrivateKey.fromPem(pem, algo);
}
