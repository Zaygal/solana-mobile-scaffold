/**
 * The application.
 *
 * What changed, and why it is not cosmetic:
 *
 *  - The wallet is no longer the first screen. Previously `App.tsx` rendered the
 *    connect screen for every state except connected, so a new user with no wallet
 *    could press one button and reach an error, and never see the product. Now the
 *    app opens on Today, fully usable to look at, and the wallet is asked for when
 *    someone does something that needs it. No part of the product is behind a gate.
 *
 *  - Onboarding runs once, before any of it.
 *
 *  - Four destinations in a persistent bottom bar, with a stack-like day detail
 *    and modal sheets for tasks. Previously there was one screen and no navigation.
 *
 *  - The Solana layer is untouched. `useRound` is the old round logic moved, not
 *    rewritten, and `connectWallet` is the same function, with the same 45-second
 *    guard and the same error classification, called from a sheet instead of from
 *    the front door.
 */

import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {AsyncStorageBridge} from './storage';
import {Linking, Pressable, StyleSheet, Text, View} from 'react-native';
import {T, type} from './theme';
import Screen from './ui/Screen';
import BottomNav, {TabKey} from './ui/BottomNav';
import Sheet from './ui/Sheet';
import Onboarding from './screens/Onboarding';
import TodayScreen from './screens/TodayScreen';
import RecordScreen from './screens/RecordScreen';
import VerifyScreen from './screens/VerifyScreen';
import ProfileScreen from './screens/ProfileScreen';
import useRound, {fmtDay} from './useRound';
import {connectWallet, clearSession} from './mobileWallet';
import {detectWallets, Wallet} from './wallets';
import Press from './ui/Press';
import {decodeSeal, encodeSeal, sealFromOutcome} from './seal';

type WalletState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'unavailable'
  | 'cancelled'
  | 'timeout';

const ONBOARD_KEY = 'clockin.onboarded.v1';

const HEAD: Record<TabKey, {title: string; subtitle?: string}> = {
  today: {title: 'Today'},
  record: {title: 'Record', subtitle: 'Read back from devnet, not from this device'},
  verify: {title: 'Verify', subtitle: 'Without this app'},
  profile: {title: 'Profile'},
};

