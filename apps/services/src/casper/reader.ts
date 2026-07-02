// casper-js-sdk is CommonJS with everything on the default export.
import casper from 'casper-js-sdk';
import { config } from '../config.js';
import { log } from '../logger.js';

export interface VaultState {
  paused: boolean;
  rebalanceCount: number;
  contractHash: string;
}

/**
 * Odra stores every module `Var` in a single "state" dictionary, keyed by
 * hex(blake2b256(big-endian u32 field index)). Fields are numbered in
 * declaration order starting at 1 (index 0 is reserved): for HelmVault that is
 * owner=1, policy_ref=2, policy_version=3, paused=4, rebalance_count=5.
 */
const FIELD_INDEX = { paused: 4, rebalanceCount: 5 } as const;

let resolved: { contractHash: string; stateUref: string } | null = null;

function client() {
  return new casper.RpcClient(new casper.HttpHandler(config.casper.rpcUrl));
}

/** Dictionary item key for a field index. */
function itemKey(index: number): string {
  return Buffer.from(casper.byteHash(Uint8Array.from([0, 0, 0, index]))).toString('hex');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function storedValue(raw: any): any {
  return raw?.stored_value ?? raw?.result?.stored_value ?? raw?.StoredValue;
}

/** Decode Odra's stored bytes (a `Vec<u8>` CLValue: 4-byte LE length + payload). */
function inner(bytesHex: string): string {
  return bytesHex.slice(8); // strip the 4-byte length prefix
}
function parseU32(bytesHex: string): number {
  const le = inner(bytesHex).slice(0, 8);
  const be = le.match(/../g)?.reverse().join('') ?? '0';
  return parseInt(be, 16) || 0;
}
function parseBool(bytesHex: string): boolean {
  return inner(bytesHex).slice(0, 2) !== '00';
}

/** Resolve (and cache) the contract hash + state dictionary uref from the package. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveState(rpc: any, srh: string, pkgHex: string) {
  if (resolved) return resolved;
  const pkg = await rpc.queryGlobalStateByStateHash(srh, `hash-${pkgHex}`, []);
  const versions = storedValue(pkg.rawJSON)?.ContractPackage?.versions ?? [];
  const contractHash: string | undefined = versions[versions.length - 1]?.contract_hash;
  if (!contractHash) throw new Error('no contract version found for package');
  const cHex = contractHash.replace(/^contract-/, '');
  const contract = await rpc.queryGlobalStateByStateHash(srh, `hash-${cHex}`, []);
  const stateKey = (storedValue(contract.rawJSON)?.Contract?.named_keys ?? []).find(
    (k: { name: string }) => k.name === 'state',
  );
  if (!stateKey?.key) throw new Error('no "state" named key on contract');
  resolved = { contractHash: cHex, stateUref: stateKey.key };
  return resolved;
}

/**
 * Read live vault state (paused + rebalance count) from Casper. Falls back to
 * zeros if the contract isn't configured or the node is unreachable — a read
 * failure must never break the dashboard or the agent loop.
 */
export async function readVaultState(): Promise<VaultState> {
  const fallback: VaultState = {
    paused: false,
    rebalanceCount: 0,
    contractHash: config.casper.vaultContractHash,
  };
  if (!config.casper.vaultContractHash) return fallback;
  try {
    const rpc = client();
    const srh = (await rpc.getStateRootHashLatest()).stateRootHash.toHex();
    const { stateUref } = await resolveState(rpc, srh, config.casper.vaultContractHash);
    const read = async (index: number): Promise<string | undefined> => {
      const res = await rpc.getDictionaryItem(srh, stateUref, itemKey(index));
      return storedValue(res.rawJSON)?.CLValue?.bytes;
    };
    const [rc, pz] = await Promise.all([read(FIELD_INDEX.rebalanceCount), read(FIELD_INDEX.paused)]);
    return {
      paused: pz ? parseBool(pz) : false,
      rebalanceCount: rc ? parseU32(rc) : 0,
      contractHash: config.casper.vaultContractHash,
    };
  } catch (err) {
    log.warn('readVaultState failed; returning fallback', { err: String(err) });
    return fallback;
  }
}

let lastRead: { at: number; value: VaultState } | null = null;

/** Cached read (default 8s TTL) so polling the dashboard doesn't hammer the node. */
export async function readVaultStateCached(ttlMs = 8000): Promise<VaultState> {
  const now = Date.now();
  if (lastRead && now - lastRead.at < ttlMs) return lastRead.value;
  const value = await readVaultState();
  lastRead = { at: now, value };
  return value;
}
