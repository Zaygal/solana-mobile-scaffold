/**
 * Streak recovery.
 *
 * The rule that shapes everything here: **a repaired day is not a day shown up
 * for.** Recovery writes its own record with `source: 'recovery'`, the app shows
 * how many of a streak were repaired, and the standalone verifier counts them
 * separately. A paid repair that produced an indistinguishable record would make
 * the product's central claim false, and this project exists to avoid exactly
 * that.
 *
 * The pricing is deliberately unpleasant in the way a repair should be: the
 * further back the day is, and the longer the run of days missed around it, the
 * more it costs. Cheap repair would make missing a day the rational choice, and a
 * streak you can buy back at no cost is not a streak.
 *
 * Everything in this module is pure. Nothing here touches the network, so the
 * whole economic model is testable in CI without a chain.
 */

import {
  DEV_WALLET,
  RECOVERY_BASE_LAMPORTS,
  RECOVERY_CU_LIMIT,
  RECOVERY_DEV_BPS,
  RECOVERY_WINDOW_DAYS,
} from './config';
import {roundIdFor} from './round';

export type RepairQuote = {
  roundId: string;
  /** 1 = yesterday, and so on. */
  daysAgo: number;
  /** How long the unbroken run of missed days containing this one is. */
  runLength: number;
  /** Total charged, in lamports. */
  totalLamports: number;
  /** Transferred to the dev wallet. */
  devLamports: number;
  /** Budgeted as priority fee, which goes to the network rather than to anyone. */
  networkLamports: number;
  /** The priority fee expressed the way Solana actually takes it. */
  microLamportsPerCu: number;
  devWallet: string;
};

/** Consecutive missed days ending most recently, newest last. */
export function missedDays(
  sealedRoundIds: string[],
  todayIso: string,
  windowDays = RECOVERY_WINDOW_DAYS,
): string[] {
  const sealed = new Set(sealedRoundIds);
  const out: string[] = [];
  const base = new Date(`${todayIso}T00:00:00.000Z`).getTime();
  for (let back = 1; back <= windowDays; back++) {
    const id = roundIdFor(new Date(base - back * 86_400_000));
    if (!sealed.has(id)) out.push(id);
  }
  return out.reverse(); // oldest first, so a caller repairs in order
}

/**
 * Price one day.
 *
 * Escalation is multiplicative on two axes, both of which are about how badly the
 * user let things slide rather than about extracting money: how far back it is,
 * and how long the surrounding gap is. A single missed yesterday is cheap. The
 * third day of a three-day collapse is not.
 */
export function quoteRepair(params: {
  roundId: string;
  daysAgo: number;
  runLength: number;
  devWallet?: string;
}): RepairQuote {
  const devWallet = params.devWallet ?? DEV_WALLET;
  const daysAgo = Math.max(1, Math.floor(params.daysAgo));
  const runLength = Math.max(1, Math.floor(params.runLength));

  const multiplier = (1 + daysAgo) * runLength;
  const totalLamports = RECOVERY_BASE_LAMPORTS * multiplier;

  const devLamports = Math.floor((totalLamports * RECOVERY_DEV_BPS) / 10_000);
  const networkLamports = totalLamports - devLamports;

  // The network side is not a transfer. It is converted into the only mechanism
  // Solana offers for paying more to land: microlamports per compute unit.
  const microLamportsPerCu = Math.max(1, Math.ceil(networkLamports / RECOVERY_CU_LIMIT));

  return {
    roundId: params.roundId,
    daysAgo,
    runLength,
    totalLamports,
    devLamports,
    networkLamports,
    microLamportsPerCu,
    devWallet,
  };
}

/** Quote every repairable day, priced against the gap each one sits inside. */
export function quoteGap(missed: string[], todayIso: string, devWallet?: string): RepairQuote[] {
  const base = new Date(`${todayIso}T00:00:00.000Z`).getTime();
  const runLength = missed.length;
  return missed.map(roundId => {
    const at = new Date(`${roundId}T00:00:00.000Z`).getTime();
    const daysAgo = Math.round((base - at) / 86_400_000);
    return quoteRepair({roundId, daysAgo, runLength, devWallet});
  });
}

export function totalLamports(quotes: RepairQuote[]): number {
  return quotes.reduce((n, q) => n + q.totalLamports, 0);
}

/** Recovery is off until a dev wallet exists. Never silently route a fee. */
export function recoveryAvailable(devWallet = DEV_WALLET): boolean {
  return typeof devWallet === 'string' && devWallet.length >= 32;
}

export function lamportsToSol(lamports: number): string {
  return (lamports / 1_000_000_000).toFixed(6);
}

/**
 * What a streak is allowed to say about itself once repaired days are in it.
 * The two numbers are never merged into one, because merging them is the lie.
 */
export type StreakHonesty = {
  total: number;
  held: number;
  recovered: number;
  summary: string;
};

export function describeStreak(sources: string[]): StreakHonesty {
  const recovered = sources.filter(s => s === 'recovery').length;
  const held = sources.length - recovered;
  return {
    total: sources.length,
    held,
    recovered,
    summary:
      recovered === 0
        ? `${held} day${held === 1 ? '' : 's'} sealed in a row`
        : `${sources.length} days in the record, ${recovered} of them repaired by payment`,
  };
}
