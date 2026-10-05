/**
 * Which wallet applications are actually on this device.
 *
 * An earlier instruction forbids faking wallet discovery, and this redesign asks
 * for a wallet chooser. Both are honoured by asking the platform rather than
 * drawing a list: each scheme below is probed with Linking.canOpenURL, which on
 * Android 11+ only answers for applications the manifest declares an interest in
 * (see <queries> in AndroidManifest.xml).
 *
 * Detection decides what the chooser *offers*. It never stands in for connecting:
 * Mobile Wallet Adapter still performs the connection, and the platform still
 * owns the approval. Nothing here imitates either.
 */

import {Linking} from 'react-native';

export type Wallet = {name: string; scheme: string; install: string};

/** Names are labels for what is genuinely found, not a hard-coded picker. */
export const KNOWN: Wallet[] = [
  {name: 'Phantom', scheme: 'phantom://', install: 'https://phantom.app/download'},
  {name: 'Solflare', scheme: 'solflare://', install: 'https://solflare.com/download'},
  {name: 'Backpack', scheme: 'backpack://', install: 'https://backpack.app/downloads'},
];

export async function detectWallets(): Promise<{found: Wallet[]; missing: Wallet[]}> {
  const found: Wallet[] = [];
  const missing: Wallet[] = [];
  for (const w of KNOWN) {
    let ok = false;
    try {
      ok = await Linking.canOpenURL(w.scheme);
    } catch {
      ok = false;
    }
    (ok ? found : missing).push(w);
  }
  return {found, missing};
}
