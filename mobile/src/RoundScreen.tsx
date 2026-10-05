/**
 * Today's round.
 *
 * This is the whole product. One screen, one loop: commit, act, attest, seal,
 * continue the streak. The design rules it follows, and why:
 *
 *  - It does not open with a wallet. A wallet is plumbing; the round is the
 *    product. Connection state lives in the footer, never as the first ask.
 *  - It does not show a balance, and it is not a dashboard: sections are
 *    separated by hairlines rather than boxed into identical cards, so the page
 *    reads as written rather than assembled.
 *  - The streak is the largest element and its provenance sits directly under
 *    it at readable size, because "the streak is verifiable" is the product
 *    thesis and a thesis set in the faintest type on the screen is a thesis
 *    inverted.
 *  - There is exactly one filled control. Everything else is text or an
 *    outlined action, so the next step is never ambiguous.
 *  - Every limit is printed on the surface that depends on it: devnet,
 *    self-reported attestation, cached-versus-chain provenance, and the escrow
 *    that does not exist yet. A limit the user has to discover is one we hid.
 */

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
import {EXPLORER, RPC_ENDPOINT} from './config';
import {sendCommitment, sendSeal} from './sealTx';
import {readSealsFromChain} from './chain';
import {SealRecord, sealFromOutcome, streakFromSeals} from './seal';
import {AttemptState, clearLocalState, loadState, saveState} from './store';

const VERIFIER_COMMAND = 'node verifier/verify.mjs <your-wallet-address>';

type Phase =
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

function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

function fmtDay(roundId: string): string {
  const [y, m, d] = roundId.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return `${days[dt.getUTCDay()]} ${d} ${months[m - 1]} ${y}`;
}

