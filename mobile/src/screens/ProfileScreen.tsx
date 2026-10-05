/**
 * Profile.
 *
 * Where the wallet belongs. It was the front door of the whole application, which
 * meant the first thing a new user could do was fail to connect rather than
 * understand the product.
 *
 * Development diagnostics live here too. On the old screen they were a footer on
 * the only screen that existed, which made them simultaneously prominent and
 * unreachable. Behind Profile they are deliberate, complete, and out of the way.
 */

import React, {useState} from 'react';
import {Pressable, ScrollView, StyleSheet, Text, View} from 'react-native';
import {T, type} from '../theme';
import useRound, {short} from '../useRound';
import {RPC_ENDPOINT} from '../config';

type Props = {
  address: string | null;
  round: ReturnType<typeof useRound>;
  onRequestWallet: () => void;
  onDisconnect: () => void;
  log: string[];
};

export default function ProfileScreen({address, round, onRequestWallet, onDisconnect, log}: Props) {
  const [openDiag, setOpenDiag] = useState(false);
  const {chainReadAt, scanned, malformed, attestorSource, status, onForgetDevice} = round;

  return (
    <View>
      <Text style={s.heading}>Wallet</Text>
      <View style={s.card}>
        <Text style={s.cardLabel}>{address ? 'Connected' : 'Not connected'}</Text>
        <Text style={s.address}>{address ?? 'Nothing is connected, and nothing needs to be until you seal a day.'}</Text>
        {address ? (
          <View style={s.row}>
            <Pressable style={s.secondary} onPress={onDisconnect} accessibilityRole="button">
              <Text style={s.secondaryText}>Disconnect</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable style={s.primary} onPress={onRequestWallet} accessibilityRole="button">
            <Text style={s.primaryText}>Connect a wallet</Text>
          </Pressable>
        )}
      </View>
      <Text style={s.fine}>
        Clock In signs through Mobile Wallet Adapter. Connecting asks once; after
        that only transactions need your approval.
      </Text>

      <Text style={s.heading}>This device</Text>
      <Pressable style={s.secondaryWide} onPress={onForgetDevice} accessibilityRole="button">
        <Text style={s.secondaryText}>Forget the device copy</Text>
      </Pressable>
      <Text style={s.fine}>
        Deletes everything this phone stored about the round. The streak is rebuilt
        from devnet immediately afterwards, which is the demo: same number, from the
        chain, with no local state consulted.
      </Text>

      <Text style={s.heading}>Developer diagnostics</Text>
      <Pressable
        style={s.diagHead}
        onPress={() => setOpenDiag(v => !v)}
        accessibilityRole="button">
        <Text style={s.diagHeadText}>{openDiag ? 'Hide' : 'Show'}</Text>
        <Text style={s.diagChevron}>{openDiag ? '⌃' : '⌄'}</Text>
      </Pressable>
      {openDiag ? (
        <View style={s.diag}>
          <Row k="rpc" v={RPC_ENDPOINT} />
          <Row k="cluster" v="devnet" />
          <Row k="identity" v={short(address)} />
          <Row k="attestor" v={attestorSource} />
          <Row k="status" v={status} />
          <Row k="chain read at" v={chainReadAt ?? 'never'} />
          <Row k="transactions read" v={String(scanned)} />
          <Row k="malformed records" v={String(malformed.length)} />
          <ScrollView style={s.logBox} nestedScrollEnabled>
            {log.length === 0 ? (
              <Text style={s.logLine}>(no events yet)</Text>
            ) : (
              log.map((l, i) => (
                <Text key={`${i}-${l}`} style={s.logLine}>
                  {l}
                </Text>
              ))
            )}
          </ScrollView>
        </View>
      ) : null}

      <Text style={s.heading}>About</Text>
      <Text style={s.body}>
        One round a day, one UTC day per round, sealed on Solana devnet. The
        attestation is self-reported and the record says so, because a record that
        overstates itself is worth less than one that does not.
      </Text>
    </View>
  );
}

function Row({k, v}: {k: string; v: string}) {
  return (
    <View style={s.kv}>
      <Text style={s.k}>{k}</Text>
      <Text style={s.v} numberOfLines={1}>
        {v}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  heading: {...type.label, color: T.muted, marginTop: 28},
  card: {marginTop: 12, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: T.hairline},
  cardLabel: {...type.section, color: T.paper},
  address: {...type.body, fontSize: 12.5, marginTop: 6, lineHeight: 18},
  row: {flexDirection: 'row', marginTop: 14},
  primary: {
    marginTop: 14,
    height: 48,
    borderRadius: 12,
    backgroundColor: T.signal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {color: T.ink, fontSize: 15, fontWeight: '800'},
  secondary: {
    height: 44,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryWide: {
    marginTop: 12,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {...type.section, color: T.paper, fontWeight: '600'},
  fine: {...type.body, fontSize: 12.5, marginTop: 10, lineHeight: 18},
  diagHead: {
    marginTop: 12,
    height: 46,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: T.panel,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  diagHeadText: {...type.section, color: T.paper},
  diagChevron: {color: T.muted, fontSize: 16},
  diag: {marginTop: 4, padding: 14, borderRadius: 12, backgroundColor: T.panel},
  kv: {flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4},
  k: {...type.body, fontSize: 12, color: T.muted},
  v: {...type.metric, fontSize: 12, maxWidth: '62%', textAlign: 'right'},
  logBox: {
    marginTop: 10,
    maxHeight: 150,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.hairline,
    paddingTop: 8,
  },
  logLine: {...type.metric, fontSize: 11, color: T.muted, lineHeight: 16},
  body: {...type.body, marginTop: 10, lineHeight: 20},
});
