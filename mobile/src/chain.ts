/**
 * Reading the record back off the chain.
 *
 * This module is the reason the verifier can exist: the same computation runs
 * here and in `verify.mjs` against nothing but an RPC endpoint, so the app has
 * no privileged knowledge. If these two ever disagree, the app is wrong.
 *
 * It reads only what a stranger could read: the wallet's transaction history
 * and the memo instructions inside it. It never consults our local state.
 */

import {Connection, PublicKey} from '@solana/web3.js';
import {MEMO_PROGRAM_ID, SealRecord, decodeSeal} from './seal';

export type ChainReading = {
  /** Decoded seals, ascending by day. */
  seals: SealRecord[];
  /** Seal -> the transaction that carried it. This is the evidence chain. */
  signaturesByDay: Record<string, string>;
  /** Memos that carried our prefix but would not decode. Reported, not hidden. */
  malformed: {signature: string; snippet: string}[];
  /** How many transactions were examined, so the reader can judge coverage. */
  scanned: number;
};

/** Extract the memo payload from a transaction, whichever shape it arrived in. */
function memoFromTransaction(tx: any, memoProgram: string): string | null {
  // Preferred route: read the instruction data directly. This is exact, and it
  // survives RPCs that trim or reshape log output.
  const message = tx?.transaction?.message;
  const keys: any[] = message?.staticAccountKeys ?? message?.accountKeys ?? [];
  const compiled = message?.compiledInstructions;
  if (Array.isArray(compiled)) {
    for (const ix of compiled) {
      const programId = keys[ix.programIdIndex];
      const id = programId?.toBase58 ? programId.toBase58() : String(programId);
      if (id === memoProgram && ix.data) {
        try {
          return Buffer.from(ix.data).toString('utf8');
        } catch {
          return null;
        }
      }
    }
  }
  // Fallback: the memo program logs its payload. Used only when instruction
  // data is unavailable, and quoted back exactly as the chain rendered it.
  const logs: string[] = tx?.meta?.logMessages ?? [];
  for (const line of logs) {
    const m = /Program log: Memo \(len \d+\): (.*)$/.exec(line);
    if (m) {
      const raw = m[1].trim();
      try {
        return raw.startsWith('"') ? JSON.parse(raw) : raw;
      } catch {
        return raw.replace(/^"|"$/g, '');
      }
    }
  }
  return null;
}

/**
 * Walk a wallet's history and rebuild the seal set.
 *
 * Newest-first from the RPC, then sorted ascending by day here, because RPC
 * ordering is not a contract and a verifier that depends on it will report a
 * false broken streak on a different provider.
 */
export async function readSealsFromChain(
  connection: Connection,
  address: string,
  limit = 200,
): Promise<ChainReading> {
  const owner = new PublicKey(address);
  const signatures = await connection.getSignaturesForAddress(owner, {limit});

  const seals: SealRecord[] = [];
  const signaturesByDay: Record<string, string> = {};
  const malformed: {signature: string; snippet: string}[] = [];
  let scanned = 0;

  for (const entry of signatures) {
    if (entry.err) continue; // a failed transaction is not a record
    let tx: any;
    try {
      tx = await connection.getTransaction(entry.signature, {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed',
      });
    } catch {
      continue;
    }
    if (!tx) continue;
    scanned++;

    const memo = memoFromTransaction(tx, MEMO_PROGRAM_ID);
    if (!memo) continue;
    if (!memo.startsWith('clock1')) continue;

    const record = decodeSeal(memo);
    if (!record) {
      // A payload carrying our prefix that will not decode is a finding, not
      // noise: it means something wrote a record this reader cannot account
      // for, and the honest response is to show it.
      malformed.push({signature: entry.signature, snippet: memo.slice(0, 24)});
      continue;
    }
    // First seal seen for a day wins; the RPC returns newest first, so an
    // earlier duplicate does not silently overwrite the recorded one.
    if (!signaturesByDay[record.roundId]) {
      seals.push(record);
      signaturesByDay[record.roundId] = entry.signature;
    }
  }

  seals.sort((a, b) => (a.roundId < b.roundId ? -1 : 1));
  return {seals, signaturesByDay, malformed, scanned};
}
