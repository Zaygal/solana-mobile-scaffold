/**
 * The round's write path: two transactions, two different meanings.
 *
 * COMMITMENT TRANSACTION - a real devnet transfer, signed when the round is
 *   opened. It costs devnet SOL, which is worth nothing, and it is therefore a
 *   ritual and not a stake. It must never be described as money at risk, and it
 *   is definitively not an escrow: nothing returns it and nothing forfeits it,
 *   because there is no program holding it.
 *
 * ON-CHAIN ROUND SEAL - a memo instruction carrying the canonical round record
 *   from `seal.ts`. This is the load-bearing transaction. It proves the holder
 *   of the wallet signed this record at this block time. It does not prove the
 *   act happened; see the honesty block in `seal.ts`.
 *
 * FUTURE TRUSTLESS ESCROW - not built, and not approximated here. Returning a
 *   stake on a qualifying act and forfeiting it on a miss requires program
 *   authority over the funds. No arrangement of ordinary transactions can do
 *   it, so the app names it as future work instead of gesturing at it.
 */

import {Connection, PublicKey, TransactionInstruction} from '@solana/web3.js';
import {MEMO_PROGRAM_ID, SealRecord, encodeSeal} from './seal';
import {signAndSendInstructions, sendTestTransfer} from './mobileWallet';
import {TRANSFER_LAMPORTS} from './config';

/** The devnet commitment transaction. Reuses the proven transfer path. */
export async function sendCommitment(params: {
  connection: Connection;
  address: string;
  lamports?: number;
}): Promise<string> {
  const {connection, address, lamports = TRANSFER_LAMPORTS} = params;
  return sendTestTransfer({connection, fromAddress: address, lamports});
}

/**
 * The seal.
 *
 * The memo is written with the participant as the sole signer and as a
 * non-writable account, because a seal writes no state: it is a statement, and
 * statements do not need to own anything. Keeping the account read-only means
 * the transaction cannot be mistaken for a state change by anything reading it.
 */
export async function sendSeal(params: {
  connection: Connection;
  address: string;
  record: SealRecord;
}): Promise<string> {
  const {connection, address, record} = params;
  const payload = encodeSeal(record);
  const instruction = new TransactionInstruction({
    programId: new PublicKey(MEMO_PROGRAM_ID),
    keys: [{pubkey: new PublicKey(address), isSigner: true, isWritable: false}],
    data: Buffer.from(payload, 'utf8'),
  });
  return signAndSendInstructions({
    connection,
    fromAddress: address,
    instructions: [instruction],
  });
}
