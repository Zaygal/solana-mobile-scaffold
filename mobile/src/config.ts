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

export const EXPLORER = (signature: string) =>
  `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
