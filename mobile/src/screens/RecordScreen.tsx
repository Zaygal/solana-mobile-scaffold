/**
 * Record.
 *
 * Every sealed day, read back from devnet. This was two prose sections on the
 * old screen - "Sealed days" and "On Solana, devnet" - and as a list it is what
 * it always wanted to be: evidence, in reverse order, with the transaction that
 * carries each one.
 *
 * Pull to refresh is here and not on other screens because re-reading the chain
 * is a meaningful act: it is the difference between what this device remembers
 * and what the network says. That is the product's entire claim.
 */

import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {T, type} from '../theme';
import useRound, {fmtDay} from '../useRound';

type Props = {
  address: string | null;
  round: ReturnType<typeof useRound>;
  onRequestWallet: () => void;
  onOpenDay: (roundId: string, signature?: string) => void;
};

export default function RecordScreen({address, round, onRequestWallet, onOpenDay}: Props) {
  const {chainSeals, signaturesByDay, malformed, scanned, localCacheUsed, streak} = round;

  if (!address) {
    return (
      <View style={s.empty}>
        <Text style={s.emptyTitle}>Nothing to show yet</Text>
        <Text style={s.emptyBody}>
          The record is read from Solana, so it needs an address to read. Connect a
          wallet and this fills in from the chain — not from anything stored here.
        </Text>
        <Pressable style={s.primary} onPress={onRequestWallet} accessibilityRole="button">
          <Text style={s.primaryText}>Connect a wallet</Text>
        </Pressable>
      </View>
    );
  }

  if (chainSeals.length === 0) {
    return (
      <View style={s.empty}>
        <Text style={s.emptyTitle}>No days sealed yet</Text>
        <Text style={s.emptyBody}>
          {scanned} transaction{scanned === 1 ? '' : 's'} read from devnet for this
          address, and none of them is a round seal. Seal today and it appears here,
          read back from the chain rather than from this device.
        </Text>
      </View>
    );
  }

  const days = [...chainSeals].sort((a, b) => (a.roundId < b.roundId ? 1 : -1));

  return (
    <View>
      <View style={s.summary}>
        <Text style={s.summaryLine}>
          {streak.length} consecutive day{streak.length === 1 ? '' : 's'}
          {streak.latest ? `, most recently ${streak.latest}` : ''}
        </Text>
        <Text style={[s.summaryMeta, {color: localCacheUsed ? T.alert : T.muted}]}>
          {localCacheUsed
            ? "Read from this device's cached copy. That is a claim, not proof."
            : `${scanned} transactions read from devnet. No local state consulted.`}
        </Text>
      </View>

      {days.map(day => (
        <Pressable
          key={day.roundId}
          style={s.row}
          onPress={() => onOpenDay(day.roundId, signaturesByDay[day.roundId])}
          accessibilityRole="button">
          <View style={s.rowText}>
            <Text style={s.rowDate}>{fmtDay(day.roundId)}</Text>
            <Text style={s.rowMeta}>
              {Math.round(day.durationMs / 100) / 10}s held · {day.source} attestation
            </Text>
          </View>
          <Text style={s.chevron}>›</Text>
        </Pressable>
      ))}

      {malformed.length > 0 ? (
        <View style={s.warn}>
          <Text style={s.warnTitle}>{malformed.length} record(s) could not be decoded</Text>
          <Text style={s.warnBody}>
            They are shown as unreadable rather than skipped, because a record this
            app cannot parse is still a record it should not hide.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  summary: {paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.hairline},
  summaryLine: {...type.section, color: T.paper},
  summaryMeta: {...type.body, fontSize: 12.5, marginTop: 4, lineHeight: 18},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.hairline,
  },
  rowText: {flex: 1},
  rowDate: {...type.section, color: T.paper},
  rowMeta: {...type.body, fontSize: 12.5, marginTop: 3},
  chevron: {color: T.muted, fontSize: 22, marginLeft: 10},
  empty: {paddingTop: 72, alignItems: 'center'},
  emptyTitle: {...type.lead, textAlign: 'center'},
  emptyBody: {...type.body, textAlign: 'center', marginTop: 10, lineHeight: 20},
  primary: {
    marginTop: 22,
    height: 52,
    paddingHorizontal: 26,
    borderRadius: 14,
    backgroundColor: T.signal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {color: T.ink, fontSize: 15.5, fontWeight: '800'},
  warn: {marginTop: 18, borderLeftWidth: 2, borderLeftColor: T.alert, paddingLeft: 12},
  warnTitle: {...type.section, color: T.alert},
  warnBody: {...type.body, fontSize: 12.5, marginTop: 4},
});
