/**
 * Verify.
 *
 * This screen is the product's differentiator, which is why it is a destination
 * and not an appendix. On the old screen a single section said "Verify it without
 * this app" and gave a command; the reasoning for why the record can be trusted
 * at all was spread across three other sections above and below it.
 *
 * Here the claim and its limits sit together, because a claim presented without
 * its limits is the thing this product exists to avoid.
 */

import React from 'react';
import {Pressable, Share, StyleSheet, Text, View} from 'react-native';
import {T, type} from '../theme';

const VERIFIER = 'node verifier/verify.mjs <your-wallet-address>';

const PROVES = [
  'A wallet signed each record, and the signature is verifiable against the address.',
  'The records decode into the fields they claim to have.',
  'The streak is counted the same way here as by anything else that reads them.',
];

const DOES_NOT = [
  'That a person held a button for ten seconds. The attestation is self-reported.',
  'That a physical act happened. Nothing on the chain observes the body.',
  'That local state is trustworthy. The device copy is a cache and is treated as one.',
];

export default function VerifyScreen() {
  return (
    <View>
      <Text style={s.lead}>
        The record can be checked without this app, and without trusting us.
      </Text>

      <View style={s.cmdRow}>
        <Text style={s.cmd}>{VERIFIER}</Text>
      </View>
      <Pressable
        style={s.secondary}
        onPress={() => Share.share({message: VERIFIER})}
        accessibilityRole="button">
        <Text style={s.secondaryText}>Share the command</Text>
      </Pressable>
      <Text style={s.fine}>
        It runs on a computer, not on this phone, and that is the point: the check
        does not depend on anything installed here, including this app.
      </Text>

      <Text style={s.heading}>What the record proves</Text>
      {PROVES.map(line => (
        <View key={line} style={s.bullet}>
          <Text style={[s.mark, {color: T.signal}]}>·</Text>
          <Text style={s.bulletText}>{line}</Text>
        </View>
      ))}

      <Text style={s.heading}>What it does not prove</Text>
      {DOES_NOT.map(line => (
        <View key={line} style={s.bullet}>
          <Text style={[s.mark, {color: T.muted}]}>·</Text>
          <Text style={s.bulletText}>{line}</Text>
        </View>
      ))}

      <Text style={s.heading}>Not built, and not implied</Text>
      <Text style={s.body}>
        There is no escrow. The commitment transaction is a labelled ritual on
        devnet, not a contract holding funds. Nothing here can burn a user's money,
        and nothing claims to observe a physical act.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  lead: {...type.lead},
  cmdRow: {
    marginTop: 18,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.hairline,
    backgroundColor: T.panel,
  },
  cmd: {...type.metric, color: T.paper, fontSize: 12.5},
  secondary: {
    marginTop: 12,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {...type.section, color: T.paper, fontWeight: '600' as const},
  fine: {...type.body, fontSize: 12.5, marginTop: 10, lineHeight: 18},
  heading: {...type.label, color: T.muted, marginTop: 30},
  bullet: {flexDirection: 'row', marginTop: 10},
  mark: {fontSize: 17, lineHeight: 21, marginRight: 8},
  bulletText: {...type.body, color: T.paper, flex: 1, lineHeight: 20},
  body: {...type.body, marginTop: 10, lineHeight: 20},
});
