/**
 * Today's round.
 *
 * This is the whole product. One screen, one loop: commit, act, attest, seal,
 * continue the streak. The design rules it follows, and why:
 *
 *  - It does not open with a wallet. A wallet is plumbing; the round is the
 *    product. Connection state lives at the bottom of the screen as a status
 *    line, never as the thing you are asked to do first.
 *  - It does not show a balance. A balance invites reading this as a wallet app.
 *  - The streak is the largest element, because the streak is what the user is
 *    actually protecting, and the chain is what makes it credible.
 *  - Every limit is printed on the screen that depends on it: devnet, manual
 *    attestation, local cache versus chain record, and the escrow that does not
 *    exist yet. A limitation the user has to discover is a limitation we hid.
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
import {connectWallet} from './mobileWallet';
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

function short(addr: string | null): string {
  if (!addr) return '—';
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
}

export default function RoundScreen() {
  const [now, setNow] = useState(new Date());
  const [address, setAddress] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [status, setStatus] = useState('reading the chain…');
  const [error, setError] = useState<string | null>(null);

  // Chain reading: the authoritative record.
  const [chainSeals, setChainSeals] = useState<SealRecord[]>([]);
  const [signaturesByDay, setSignaturesByDay] = useState<Record<string, string>>({});
  const [malformed, setMalformed] = useState<{signature: string; snippet: string}[]>([]);
  const [chainReadAt, setChainReadAt] = useState<string | null>(null);

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

  const refreshFromChain = useCallback(
    async (addr: string) => {
      const connection = new Connection(RPC_ENDPOINT, 'confirmed');
      setStatus('reading the chain…');
      try {
        const reading = await readSealsFromChain(connection, addr);
        setChainSeals(reading.seals);
        setSignaturesByDay(reading.signaturesByDay);
        setMalformed(reading.malformed);
        setChainReadAt(new Date().toISOString());
        setLocalCacheUsed(false);
        setStatus(`read ${reading.scanned} transactions from devnet`);
        return reading;
      } catch (e: any) {
        // Falling back to the cache is allowed, but it is labelled on screen.
        // A cached streak presented as the chain's would be the exact
        // overclaim this product exists to avoid.
        setLocalCacheUsed(true);
        setStatus('devnet unreachable — showing this device\'s cached copy');
        return null;
      }
    },
    [],
  );

  // Boot: read local state first so the screen paints, then ask the chain.
  useEffect(() => {
    (async () => {
      const persisted = await loadState();
      setAttempt(persisted.attempt ?? null);
      setCommitments(persisted.commitments ?? {});
      if (persisted.cache?.seals?.length) {
        setChainSeals(persisted.cache.seals);
        setLocalCacheUsed(true);
      }
      try {
        const auth = await connectWallet();
        setAddress(auth.address);
        setPhase('open');
        await refreshFromChain(auth.address);
      } catch (e: any) {
        setAddress(null);
        setPhase('unconnected');
        setError(e?.message ?? String(e));
      }
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
      setStatus('round opened — commitment transaction confirmed');
    } catch (e: any) {
      setError(e?.message ?? String(e));
      setStatus('commitment was not signed');
      setPhase('open');
    }
  }, [address, commitments, persist, roundId, attestorSource]);

  /** Step 2 and 3: observe, then judge the observation. */
  const onHoldStart = useCallback(() => {
    holdStartRef.current = Date.now();
    setPhase('holding');
    setStatus(`hold for ${ACT_REQUIREMENT.windowMs / 1000}s…`);
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
    setStatus(verdict.reason);
  }, [attestorSource]);

  const onForgetDevice = useCallback(async () => {
    await clearLocalState();
    setAttempt(null);
    setCommitments({});
    setOutcome(null);
    setSealSignature(null);
    if (address) await refreshFromChain(address);
    setStatus('device copy deleted — streak rebuilt from the chain alone');
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
      setStatus('seal was not signed');
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
    if (todaySealed) return "Today is sealed";
    if (phase === 'committing') return 'Signing commitment…';
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

  const requirementText = `Hold the button for ${ACT_REQUIREMENT.windowMs / 1000} whole seconds.`;
  const stateWord = todaySealed
    ? 'SEALED'
    : outcome?.satisfied
    ? 'QUALIFIED'
    : msLeft === 0
    ? 'MISSED'
    : 'OPEN';

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.kicker}>TODAY'S ROUND · {roundId}</Text>
        <Text style={s.countdown}>closes in {fmtCountdown(msLeft)}</Text>

        <Text style={[s.state, todaySealed && s.stateGood]}>{stateWord}</Text>

        <View style={s.card}>
          <Text style={s.label}>YOUR STREAK</Text>
          <Text style={s.streak}>{streak.length}</Text>
          <Text style={s.hint}>
            {streak.latest ? `most recent sealed day: ${streak.latest}` : 'no sealed days yet'}
          </Text>
          <Text style={[s.provenance, localCacheUsed ? s.prov : s.provGood]}>
            {localCacheUsed
              ? 'source: this device\'s cached copy — not proof'
              : 'source: rebuilt from devnet transaction history'}
          </Text>
        </View>

        <View style={s.card}>
          <Text style={s.label}>WHAT YOU HAVE TO DO</Text>
          <Text style={s.value}>{requirementText}</Text>
          <Text style={s.hint}>
            A round is one UTC day. The act must happen inside the day it belongs to.
          </Text>
        </View>

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
          <ActivityIndicator color="#F5A524" style={{marginTop: 14}} />
        )}

        {(phase === 'holding' || (attempt && !outcome?.satisfied && !todaySealed)) && (
          <Text style={s.holding}>holding… release to judge the attempt</Text>
        )}
        {outcome && !outcome.satisfied && <Text style={s.reason}>not qualified: {outcome.reason}</Text>}

        <View style={s.card}>
          <Text style={s.label}>WHAT HAPPENS NEXT</Text>
          <Text style={s.body2}>
            If the act qualifies, the day is sealed with a signed record on Solana. It cannot be
            back-dated, edited, or restored later — including by us.
          </Text>
          <Text style={s.body2}>
            If it does not, the day is simply absent from the record. The streak ends there, and the
            gap stays visible.
          </Text>
        </View>

        <View style={s.card}>
          <Text style={s.label}>ATTESTATION</Text>
          <Text style={s.value}>Self-reported / manual attestation</Text>
          <Text style={s.body2}>
            The record proves the wallet signed this claim and declares how it was produced. It does
            not prove the physical act. Motion and camera attestation are named here as not built,
            not approximated.
          </Text>
        </View>

        <View style={s.card}>
          <Text style={s.label}>ON-CHAIN STATUS · DEVNET</Text>
          <Text style={s.mono}>round {roundId}</Text>
          <Text style={s.mono}>commitment tx: {commitments[roundId] ? short(commitments[roundId]) : 'not made'}</Text>
          <Text style={s.mono}>seal signature: {sealSignature ? short(sealSignature) : signaturesByDay[roundId] ? short(signaturesByDay[roundId]) : 'none yet'}</Text>
          <Text style={s.mono}>chain read: {chainReadAt ? chainReadAt.slice(11, 19) + 'Z' : '—'}</Text>
          <Text style={s.hint}>
            v0 runs on devnet only. The commitment transaction is a real signed transaction whose
            value is zero, and it is not an escrow — nothing returns it and nothing forfeits it.
          </Text>
          {chainReadAt && (
            <Pressable
              onPress={() =>
                Linking.openURL(
                  `https://explorer.solana.com/address/${address}?cluster=devnet`,
                )
              }>
              <Text style={s.link}>view this wallet on devnet explorer →</Text>
            </Pressable>
          )}
        </View>

        <View style={s.card}>
          <Text style={s.label}>SEALED DAYS</Text>
          {withBurns.length === 0 && <Text style={s.hint}>nothing sealed yet</Text>}
          {withBurns
            .slice()
            .reverse()
            .map(d => (
              <View key={d.roundId} style={s.row}>
                <Text style={s.mono}>{d.roundId}</Text>
                <Text style={s.rowRight}>{d.metrics?.source ?? '—'}</Text>
              </View>
            ))}
          {malformed.length > 0 && (
            <Text style={s.reason}>
              {malformed.length} memo(s) carried our prefix but would not decode — shown rather than
              ignored
            </Text>
          )}
        </View>

        <View style={s.card}>
          <Text style={s.label}>VERIFY WITHOUT THIS APP</Text>
          <Text style={s.body2}>
            The app's claim and the verifier's claim are the same computation. Delete what this
            device knows and ask the chain instead:
          </Text>
          <Text style={s.mono}>{VERIFIER_COMMAND}</Text>
          <Pressable style={s.ghost} onPress={onForgetDevice}>
            <Text style={s.ghostText}>Forget this device's copy and re-read the chain</Text>
          </Pressable>
        </View>

        <View style={s.card}>
          <Text style={s.label}>NOT BUILT YET</Text>
          <Text style={s.body2}>
            Trustless escrow: a program that holds the stake, returns it when a round qualifies and
            forfeits it when the day is missed. Returning funds requires program authority, so no
            version of ordinary transactions can do it. Named here so it is not mistaken for done.
          </Text>
        </View>

        {error && (
          <View style={[s.card, s.badCard]}>
            <Text style={s.label}>ERROR</Text>
            <Text style={s.mono}>{error}</Text>
          </View>
        )}

        <Text style={s.footer}>
          wallet {short(address)} · {status}
        </Text>
        <Text style={s.footerDim}>{RPC_ENDPOINT}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#0C0F14'},
  body: {padding: 20, paddingBottom: 56},
  kicker: {color: '#8A93A5', fontSize: 11, letterSpacing: 2.6, fontWeight: '700'},
  countdown: {color: '#5F6675', fontSize: 12, marginTop: 6},
  state: {color: '#F4F6FA', fontSize: 44, fontWeight: '900', marginTop: 10, letterSpacing: -0.5},
  stateGood: {color: '#3DD68C'},
  card: {
    backgroundColor: '#141A22',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#1E2732',
  },
  badCard: {borderColor: '#FF6B6B'},
  label: {color: '#6E7686', fontSize: 10, letterSpacing: 1.8, fontWeight: '700'},
  streak: {color: '#F5A524', fontSize: 68, fontWeight: '900', marginTop: 2},
  value: {color: '#F4F6FA', fontSize: 17, marginTop: 6, fontWeight: '600'},
  body2: {color: '#B6BFCC', fontSize: 13, marginTop: 8, lineHeight: 20},
  hint: {color: '#8A93A5', fontSize: 12, marginTop: 8, lineHeight: 18},
  provenance: {fontSize: 11, marginTop: 10},
  prov: {color: '#FF6B6B'},
  provGood: {color: '#3DD68C'},
  primary: {
    backgroundColor: '#F5A524',
    borderRadius: 16,
    padding: 19,
    alignItems: 'center',
    marginTop: 18,
  },
  primaryOff: {opacity: 0.35},
  primaryText: {color: '#241703', fontWeight: '800', fontSize: 16},
  holding: {color: '#F5A524', fontSize: 13, marginTop: 12, textAlign: 'center'},
  reason: {color: '#FF6B6B', fontSize: 12, marginTop: 10},
  mono: {color: '#C9D2E0', fontSize: 12, marginTop: 6, lineHeight: 18},
  link: {color: '#F5A524', fontSize: 12, marginTop: 12},
  row: {flexDirection: 'row', justifyContent: 'space-between', marginTop: 8},
  rowRight: {color: '#8A93A5', fontSize: 12},
  ghost: {
    borderWidth: 1,
    borderColor: '#2A3441',
    borderRadius: 12,
    padding: 13,
    alignItems: 'center',
    marginTop: 14,
  },
  ghostText: {color: '#C9D2E0', fontSize: 13, fontWeight: '600'},
  footer: {color: '#5F6675', fontSize: 11, marginTop: 22},
  footerDim: {color: '#3C434F', fontSize: 10, marginTop: 4},
});
