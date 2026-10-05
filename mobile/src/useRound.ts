/**
 * The round, as state and behaviour rather than as a page.
 *
 * This is the logic lifted out of the old RoundScreen without being rewritten:
 * the same chain read, the same commitment, the same hold timing, the same seal,
 * the same persistence. RoundScreen was one component that owned both the loop
 * and a long scrolling document about the loop. The loop is the product; the
 * document was the interface. Splitting them is what lets the loop appear on a
 * tab and the explanation appear where it is asked for.
 *
 * One deliberate difference from the original: `address` may be null. Previously
 * the screen only existed behind a connected wallet, so it could assume one. Now
 * Today is visible to someone who has not connected, which is the entire point of
 * the redesign - nothing here asks for a wallet, it simply reports what it cannot
 * do without one.
 *
 * The chain remains authoritative. Local state is a cache and is labelled as one
 * wherever it is shown.
 */

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Connection} from '@solana/web3.js';
import {
  ACT_REQUIREMENT,
  ActMetrics,
  ActOutcome,
  DayRecord,
  msLeftInRound,
  qualifies,
  roundIdFor,
  settleExpired,
} from './round';
import {selectAttestor} from './act';
import {RPC_ENDPOINT} from './config';
import {sendCommitment, sendSeal} from './sealTx';
import {readSealsFromChain} from './chain';
import {SealRecord, sealFromOutcome, streakFromSeals} from './seal';
import {AttemptState, clearLocalState, loadState, saveState} from './store';

export type Phase =
  | 'loading'
  | 'unconnected'
  | 'open'
  | 'committing'
  | 'holding'
  | 'qualified'
  | 'missed'
  | 'sealing'
  | 'sealed'
  | 'error';

/** The countdown to the end of the UTC day. Real information, not decoration. */
export function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  // Seconds are shown only in the final hour, where a user can actually act on
  // them. Above an hour the minute is the unit that matters, and counting seconds
  // down from twelve hours reads as noise rather than as urgency.
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

export function fmtDay(roundId: string): string {
  const [y, m, d] = roundId.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return `${days[dt.getUTCDay()]} ${d} ${months[m - 1]} ${y}`;
}

