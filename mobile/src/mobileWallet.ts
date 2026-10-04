import {transact} from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import {PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL} from '@solana/web3.js';
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
 */
export async function sendTestTransfer(params: {
  connection: {getLatestBlockhash: (c?: string) => Promise<{context: {slot: number}; value: {blockhash: string; lastValidBlockHeight: number}}>};
  fromAddress: string;
  lamports: number;
}): Promise<string> {
  const {connection, fromAddress, lamports} = params;
  const from = new PublicKey(fromAddress);

  const {context, value} = await connection.getLatestBlockhash('confirmed');
  const transaction = new Transaction({
    feePayer: from,
    blockhash: value.blockhash,
    lastValidBlockHeight: value.lastValidBlockHeight,
  }).add(
    SystemProgram.transfer({fromPubkey: from, toPubkey: from, lamports}),
  );

  return transact(async wallet => {
    const [signature] = await wallet.signAndSendTransactions({
      transactions: [transaction],
      minContextSlot: context.slot,
    });
    console.log(TAG, 'sent', signature);
    return signature;
  });
}

export const solToLamports = (sol: number) => Math.round(sol * LAMPORTS_PER_SOL);
