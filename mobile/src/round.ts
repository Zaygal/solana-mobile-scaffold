/**
 * The daily round: one stake, one act, one outcome, per UTC day.
 *
 * Everything here is pure. No timers, no I/O, no clock reads except the ones
 * passed in, so the burn rule can be reasoned about and tested directly. The
 * rule that matters most is that a round can only be sealed by a qualifying
 * act performed inside its own day: nothing in this module can be talked into
 * sealing a day that did not happen.
 */

/** A round is identified by the UTC day it belongs to, e.g. "2026-10-04". */
export type RoundId = string;

export type RoundState =
  | 'open' // today, awaiting the act
  | 'sealed' // the act was done and the day was written on-chain
  | 'burned'; // the day ended with no qualifying act; the stake is gone

export type ActKind = 'motion';

export type ActMetrics = {
  /** Peak movement observed during the window, in the attestor's own units. */
  peak: number;
  /** How long the act was observed for. */
  durationMs: number;
  /** Which mechanism produced this, so the UI can be honest about it. */
  /**
   * Which mechanism produced the observation. `recovery` is not an observation at
   * all: it is a day repaired by paying a fee, and it is marked so on-chain so it
   * can never be counted as a day someone showed up.
   */
  source: 'device-sensor' | 'camera' | 'manual' | 'recovery';
};

export type DayRecord = {
  roundId: RoundId;
  stakeLamports: number;
  state: RoundState;
  /** Present only once sealed. */
  signature?: string;
  sealedAtIso?: string;
  metrics?: ActMetrics;
};

/** UTC day key. Deliberately not local time: the round must not depend on the phone's timezone. */
export function roundIdFor(when: Date): RoundId {
  const y = when.getUTCFullYear();
  const m = String(when.getUTCMonth() + 1).padStart(2, '0');
  const d = String(when.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function nextRoundId(roundId: RoundId): RoundId {
  const [y, m, d] = roundId.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return roundIdFor(next);
}

export function previousRoundId(roundId: RoundId): RoundId {
  const [y, m, d] = roundId.split('-').map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d - 1));
  return roundIdFor(prev);
}

/** Milliseconds remaining in the round's UTC day. Zero means the day is over. */
export function msLeftInRound(roundId: RoundId, now: Date): number {
  const [y, m, d] = roundId.split('-').map(Number);
  const endOfDay = Date.UTC(y, m - 1, d + 1);
  return Math.max(0, endOfDay - now.getTime());
}

export const ACT_REQUIREMENT = {
  kind: 'motion' as ActKind,
  /** Movement required to qualify. Tuned to be achievable, not trivially so. */
  threshold: 0.35,
  /** How long the act must be sustained. */
  windowMs: 10_000,
  /** Time allowed to attempt it, so the UI can show a countdown. */
  attemptMs: 30_000,
};

export type ActOutcome = {
  satisfied: boolean;
  metrics: ActMetrics;
  /** Human-readable reason, shown to the user rather than hidden. */
  reason: string;
};

/**
 * Decide whether an observed act qualifies.
 *
 * Kept separate from the attestor so the judgement can be tested without a
 * device, and so the UI can explain a rejection instead of just failing.
 */
export function qualifies(metrics: ActMetrics): ActOutcome {
  if (metrics.durationMs < ACT_REQUIREMENT.windowMs) {
    return {
      satisfied: false,
      metrics,
      reason: `held for ${Math.round(metrics.durationMs / 1000)}s of the required ${
        ACT_REQUIREMENT.windowMs / 1000
      }s`,
    };
  }
  if (metrics.peak < ACT_REQUIREMENT.threshold) {
    return {satisfied: false, metrics, reason: 'movement was below the threshold'};
  }
  return {satisfied: true, metrics, reason: 'act qualified'};
}

/**
 * Settle every open round whose day has already ended. This is the burn, and it
 * is applied to past days only: today's round stays open until its own day ends.
 */
export function settleExpired(records: DayRecord[], now: Date): DayRecord[] {
  const today = roundIdFor(now);
  return records.map(r =>
    r.state === 'open' && r.roundId < today ? {...r, state: 'burned' as RoundState} : r,
  );
}

export type SealInput = {
  records: DayRecord[];
  outcome: ActOutcome;
  roundId: RoundId;
  signature: string;
  now: Date;
};

/**
 * Seal a day. Refuses when the act did not qualify, when the round is not
 * today's, or when it is already settled. A seal is only ever produced by a
 * qualifying act inside its own day.
 */
export function sealDay(input: SealInput): DayRecord[] {
  const {records, outcome, roundId, signature, now} = input;
  if (!outcome.satisfied) throw new Error(`refusing to seal: ${outcome.reason}`);
  if (roundId !== roundIdFor(now)) throw new Error('refusing to seal: not the current round');
  const existing = records.find(r => r.roundId === roundId);
  if (existing && existing.state !== 'open') throw new Error('refusing to reseal a settled round');

  const sealed: DayRecord = {
    roundId,
    stakeLamports: existing?.stakeLamports ?? 0,
    state: 'sealed',
    signature,
    sealedAtIso: now.toISOString(),
    metrics: outcome.metrics,
  };
  return [...records.filter(r => r.roundId !== roundId), sealed].sort((a, b) =>
    a.roundId < b.roundId ? -1 : 1,
  );
}

/** Consecutive sealed days ending today (or yesterday, if today is still open). */
export function streak(records: DayRecord[], now: Date): number {
  const byId = new Map(records.map(r => [r.roundId, r]));
  const today = roundIdFor(now);
  let cursor = byId.get(today)?.state === 'sealed' ? today : previousRoundId(today);
  let count = 0;
  while (byId.get(cursor)?.state === 'sealed') {
    count += 1;
    cursor = previousRoundId(cursor);
  }
  return count;
}

/** Totals for the history screen. Real numbers only, no projections. */
export function totals(records: DayRecord[]) {
  return records.reduce(
    (acc, r) => {
      if (r.state === 'sealed') acc.sealed += 1;
      if (r.state === 'burned') {
        acc.burned += 1;
        acc.burnedLamports += r.stakeLamports;
      }
      return acc;
    },
    {sealed: 0, burned: 0, burnedLamports: 0},
  );
}
