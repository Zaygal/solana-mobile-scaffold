import {Buffer} from 'buffer';
import {transact} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import {APP_IDENTITY, CLUSTER} from './config';

const TAG = 'MWASCAFFOLD';

/**
 * Mobile Wallet Adapter returns account addresses base64-encoded. Decoding
 * them with anything other than base64 yields a valid-looking but wrong key,
 * which fails much later as an opaque signing error.
 */
function decodeAddress(address: string): PublicKey {
  return new PublicKey(Buffer.from(address, 'base64'));
}

/**
 * The authorization from the last successful `authorize`.
 *
 * This exists because a `transact` session is not shared: the one that authorised
 * the wallet has already closed by the time a transaction is sent. Signing inside
 * a *new* session without authorising in that session is why tapping "Open
 * today's round" opened Phantom and then showed no approval sheet - the wallet had
 * no authorised session to attach the request to. The wallet's own history
 * confirms nothing was ever signed from this app.
 */
let sessionAuthToken: string | undefined;

/**
 * The wallet must be authorised inside the same session that signs.
 *
 * Reauthorisation is silent when the token is still good, which keeps the normal
 * path to a single approval sheet (the transaction). A stale token falls back to
 * a fresh `authorize`, because the original comment on this file was right that
 * `reauthorize` fails without a clear error once its token has gone.
 */
async function ensureAuthorized(wallet: any): Promise<void> {
  if (sessionAuthToken) {
    try {
      const auth = await wallet.reauthorize({
        auth_token: sessionAuthToken,
        identity: APP_IDENTITY,
      });
      if (auth?.auth_token) sessionAuthToken = auth.auth_token;
      return;
    } catch {
      // Stale or rejected token: fall through to a full authorisation.
    }
  }
  const auth = await wallet.authorize({chain: CLUSTER, identity: APP_IDENTITY});
  if (auth?.auth_token) sessionAuthToken = auth.auth_token;
}

export type Authorized = {
  address: string;      // base58
  walletUriBase?: string;
  authToken?: string;
};

/**
 * Establish an MWA session and read the authorising account.
 *
 * Note: `reauthorize` is silent and fails without a clear error when its token
 * has gone stale, so the scaffold always calls `authorize` and keeps the
 * session short-lived rather than caching a token across launches.
 */
export async function connectWallet(): Promise<Authorized> {
  return transact(async wallet => {
    const auth = await wallet.authorize({
      chain: CLUSTER,
      identity: APP_IDENTITY,
    });
    const account = auth.accounts?.[0];
    if (!account) throw new Error('Wallet authorised but returned no accounts');
    const address = decodeAddress(account.address).toBase58();
    sessionAuthToken = auth.auth_token;
    console.log(TAG, 'authorize-ok', address);
    return {
      address,
      walletUriBase: auth.wallet_uri_base,
      authToken: auth.auth_token,
    };
  });
}

/**
 * Send a real devnet transaction from the wallet.
 *
 * `signAndSendTransactions` is used deliberately: `signTransactions` is
 * deprecated, and support for `signTransaction` in the mock wallet is
 * unverified. Passing `minContextSlot` avoids the "payloads invalid" failure
 * caused by a blockhash that expired while the approval sheet was open.
 *
 * This path was previously described here as proven. It was not: the wallet's
 * devnet history contains one inbound airdrop and no outbound transaction, so it
 * had never once produced a signature. It was missing an authorisation inside
 * its own session.
 */
export async function sendTestTransfer(params: {
  connection: Connection;
  fromAddress: string;
  lamports: number;
}): Promise<string> {
  const {connection, fromAddress, lamports} = params;
  const from = new PublicKey(fromAddress);

  // `getLatestBlockhash` returns the unwrapped result, not the raw RPC
  // envelope. Fetch the slot separately for `minContextSlot`, which keeps the
  // blockhash valid while the approval sheet is open.
  const [latest, slot] = await Promise.all([
    connection.getLatestBlockhash('confirmed'),
    connection.getSlot('confirmed'),
  ]);
  const transaction = new Transaction({
    feePayer: from,
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
  }).add(
    SystemProgram.transfer({fromPubkey: from, toPubkey: from, lamports}),
  );

  return transact(async wallet => {
    // Authorise inside THIS session before signing. Without it the wallet had
    // no session to attach the signing request to and silently showed nothing.
    await ensureAuthorized(wallet);
    const [signature] = await wallet.signAndSendTransactions({
      transactions: [transaction],
      minContextSlot: slot,
    });
    console.log(TAG, 'sent', signature);
    return signature;
  });
}

/**
 * Sign and send an arbitrary instruction set.
 *
 * Added rather than replaced: the existing `sendTestTransfer` stays exactly as
 * it is, because it is the proven path and the devnet commitment transaction
 * still uses it. This is a sibling for the seal, which is a memo instruction
 * rather than a transfer.
 *
 * The same two traps are handled here as in the transfer path: a stale
 * blockhash while the approval sheet is open (hence `minContextSlot`), and
 * `signAndSendTransactions` rather than the deprecated signing calls.
 */
export async function signAndSendInstructions(params: {
  connection: Connection;
  fromAddress: string;
  instructions: TransactionInstruction[];
}): Promise<string> {
  const {connection, fromAddress, instructions} = params;
  const from = new PublicKey(fromAddress);

  const [latest, slot] = await Promise.all([
    connection.getLatestBlockhash('confirmed'),
    connection.getSlot('confirmed'),
  ]);
  const transaction = new Transaction({
    feePayer: from,
    blockhash: latest.blockhash,
    lastValidBlockHeight: latest.lastValidBlockHeight,
  }).add(...instructions);

  return transact(async wallet => {
    await ensureAuthorized(wallet);
    const [signature] = await wallet.signAndSendTransactions({
      transactions: [transaction],
      minContextSlot: slot,
    });
    console.log(TAG, 'sealed', signature);
    return signature;
  });
}

export const solToLamports = (sol: number) => Math.round(sol * LAMPORTS_PER_SOL);
