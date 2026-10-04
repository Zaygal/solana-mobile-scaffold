/**
 * Device-local state.
 *
 * What this is: a cache and a notebook. It exists so the screen can paint
 * instantly on launch and so an in-flight attempt survives a restart.
 *
 * What this is NOT: proof of anything. Every field here can be edited by
 * anyone with access to the device, so nothing in it may ever be presented as
 * evidence of a sealed day. The streak that matters is the one `streakFromSeals`
 * rebuilds from transaction history - this file only stores what we last saw.
 *
 * Deliberately one key and one blob. A schema, a migration system or a table
 * set would be infrastructure this product does not need, and every added
 * store is one more thing that can disagree with the chain.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {SealRecord} from './seal';

const KEY = 'clockin.state.v1';

export type AttemptState = {
  roundId: string;
  startedAtIso: string;
  /** Which mechanism will produce the observation. Recorded at attempt time. */
  source: 'device-sensor' | 'camera' | 'manual';
};

export type CachedChain = {
  address: string;
  fetchedAtIso: string;
  seals: SealRecord[];
  /** Signatures of the transactions the seals above were read from. */
  signatures: string[];
};

export type PersistedState = {
  version: 1;
  attempt?: AttemptState | null;
  cache?: CachedChain | null;
  /** Signature of the devnet commitment transaction for a round, if made. */
  commitments?: Record<string, string>;
};

const EMPTY: PersistedState = {version: 1, attempt: null, cache: null, commitments: {}};

export async function loadState(): Promise<PersistedState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return {...EMPTY};
    const parsed = JSON.parse(raw) as PersistedState;
    // A version mismatch is discarded rather than migrated: the chain is the
    // source of truth, so losing a cache costs a refetch and nothing more.
    if (parsed?.version !== 1) return {...EMPTY};
    return {
      version: 1,
      attempt: parsed.attempt ?? null,
      cache: parsed.cache ?? null,
      commitments: parsed.commitments ?? {},
    };
  } catch {
    return {...EMPTY};
  }
}

export async function saveState(next: PersistedState): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage failing must never break the round. The chain still has the
    // record; this is only a cache.
  }
}

/**
 * The demo hook the whole verifiability claim depends on: wipe everything this
 * device knows and require the streak to be rebuilt from the chain alone.
 * Exposed in the UI because "the app says so" is exactly the claim we refuse.
 */
export async function clearLocalState(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
