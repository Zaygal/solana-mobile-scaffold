/** Devnet only. This scaffold never touches mainnet. */
export const RPC_ENDPOINT = 'https://api.devnet.solana.com';
export const CLUSTER = 'solana:devnet' as const;

/** What the wallet shows the user when asked to approve this app. */
export const APP_IDENTITY = {
  name: 'MWA Scaffold',
  uri: 'https://github.com/Zaygal/solana-mobile-scaffold',
  icon: 'favicon.png',
};

export const TRANSFER_LAMPORTS = 100_000; // 0.0001 SOL

/**
 * Streak recovery.
 *
 * A missed day can be repaired by paying a fee, and the repaired day is written
 * on-chain with `source: 'recovery'` so it is never indistinguishable from a day
 * someone actually showed up. That distinction is the product.
 *
 * There is no "gas" to send money to on Solana. Fees are not an auction: a
 * transaction pays a base fee plus an optional PRIORITY fee to the network. So the
 * recovery charge splits into a transfer to the dev wallet and a priority fee that
 * raises what the transaction costs to land. The priority portion is not sent to
 * an address - it is paid to whichever validator lands it, and it is charged
 * whether or not the transaction succeeds.
 *
 * DEV_WALLET is deliberately empty. An unset dev wallet DISABLES recovery rather
 * than routing a fee somewhere invented, and the UI says so instead of failing.
 */
export const DEV_WALLET = '';

/** Base cost of repairing one day, before escalation. */
export const RECOVERY_BASE_LAMPORTS = 2_000_000;

/** Share of the charge that goes to the dev wallet; the rest becomes priority fee. */
export const RECOVERY_DEV_BPS = 7000;

/** Compute budget the recovery transaction requests. */
export const RECOVERY_CU_LIMIT = 200_000;

/** How far back a missed day can still be repaired. */
export const RECOVERY_WINDOW_DAYS = 3;

export const EXPLORER = (signature: string) =>
  `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
