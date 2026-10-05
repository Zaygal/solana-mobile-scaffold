/**
 * Today.
 *
 * The round, on one mobile screen. What is deliberately absent from the old
 * version: the seven ruled sections explaining the product. They were the
 * interface, and they made the app read as a document. What is here is the day,
 * the streak, the countdown, and the one action - the same information a fitness
 * app puts on its home screen, because that is what this is.
 *
 * Every claim that matters stays visible: the provenance line under the streak
 * says where the number came from, and the attestation source is stated as
 * self-reported rather than dressed up.
 */

import React from 'react';
import {ActivityIndicator, Pressable, StyleSheet, Text, View} from 'react-native';
import {T, type} from '../theme';
import HoldVessel from '../HoldVessel';
import Streak from '../Streak';
import Press from '../ui/Press';
import useRound, {fmtCountdown, fmtDay} from '../useRound';
import {ACT_REQUIREMENT} from '../round';

type Props = {
  address: string | null;
  round: ReturnType<typeof useRound>;
  onRequestWallet: () => void;
  onOpenRecord: () => void;
};

export default function TodayScreen({address, round, onRequestWallet, onOpenRecord}: Props) {
  const {
    phase, roundId, stateLine, streak, streakWord, provenance, localCacheUsed,
    todaySealed, outcome, attempt, msLeft, onOpenRound, onSeal, onHoldStart, onHoldEnd,
  } = round;

  const holdable = !!address && !!attempt && !outcome?.satisfied && !todaySealed;
  const busy = phase === 'committing' || phase === 'sealing';

  const primaryLabel = !address
    ? 'Connect a wallet'
    : todaySealed
    ? 'Today is sealed'
    : phase === 'committing'
    ? 'Signing the commitment…'
    : phase === 'sealing'
    ? 'Signing the seal…'
    : outcome?.satisfied
    ? 'Seal today on Solana'
    : attempt
    ? 'Open the hold'
    : "Open today's round";

  return (
    <View style={s.root}>
      {/* The day and its deadline. One line, not a section. */}
      <View style={s.dayRow}>
        <Text style={s.day}>{fmtDay(roundId)}</Text>
        <Text style={s.clock}>{fmtCountdown(msLeft)}</Text>
      </View>

      {/* The streak. The largest thing on the screen, because verifiable
          continuity is the product. Provenance sits directly beneath it. */}
      <Streak length={streak.length} connected={!!address} />
      {provenance ? (
        <Pressable onPress={onOpenRecord} accessibilityRole="button">
          <Text style={[s.prov, {color: localCacheUsed ? T.alert : T.muted}]}>{provenance}</Text>
        </Pressable>
      ) : null}

      <Text style={s.state}>{stateLine}</Text>

      {/* The one action. A vessel when the gesture is a measurement. */}
      <View style={s.action}>
        {holdable ? (
          <>
            <HoldVessel
              label={`Hold for ${ACT_REQUIREMENT.windowMs / 1000} seconds`}
              onHoldStart={onHoldStart}
              onRelease={onHoldEnd}
              onComplete={onHoldEnd}
            />
            <Text style={s.hint}>
              Under reduced motion the count is shown as a number, with the same
              second-by-second ticks.
            </Text>
          </>
        ) : todaySealed ? (
          <View style={[s.sealed, {borderColor: T.signal}]}>
            <Text style={[s.sealedText, {color: T.signal}]}>Sealed. Today is on the record.</Text>
          </View>
        ) : (
          <Press
            style={[s.primary, busy ? s.primaryDim : null]}
            disabled={busy}
            onPress={() => {
              if (!address) return onRequestWallet();
              if (outcome?.satisfied) return onSeal();
              if (!attempt) return onOpenRound();
            }}>
            {busy ? (
              <ActivityIndicator color={T.ink} />
            ) : (
              <Text style={s.primaryText}>{primaryLabel}</Text>
            )}
          </Press>
        )}
      </View>

      {!address ? (
        <Text style={s.footnote}>
          Reading the chain needs an address, so the streak stays blank until you
          connect. Nothing is hidden — there is simply nothing to show yet.
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: {paddingTop: 18},
  dayRow: {flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between'},
  day: {...type.body, color: T.paper, fontSize: 15},
  clock: {...type.metric, color: T.muted},
  streakBlock: {marginTop: 26},
  streak: {fontSize: 84, fontWeight: '800', letterSpacing: -3, lineHeight: 88},
  streakLabel: {...type.section, color: T.paper, marginTop: 2},
  prov: {...type.body, fontSize: 12.5, marginTop: 8, lineHeight: 18},
  state: {...type.lead, marginTop: 24},
  action: {marginTop: 26},
  primary: {
    height: 58,
    borderRadius: 14,
    backgroundColor: T.signal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryDim: {opacity: 0.55},
  primaryText: {color: T.ink, fontSize: 16.5, fontWeight: '800'},
  sealed: {
    height: 58,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sealedText: {fontSize: 15.5, fontWeight: '700'},
  hint: {...type.body, fontSize: 12, marginTop: 10},
  footnote: {...type.body, fontSize: 12.5, marginTop: 18, lineHeight: 18},
});
