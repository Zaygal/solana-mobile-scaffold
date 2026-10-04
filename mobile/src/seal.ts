/**
 * The on-chain seal.
 *
 * Why this exists: the round engine (`round.ts`) can decide that a day was
 * earned, but a decision stored only on the phone is a claim, not evidence.
 * Every other habit product owns your streak in its own database and can edit
 * it, restore it, or sell you a repair. This module turns a round into a
 * canonical, self-describing transaction payload whose whole value is that it
 * cannot be back-dated, edited, or issued by anyone but the participant.
 *
 * What it proves, stated exactly:
 *   PROVES     the holder of this wallet signed this round record, at this
 *              block time, and that the sequence of records is unbroken.
 *   DOES NOT   prove that a physical act actually happened. A sensor reading
 *   PROVE      is attestable at best, spoilable at worst, and the app is
 *              required to publish which mechanism produced it (`source`).
 *              We would rather ship that limit visibly than imply a guarantee
 *              the device cannot make.
 *
 * Transport: the SPL Memo program (MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr),
 * verified present and executable on devnet by direct account probe rather
 * than from documentation. It needs no program of our own to deploy, costs a
 * fee and no rent, and is readable by any explorer or any script - which is
 * the point: the verifier must not have to trust us.
 *
 * Never claim more than the four rows above. In particular, this payload is
 * not a burn and not an escrow: nothing here can move a user's funds.
 */

import {RoundId, ActKind, ActMetrics} from './round';

/** Version tag first so a future format change is detectable, not ambiguous. */
export const SEAL_PREFIX = 'clock1';
export const SEAL_VERSION = 1;

/** Field separator. Chosen because it cannot appear in any field's own values. */
const SEP = '|';

/** The SPL Memo program, verified executable on devnet by account probe. */
export const MEMO_PROGRAM_ID = 'MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr';

/** Memo size ceiling is 566 bytes; a seal is ~60. Kept well clear, by design. */
export const MEMO_SAFE_BYTES = 512;

export type SealRecord = {
  roundId: RoundId;
  act: ActKind;
  durationMs: number;
  /** Peak movement x1000, integer, so the payload has no float formatting drift. */
  peakMilli: number;
  /** Which mechanism produced the observation. Travels with the record. */
  source: ActMetrics['source'];
  version: number;
};

/**
 * Canonical encoding. Deliberately a fixed positional format rather than JSON:
 * key order, whitespace and float formatting are all ways a JSON payload can
 * differ between two honest implementations, and a verifier that has to parse
 * loosely is a verifier that can be fooled.
 */
export function encodeSeal(record: SealRecord): string {
  const parts = [
    SEAL_PREFIX,
    record.roundId,
    record.act,
    String(Math.round(record.durationMs)),
    String(Math.round(record.peakMilli)),
    record.source,
    String(record.version ?? SEAL_VERSION),
  ];
  const payload = parts.join(SEP);
  if (Buffer.byteLength(payload, 'utf8') > MEMO_SAFE_BYTES) {
    throw new Error(`seal payload ${payload.length} bytes exceeds the safe memo budget`);
  }
  return payload;
}

/** Returns null rather than throwing: callers scan whole wallet histories. */
export function decodeSeal(memo: string): SealRecord | null {
  if (typeof memo !== 'string') return null;
  const parts = memo.trim().split(SEP);
  if (parts.length !== 7) return null;
  const [prefix, roundId, act, dur, peak, source, version] = parts;
  if (prefix !== SEAL_PREFIX) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(roundId)) return null;
  if (act !== 'motion') return null;
  if (!['device-sensor', 'camera', 'manual'].includes(source)) return null;
  if (!/^\d+$/.test(dur) || !/^\d+$/.test(peak) || !/^\d+$/.test(version)) return null;
  return {
    roundId,
    act,
    durationMs: Number(dur),
    peakMilli: Number(peak),
    source: source as SealRecord['source'],
    version: Number(version),
  };
}

/** Build the seal for a round that qualified. Mirrors `sealDay`'s conditions. */
export function sealFromOutcome(roundId: RoundId, metrics: ActMetrics, version = SEAL_VERSION): SealRecord {
  return {
    roundId,
    act: 'motion',
    durationMs: metrics.durationMs,
    peakMilli: Math.round(metrics.peak * 1000),
    source: metrics.source,
    version,
  };
}

export type StreakReading = {
  /** Consecutive sealed days ending at the most recent seal. */
  length: number;
  /** The most recent sealed day, or null when nothing is sealed. */
  latest: RoundId | null;
  /** Every sealed day, ascending. The verifier renders this, not just the count. */
  days: RoundId[];
};

/**
 * Rebuild the streak from seals alone.
 *
 * This is the artifact the whole submission rests on: given nothing but a
 * wallet's transaction history, this returns the same answer we display. A
 * reading that only the app's own database can produce is the thing we are
 * claiming to be different from, so the computation is kept here, pure, and
 * mirrored exactly by the standalone verifier.
 *
 * Duplicate seals for one day collapse to one. Out-of-order input is sorted,
 * because RPC responses are not guaranteed to be ordered and a verifier that
 * silently depends on ordering is a verifier that reports a broken streak on a
 * different RPC.
 */
export function streakFromSeals(records: SealRecord[]): StreakReading {
  const days = Array.from(new Set(records.map(r => r.roundId))).sort();
  if (days.length === 0) return {length: 0, latest: null, days: []};

  let length = 1;
  for (let i = days.length - 1; i > 0; i--) {
    if (previousDayOf(days[i]) === days[i - 1]) length++;
    else break;
  }
  return {length, latest: days[days.length - 1], days};
}

/** The UTC day before the given day key. Local to this module by design. */
function previousDayOf(roundId: RoundId): RoundId {
  const [y, m, d] = roundId.split('-').map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d - 1));
  return [
    prev.getUTCFullYear(),
    String(prev.getUTCMonth() + 1).padStart(2, '0'),
    String(prev.getUTCDate()).padStart(2, '0'),
  ].join('-');
}