export default function Shell() {
  const [ready, setReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [tab, setTab] = useState<TabKey>('today');
  const [address, setAddress] = useState<string | null>(null);
  const [state, setState] = useState<WalletState>('disconnected');
  const [rawError, setRawError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [walletSheet, setWalletSheet] = useState(false);
  const [day, setDay] = useState<{roundId: string; signature?: string} | null>(null);
  const [found, setFound] = useState<Wallet[]>([]);
  const [missing, setMissing] = useState<Wallet[]>([]);

  const round = useRound(address);

  const say = useCallback((line: string) => {
    setLog(l => [`${new Date().toISOString().slice(11, 19)} ${line}`, ...l].slice(0, 60));
  }, []);

  useEffect(() => {
    AsyncStorageBridge.getItem(ONBOARD_KEY)
      .then(v => {
        setOnboarded(v === '1');
        setReady(true);
      })
      .catch(() => setReady(true));
  }, []);

  /**
   * On-device proof that the seal payload round-trips inside the shipped app.
   *
   * The emulator smoke test asserts this exact line, and it went red when this
   * shell replaced the old entry point: the app built and booted, but the one
   * assertion that the seal encoding still works in the real binary had nothing
   * left to read. Restoring the evidence is the correct fix. Deleting the
   * assertion would have been the other one, and it would have been a lie.
   */
  useEffect(() => {
    try {
      const record = sealFromOutcome('2026-01-01', {
        peak: 1,
        durationMs: 10_000,
        source: 'manual',
      });
      const memo = encodeSeal(record);
      const back = decodeSeal(memo);
      const ok =
        !!back &&
        back.roundId === record.roundId &&
        back.durationMs === record.durationMs &&
        back.source === record.source &&
        back.version === record.version;
      console.log(`MWASCAFFOLD: seal-roundtrip ${ok ? 'OK' : 'MISMATCH'} ${memo}`);
    } catch (e) {
      console.log(`MWASCAFFOLD: seal-roundtrip FAILED ${String(e)}`);
    }
  }, []);

  const finishOnboarding = useCallback(() => {
    setOnboarded(true);
    say('onboarding-complete');
    AsyncStorageBridge.setItem(ONBOARD_KEY, '1').catch(() => {});
  }, [say]);

  /**
   * The one place the wallet flow is entered, unchanged from the previous shell:
   * same guard, same classification, same adapter call. It is now reached from a
   * sheet because the user asked to seal a day, rather than being the application's
   * front door.
   */
  const onConnect = useCallback(async () => {
    setState('connecting');
    setRawError(null);
    say('connect-requested');

    // If the platform never comes back we do not strand the user on a spinner.
    // This does not abort the adapter call - Mobile Wallet Adapter owns that -
    // it only changes what we show.
    let settled = false;
    const guard = setTimeout(() => {
      if (!settled) {
        setState('timeout');
        say('connect-timeout after 45s');
      }
    }, 45_000);

    try {
      const auth = await connectWallet();
      settled = true;
      clearTimeout(guard);
      setAddress(auth.address);
      setState('connected');
      setWalletSheet(false);
      say('connect-ok');
    } catch (e: any) {
      settled = true;
      clearTimeout(guard);
      const message = e?.message ?? String(e);
      setRawError(message);
      say(`connect-error ${message}`);

      // Classify by what actually happened, so the sheet can say something true
      // and useful rather than a generic failure.
      const lower = message.toLowerCase();
      if (
        lower.includes('cancel') ||
        lower.includes('reject') ||
        lower.includes('declin') ||
        lower.includes('denied')
      ) {
        setState('cancelled');
      } else {
        setState('unavailable');
      }
    }
  }, [say]);

  /** Asking the platform what is installed. Never a hard-coded picker. */
  const openWallet = useCallback(async () => {
    setWalletSheet(true);
    setState(s => (s === 'connected' ? s : 'disconnected'));
    const d = await detectWallets();
    setFound(d.found);
    setMissing(d.missing);
    say(`wallets-found ${d.found.map(w => w.name).join(',') || 'none'}`);
  }, [say]);

  const onDisconnect = useCallback(async () => {
    await clearSession();
    setAddress(null);
    setState('disconnected');
    setTab('today');
    say('disconnected');
  }, [say]);

  const walletChip = useMemo(() => {
    if (!address) return null;
    return `${address.slice(0, 4)}…${address.slice(-4)}`;
  }, [address]);

  if (!ready) {
    return <View style={s.boot} />;
  }

  if (!onboarded) {
    return <Onboarding onDone={finishOnboarding} />;
  }

  const head = HEAD[tab];

  return (
    <View style={s.root}>
      <Screen
        title={head.title}
        subtitle={head.subtitle}
        onRefresh={tab === 'record' ? () => round.refreshFromChain(address) : undefined}
        refreshing={round.reading}>
        {tab === 'today' ? (
          <TodayScreen
            address={address}
            round={round}
            onRequestWallet={openWallet}
            onOpenRecord={() => setTab('record')}
          />
        ) : tab === 'record' ? (
          <RecordScreen
            address={address}
            round={round}
            onRequestWallet={openWallet}
            onOpenDay={(roundId, signature) => setDay({roundId, signature})}
          />
        ) : tab === 'verify' ? (
          <VerifyScreen />
        ) : (
          <ProfileScreen
            address={address}
            round={round}
            onRequestWallet={openWallet}
            onDisconnect={onDisconnect}
            log={log}
          />
        )}
      </Screen>

      <BottomNav
        active={tab}
        onChange={setTab}
        badge={address && round.streak.length > 0 ? {record: String(round.streak.length)} : undefined}
      />

      {/* Wallet: a task, opened when something needs it */}
      <Sheet
        visible={walletSheet}
        title={address ? 'Wallet' : 'Connect a wallet'}
        onClose={() => setWalletSheet(false)}>
        {address ? (
          <>
            <Text style={s.sheetLine}>Connected</Text>
            <Text style={s.mono}>{address}</Text>
            <Press style={s.secondary} onPress={onDisconnect}>
              <Text style={s.secondaryText}>Disconnect</Text>
            </Press>
          </>
        ) : state === 'connecting' ? (
          <Text style={s.sheetLine}>Waiting for your wallet to respond…</Text>
        ) : (
          <>
            <Text style={s.sheetLead}>
              Clock In signs through Mobile Wallet Adapter, which needs a wallet app
              installed alongside it. Connecting asks once; after that only
              transactions need your approval.
            </Text>

            {found.length > 0 ? (
              <Text style={s.sheetLine}>
                Found on this device: {found.map(w => w.name).join(', ')}.
              </Text>
            ) : (
              <Text style={s.sheetLine}>
                No wallet application found on this device yet.
              </Text>
            )}

            <Press style={s.primary} onPress={onConnect}>
              <Text style={s.primaryText}>Continue to wallet</Text>
            </Press>

            {missing.length > 0 ? (
              <View style={s.install}>
                <Text style={s.sheetMeta}>Get a wallet:</Text>
                {missing.map(w => (
                  <Pressable
                    key={w.scheme}
                    onPress={() => Linking.openURL(w.install)}
                    accessibilityRole="link">
                    <Text style={s.link}>{w.name}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {state === 'cancelled' ? (
              <Text style={s.note}>Nothing was signed and nothing changed.</Text>
            ) : state === 'timeout' ? (
              <Text style={s.note}>
                Your wallet never came back. Check that it is open and responsive,
                then try again.
              </Text>
            ) : state === 'unavailable' ? (
              <Text style={s.note}>
                The wallet could not complete the connection. The raw message is in
                Profile → Developer diagnostics.
              </Text>
            ) : null}

            {rawError ? <Text style={s.raw}>{rawError}</Text> : null}
          </>
        )}
      </Sheet>

      {/* A sealed day, as a detail rather than a section */}
      <Sheet visible={!!day} title={day ? fmtDay(day.roundId) : ''} onClose={() => setDay(null)}>
        <Text style={s.sheetLine}>Sealed on Solana devnet.</Text>
        {day?.signature ? (
          <>
            <Text style={s.meta}>Transaction</Text>
            <Text style={s.mono}>{day.signature}</Text>
            <Press
              style={s.secondary}
              accessibilityRole="link"
              onPress={() => {
                if (day?.signature) {
                  Linking.openURL(`https://explorer.solana.com/tx/${day.signature}?cluster=devnet`);
                }
              }}>
              <Text style={s.secondaryText}>Open in the explorer</Text>
            </Press>
          </>
        ) : (
          <Text style={s.sheetMeta}>
            No transaction is known for this day on this device. The day is still in
            the chain's own record.
          </Text>
        )}
      </Sheet>
    </View>
  );
}

const s = StyleSheet.create({
  root: {flex: 1, backgroundColor: T.ink},
  boot: {flex: 1, backgroundColor: T.ink},
  sheetLead: {...type.body, color: T.paper, lineHeight: 21},
  sheetLine: {...type.section, color: T.paper, marginTop: 14},
  sheetMeta: {...type.body, fontSize: 12.5, marginTop: 10},
  meta: {...type.label, color: T.muted, marginTop: 18},
  mono: {...type.metric, fontSize: 12, marginTop: 6, lineHeight: 17},
  raw: {...type.metric, fontSize: 11, color: T.alert, marginTop: 12, lineHeight: 16},
  note: {...type.body, fontSize: 12.5, marginTop: 14, lineHeight: 18},
  primary: {
    marginTop: 18,
    height: 52,
    borderRadius: 14,
    backgroundColor: T.signal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {color: T.ink, fontSize: 15.5, fontWeight: '800'},
  secondary: {
    marginTop: 18,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: T.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {...type.section, color: T.paper, fontWeight: '600'},
  install: {marginTop: 20},
  link: {...type.section, color: T.steel, fontWeight: '600', marginTop: 6},
});