export function short(addr: string | null): string {
  if (!addr) return 'no wallet';
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

/** How many days the round has been sealed, and when it last was. */
export type Streak = {length: number; latest: string | null};

export default function useRound(address: string | null) {
  const [now, setNow] = useState(new Date());
  const [phase, setPhase] = useState<Phase>('loading');
  const [status, setStatus] = useState('reading the chain…');
  const [error, setError] = useState<string | null>(null);

  // Chain reading: the authoritative record.
  const [chainSeals, setChainSeals] = useState<SealRecord[]>([]);
  const [signaturesByDay, setSignaturesByDay] = useState<Record<string, string>>({});
  const [malformed, setMalformed] = useState<{signature: string; snippet: string}[]>([]);
  const [chainReadAt, setChainReadAt] = useState<string | null>(null);
  const [scanned, setScanned] = useState(0);
  const [reading, setReading] = useState(false);

  // Local notebook: a cache and today's in-flight attempt. Never evidence.
  const [attempt, setAttempt] = useState<AttemptState | null>(null);
  const [commitments, setCommitments] = useState<Record<string, string>>({});
  const [localCacheUsed, setLocalCacheUsed] = useState(false);

  const [outcome, setOutcome] = useState<ActOutcome | null>(null);
  const [sealSignature, setSealSignature] = useState<string | null>(null);
  const [attestorSource, setAttestorSource] = useState<ActMetrics['source']>('manual');

  const holdStartRef = useRef<number | null>(null);
  const roundId = useMemo(() => roundIdFor(now), [now]);
  const msLeft = useMemo(() => msLeftInRound(roundId, now), [roundId, now]);

  // The UTC day boundary is a real deadline in this product, so the countdown is
  // information the user acts on rather than decoration - but it does not need a
  // re-render every second to say so. Above the final hour it ticks every thirty
  // seconds, which is the resolution of the thing being displayed; inside the
  // final hour it ticks every second, where seconds are the point.
  //
  // This is not a micro-optimisation. Re-rendering once a second for a twelve-hour
  // countdown keeps the view permanently non-idle, which drains battery and stops
  // accessibility tooling from ever reading the screen - the same reason Android's
  // own uiautomator refuses to dump this screen ("could not get idle state").
  const finalHour = msLeft <= 60 * 60 * 1000;

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), finalHour ? 1000 : 30000);
    return () => clearInterval(t);
  }, [finalHour]);

  const refreshFromChain = useCallback(async (addr: string | null) => {
    if (!addr) return null;
    const connection = new Connection(RPC_ENDPOINT, 'confirmed');
    setReading(true);
    setStatus('reading the chain…');
    try {
      const reading = await readSealsFromChain(connection, addr);
      setChainSeals(reading.seals);
      setSignaturesByDay(reading.signaturesByDay);
      setMalformed(reading.malformed);
      setChainReadAt(new Date().toISOString());
      setScanned(reading.scanned);
      setLocalCacheUsed(false);
      setStatus('chain read');
      return reading;
    } catch (e: any) {
      // Falling back to the cache is allowed, but it is labelled on screen.
      // A cached streak presented as the chain's would be the exact overclaim
      // this product exists to avoid.
      setLocalCacheUsed(true);
      setStatus('devnet unreachable');
      return null;
    } finally {
      setReading(false);
    }
  }, []);

  // Boot: read local state first so the screen paints, then ask the chain.
  useEffect(() => {
    (async () => {
      const persisted = await loadState();
      setAttempt(persisted.attempt ?? null);
      setCommitments(persisted.commitments ?? {});

      // Ask which attestor actually exists on this device and publish that,
      // rather than assuming. `selectAttestor` reports what it can really do,
      // and the value it returns travels into the on-chain record.
      try {
        const attestor = await selectAttestor();
        setAttestorSource(attestor.source);
      } catch {
        setError('No attestor is available on this device, so no round can be attested.');
      }
      if (persisted.cache?.seals?.length) {
        setChainSeals(persisted.cache.seals);
        setLocalCacheUsed(true);
      }
      // Nothing here opens a wallet flow. This reports on an address it was
      // given; it never asks for one.
      setPhase(address ? 'open' : 'unconnected');
      await refreshFromChain(address);
    })();
  }, [refreshFromChain]);

  // Re-read when the shell hands over a wallet it did not have before. Skips its
  // first run: the boot effect above already read for the initial address, and
  // firing both would double every RPC round-trip on mount.
  const seenFirstAddress = useRef(false);
  useEffect(() => {
    if (!seenFirstAddress.current) {
      seenFirstAddress.current = true;
      return;
    }
    if (address) {
      setPhase(p => (p === 'unconnected' ? 'open' : p));
      refreshFromChain(address);
    } else {
      setPhase('unconnected');
    }
  }, [address, refreshFromChain]);

  const persist = useCallback(
    async (patch: Partial<{attempt: AttemptState | null; commitments: Record<string, string>}>) => {
      const current = await loadState();
      await saveState({
        ...current,
        attempt: patch.attempt !== undefined ? patch.attempt : current.attempt,
        commitments: patch.commitments ?? current.commitments,
      });
    },
    [],
  );

  /** Step 1 of the loop: a real devnet transaction, labelled as a ritual. */
  const onOpenRound = useCallback(async () => {
    if (!address) return;
    setError(null);
    setPhase('committing');
    setStatus('waiting for wallet approval…');
    try {
      const connection = new Connection(RPC_ENDPOINT, 'confirmed');
      const signature = await sendCommitment({connection, address});
      const nextCommitments = {...commitments, [roundId]: signature};
      const nextAttempt: AttemptState = {
        roundId,
        startedAtIso: new Date().toISOString(),
        source: attestorSource,
      };
      setCommitments(nextCommitments);
      setAttempt(nextAttempt);
      await persist({commitments: nextCommitments, attempt: nextAttempt});
      setPhase('open');
      setStatus('commitment signed');
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setStatus('commitment not signed');
      setPhase('open');
    }
  }, [address, commitments, persist, roundId, attestorSource]);

  /** Step 2 and 3: observe, then judge the observation. */
  const onHoldStart = useCallback(() => {
    holdStartRef.current = Date.now();
    setPhase('holding');
    setStatus('holding…');
  }, []);

  const onHoldEnd = useCallback(async () => {
    const startedAt = holdStartRef.current;
    holdStartRef.current = null;
    if (startedAt == null) return;
    const elapsed = Date.now() - startedAt;

    // Whatever the result, it is reported as the attestor's `source` says it
    // was produced. Right now that is a held button, so it is `manual`.
    const metrics: ActMetrics = {
      peak: elapsed >= ACT_REQUIREMENT.windowMs ? 1 : 0,
      durationMs: elapsed,
      source: attestorSource,
    };
    const verdict = qualifies(metrics);
    setOutcome(verdict);
    setPhase(verdict.satisfied ? 'qualified' : 'open');
    setStatus(verdict.satisfied ? 'act qualified' : 'act did not qualify');
  }, [attestorSource]);

  const onForgetDevice = useCallback(async () => {
    await clearLocalState();
    setAttempt(null);
    setCommitments({});
    setOutcome(null);
    setSealSignature(null);
    await refreshFromChain(address);
    setStatus('device copy deleted — streak rebuilt from the chain');
  }, [address, refreshFromChain]);

  /** Step 4: write the day on-chain. The only irreversible step. */
  const onSeal = useCallback(async () => {
    if (!address || !outcome?.satisfied) return;
    setError(null);
    setPhase('sealing');
    setStatus('waiting for wallet approval…');
    try {
      const connection = new Connection(RPC_ENDPOINT, 'confirmed');
      const record = sealFromOutcome(roundId, outcome.metrics);
      const signature = await sendSeal({connection, address, record});
      setSealSignature(signature);
      setPhase('sealed');
      setStatus('sealed on devnet');
      setAttempt(null);
      await persist({attempt: null});
      await refreshFromChain(address);
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setStatus('seal not signed');
      setPhase('qualified');
    }
  }, [address, outcome, persist, refreshFromChain, roundId]);

  // Chain is the record; local state is a cache, and the streak is computed the
  // same way here as in the standalone verifier.
  const streak: Streak = useMemo(() => streakFromSeals(chainSeals), [chainSeals]);
  const todaySealed = useMemo(
    () => chainSeals.some(s => s.roundId === roundId),
    [chainSeals, roundId],
  );

  const settledDays: DayRecord[] = useMemo(() => {
    return chainSeals.map(s => ({
      roundId: s.roundId,
      stakeLamports: 0,
      state: 'sealed' as const,
      signature: signaturesByDay[s.roundId],
      metrics: {peak: s.peakMilli / 1000, durationMs: s.durationMs, source: s.source},
    }));
  }, [chainSeals, signaturesByDay]);

  // Yesterday and earlier are settled by the same rule the engine defines.
  const withBurns = useMemo(() => settleExpired(settledDays, now), [settledDays, now]);

  // The state as a sentence, because the boundary is information the user acts
  // on rather than a badge.
  const stateLine = !address
    ? 'Nothing is stored on this device. Sealing is the only step that needs a wallet.'
    : todaySealed
    ? 'Sealed. Today is on the record.'
    : outcome?.satisfied
    ? 'The act qualified. Seal the day to finish the round.'
    : msLeft === 0
    ? 'This round closed without an act.'
    : `Still open, with ${fmtCountdown(msLeft)} left in the UTC day.`;

  const streakWord = streak.length === 1 ? 'day' : 'days';
  // Empty, not a third statement of the same absence. With no address, Today
  // already renders the vessel as not connected and the action as "Connect a
  // wallet"; a further line reporting the missing wallet was the screen
  // repeating itself four times over.
  const provenance = !address
    ? ''
    : localCacheUsed
    ? "Read from this device's cached copy. That is a claim, not proof."
    : `Rebuilt from devnet transaction history — ${scanned} transaction${
        scanned === 1 ? '' : 's'
      } read, no local state consulted.`;

  return {
    // state
    now, phase, status, error, setError,
    chainSeals, signaturesByDay, malformed, chainReadAt, scanned, reading,
    attempt, commitments, localCacheUsed, outcome, sealSignature, attestorSource,
    // derived
    roundId, msLeft, streak, todaySealed, settledDays, withBurns,
    stateLine, streakWord, provenance,
    // actions
    refreshFromChain, onOpenRound, onHoldStart, onHoldEnd, onSeal, onForgetDevice,
  };
}
