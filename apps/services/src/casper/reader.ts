// Reads are done over plain JSON-RPC (fetch) rather than casper-js-sdk's RPC
// client: the SDK serializes requests with typedjson, which breaks under
// `tsx watch` (HMR re-registers classes and the decorator metadata mismatches).
// We only borrow the SDK's pure `byteHash` (blake2b) for the storage-key derivation.
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
 * declaration order starting at 1 (index 0 is reserved): for CaliberVault that is
 * owner=1, policy_ref=2, policy_version=3, paused=4, rebalance_count=5.
 */
const FIELD_INDEX = { paused: 4, rebalanceCount: 5 } as const;

let resolved: { contractHash: string; stateUref: string } | null = null;

/** Dictionary item key for a field index. */
function itemKey(index: number): string {
  return Buffer.from(casper.byteHash(Uint8Array.from([0, 0, 0, index]))).toString('hex');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function rpc(method: string, params: unknown): Promise<any> {
  const res = await fetch(config.casper.rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`rpc ${method} http ${res.status}`);
  const json = (await res.json()) as { result?: unknown; error?: { message: string } };
  if (json.error) throw new Error(`rpc ${method}: ${json.error.message}`);
  return json.result;
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
async function resolveState(srh: string, pkgHex: string) {
  if (resolved) return resolved;
  const pkg = await rpc('query_global_state', {
    state_identifier: { StateRootHash: srh },
    key: `hash-${pkgHex}`,
    path: [],
  });
  const versions = pkg?.stored_value?.ContractPackage?.versions ?? [];
  const contractHash: string | undefined = versions[versions.length - 1]?.contract_hash;
  if (!contractHash) throw new Error('no contract version found for package');
  const cHex = contractHash.replace(/^contract-/, '');
  const contract = await rpc('query_global_state', {
    state_identifier: { StateRootHash: srh },
    key: `hash-${cHex}`,
    path: [],
  });
  const stateKey = (contract?.stored_value?.Contract?.named_keys ?? []).find(
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
    const srh: string = (await rpc('chain_get_state_root_hash', {})).state_root_hash;
    const { stateUref } = await resolveState(srh, config.casper.vaultContractHash);
    const read = async (index: number): Promise<string | undefined> => {
      const r = await rpc('state_get_dictionary_item', {
        state_root_hash: srh,
        dictionary_identifier: { URef: { seed_uref: stateUref, dictionary_item_key: itemKey(index) } },
      });
      return r?.stored_value?.CLValue?.bytes;
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