function short(addr: string | null): string {
  if (!addr) return 'no wallet';
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

type Props = {
  /** Base58 address of the wallet the application shell has already connected. */
  address: string;
};

export default function RoundScreen({address}: Props) {
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

  // One tick a second: the UTC day boundary is a real deadline in this product,
  // so the countdown is information the user acts on, not decoration.
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const refreshFromChain = useCallback(async (addr: string) => {
    const connection = new Connection(RPC_ENDPOINT, 'confirmed');
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
      // The wallet is established by the application shell before this screen is
      // mounted, so nothing here opens a wallet flow. This screen reads the
      // chain for an address it was given; it never asks for one.
      setPhase('open');
      await refreshFromChain(address);
    })();
  }, [refreshFromChain]);

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
    if (address) await refreshFromChain(address);
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
  const streak = useMemo(() => streakFromSeals(chainSeals), [chainSeals]);
  const todaySealed = useMemo(
    () => chainSeals.some(s => s.roundId === roundId),
    [chainSeals, roundId],
  );

  const settledDays: DayRecord[] = useMemo(() => {
    const records: DayRecord[] = chainSeals.map(s => ({
      roundId: s.roundId,
      stakeLamports: 0,
      state: 'sealed' as const,
      signature: signaturesByDay[s.roundId],
      metrics: {peak: s.peakMilli / 1000, durationMs: s.durationMs, source: s.source},
    }));
    return records;
  }, [chainSeals, signaturesByDay]);

  // Yesterday and earlier are settled by the same rule the engine defines.
  const withBurns = useMemo(() => settleExpired(settledDays, now), [settledDays, now]);

  const primaryLabel = useMemo(() => {
    if (!address) return 'Connect a wallet to start';
    if (todaySealed) return 'Today is sealed';
    if (phase === 'committing') return 'Signing the commitment…';
    if (phase === 'sealing') return 'Signing the seal…';
    if (outcome?.satisfied) return 'Seal today on Solana';
    if (attempt) return 'Press and hold to attest';
    return "Open today's round";
  }, [address, attempt, outcome, phase, todaySealed]);

  const onPrimary = useCallback(() => {
    if (!address) return;
    if (todaySealed) return;
    if (outcome?.satisfied) return onSeal();
    if (!attempt) return onOpenRound();
  }, [address, attempt, onOpenRound, onSeal, outcome, todaySealed]);

  // The state as a sentence, because the boundary is information the user acts
  // on rather than a badge.
  const stateLine = todaySealed
    ? 'Sealed. Today is on the record.'
    : outcome?.satisfied
    ? 'The act qualified. Seal the day to finish the round.'
    : msLeft === 0
    ? 'This round closed without an act.'
    : `Still open, with ${fmtCountdown(msLeft)} left in the UTC day.`;

  const streakWord = streak.length === 1 ? 'day' : 'days';
  const provenance = localCacheUsed
    ? "Read from this device's cached copy. That is a claim, not proof."
    : `Rebuilt from devnet transaction history — ${scanned} transaction${
        scanned === 1 ? '' : 's'
      } read, no local state consulted.`;

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.dateLine}>{fmtDay(roundId)}</Text>
        <Text style={s.stateLine}>{stateLine}</Text>

        <View style={s.streakBlock}>
          <Text style={s.streak}>{streak.length}</Text>
          <Text style={s.streakLabel}>
            {streakWord} sealed in a row
            {streak.latest && !todaySealed ? `, most recently ${streak.latest}` : ''}
          </Text>
          <Text style={[s.provenance, localCacheUsed ? s.provBad : s.provGood]}>{provenance}</Text>
        </View>

        <View style={s.rule} />

        <Text style={s.h}>What you must do</Text>
        <Text style={s.p}>
          Hold the button for a full {ACT_REQUIREMENT.windowMs / 1000} seconds. One round is one UTC
          day, and the act has to fall inside the day it belongs to.
        </Text>

        <Pressable
          style={[s.primary, (!address || todaySealed) && s.primaryOff]}
          disabled={!address || todaySealed || phase === 'committing' || phase === 'sealing'}
          onPress={onPrimary}
          onPressIn={() => {
            if (attempt && !outcome?.satisfied && !todaySealed) onHoldStart();
          }}
          onPressOut={() => {
            if (attempt && !outcome?.satisfied && !todaySealed) onHoldEnd();
          }}>
          <Text style={s.primaryText}>{primaryLabel}</Text>
        </Pressable>

        {(phase === 'committing' || phase === 'sealing' || phase === 'loading') && (
          <ActivityIndicator color="#F5A524" style={s.spinner} />
        )}
        {outcome && !outcome.satisfied && !todaySealed && (
          <Text style={s.reason}>Not qualified yet: {outcome.reason}.</Text>
        )}

        <View style={s.rule} />

        <Text style={s.h}>What happens either way</Text>
        <Text style={s.p}>
          A qualifying act seals the day with a signed record on Solana, and that seal cannot be
          back-dated, edited or restored afterwards — including by us.
        </Text>
        <Text style={s.p}>
          A day without one is simply absent from the record. The streak ends there and the gap
          stays visible.
        </Text>

        <View style={s.rule} />

        <Text style={s.h}>What the record proves</Text>
        <Text style={s.p}>
          Attestation is self-reported and manual. The on-chain record proves that this wallet
          signed this claim, at this time, and it declares how the claim was produced. It does not
          prove the physical act. Motion and camera attestation are not built, and are not
          approximated.
        </Text>

        <View style={s.rule} />

        <Text style={s.h}>On Solana, devnet</Text>
        <View style={s.kv}>
          <Text style={s.k}>commitment</Text>
          <Text style={s.v}>
            {commitments[roundId] ? short(commitments[roundId]) : 'not made for this round'}
          </Text>
        </View>
        <View style={s.kv}>
          <Text style={s.k}>seal</Text>
          <Text style={s.v}>
            {sealSignature
              ? short(sealSignature)
              : signaturesByDay[roundId]
              ? short(signaturesByDay[roundId])
              : 'none yet today'}
          </Text>
        </View>
        <Text style={s.p}>
          The commitment is a real signed devnet transaction worth nothing. It is not an escrow:
          nothing returns it and nothing forfeits it. The seal is the record that matters.
        </Text>
        {address && (
          <Pressable
            onPress={() =>
              Linking.openURL(`https://explorer.solana.com/address/${address}?cluster=devnet`)
            }>
            <Text style={s.link}>View this wallet on the devnet explorer</Text>
          </Pressable>
        )}

        <View style={s.rule} />

        <Text style={s.h}>Sealed days</Text>
        {withBurns.length === 0 ? (
          <Text style={s.p}>Nothing sealed yet. Today would be the first.</Text>
        ) : (
          withBurns
            .slice()
            .reverse()
            .map(d => (
              <View key={d.roundId} style={s.kv}>
                <Text style={s.k}>{d.roundId}</Text>
                <Text style={s.v}>{d.metrics?.source ?? 'unknown source'}</Text>
              </View>
            ))
        )}
        {malformed.length > 0 && (
          <Text style={s.reason}>
            {malformed.length} memo{malformed.length === 1 ? '' : 's'} carried our prefix but would
            not decode. Shown rather than ignored.
          </Text>
        )}

        <View style={s.rule} />

        <Text style={s.h}>Verify it without this app</Text>
        <Text style={s.p}>
          The app's claim and the verifier's claim are the same computation. Delete what this device
          knows and ask the chain instead:
        </Text>
        <Text style={s.code}>{VERIFIER_COMMAND}</Text>
        <Pressable style={s.ghost} onPress={onForgetDevice}>
          <Text style={s.ghostText}>Forget this device's copy and re-read the chain</Text>
        </Pressable>

        <View style={s.rule} />

        <Text style={s.h}>Not built</Text>
        <Text style={s.p}>
          Trustless escrow: a program that holds the stake, returns it when a round qualifies and
          forfeits it when the day is missed. Returning funds needs program authority, so no
          arrangement of ordinary transactions can do it. Named here so it is not mistaken for
          finished.
        </Text>

        {error && (
          <View style={s.errorBlock}>
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        <Text style={s.footer}>
          Wallet {short(address)} — {status}.
        </Text>
        <Text style={s.footerDim}>{RPC_ENDPOINT}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#0E0F11'},
  body: {padding: 22, paddingBottom: 60},

  dateLine: {color: '#8B8F98', fontSize: 14},
  stateLine: {color: '#EDEFF2', fontSize: 19, fontWeight: '600', marginTop: 8, lineHeight: 26},

  // The streak and its provenance are one unit: the number is the claim, the
  // line under it is why the claim can be checked.
  streakBlock: {marginTop: 26},
  streak: {color: '#F5A524', fontSize: 78, fontWeight: '800', letterSpacing: -2, lineHeight: 82},
  streakLabel: {color: '#B9BEC7', fontSize: 15, marginTop: 2},
  provenance: {fontSize: 13, marginTop: 10, lineHeight: 19},
  provGood: {color: '#57C98A'},
  provBad: {color: '#E2705F'},

  rule: {height: 1, backgroundColor: '#22252B', marginTop: 26},

  h: {color: '#EDEFF2', fontSize: 15, fontWeight: '700', marginTop: 18},
  p: {color: '#AEB4BE', fontSize: 14, lineHeight: 21, marginTop: 8},

  primary: {
    backgroundColor: '#F5A524',
    borderRadius: 13,
    padding: 19,
    alignItems: 'center',
    marginTop: 20,
  },
  primaryOff: {opacity: 0.32},
  primaryText: {color: '#2A1A02', fontWeight: '800', fontSize: 16},
  spinner: {marginTop: 14},
  reason: {color: '#E2705F', fontSize: 13, marginTop: 12, lineHeight: 19},

  kv: {flexDirection: 'row', justifyContent: 'space-between', marginTop: 10},
  k: {color: '#7E848E', fontSize: 13},
  v: {color: '#D7DBE1', fontSize: 13, fontVariant: ['tabular-nums']},

  link: {color: '#F5A524', fontSize: 14, marginTop: 14},
  code: {
    color: '#D7DBE1',
    fontSize: 12,
    marginTop: 12,
    padding: 12,
    backgroundColor: '#16181C',
    borderRadius: 8,
  },
  ghost: {
    borderWidth: 1,
    borderColor: '#2C3037',
    borderRadius: 13,
    padding: 14,
    alignItems: 'center',
    marginTop: 14,
  },
  ghostText: {color: '#D7DBE1', fontSize: 14, fontWeight: '600'},

  errorBlock: {marginTop: 24, borderLeftWidth: 2, borderLeftColor: '#E2705F', paddingLeft: 12},
  errorText: {color: '#E2705F', fontSize: 13, lineHeight: 19},

  footer: {color: '#6C7178', fontSize: 12, marginTop: 30},
  footerDim: {color: '#494E55', fontSize: 11, marginTop: 4},
});
