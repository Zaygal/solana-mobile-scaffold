/**
 * Clock In — the application.
 *
 * This file owns the product experience. The previous version was a diagnostic
 * harness that also happened to be the home screen: it auto-connected on launch,
 * so the first thing a user ever saw was a protocol error. That is a failure
 * state, not an application.
 *
 * What this does differently:
 *
 *  - NOTHING connects on launch. The home screen is a product screen, and the
 *    wallet flow begins only when the user asks for it. This is the single most
 *    important change in the file.
 *  - The wallet flow is the real one. `connectWallet()` is the same function as
 *    before, unchanged: it calls Mobile Wallet Adapter's `authorize` through
 *    `transact`, and the platform performs wallet discovery and selection. There
 *    is no wallet picker here, no hard-coded wallet, no imitation of the
 *    handoff. If no compatible wallet is installed we say so calmly, once the
 *    user has actually asked to connect.
 *  - Protocol detail is developer information. RPC, identity, the canonical seal
 *    payload, the round-trip check and raw connection errors all still exist, and
 *    they live behind "Developer diagnostics", collapsed by default.
 *  - Launch still emits the MWASCAFFOLD log lines and runs the seal round-trip
 *    check with no interaction, because CI asserts on exactly those. Dropping
 *    them would trade a real verification for a tidier file.
 */

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {T} from './src/theme';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {connectWallet} from './src/mobileWallet';
import {APP_IDENTITY, EXPLORER, RPC_ENDPOINT} from './src/config';
import {roundIdFor} from './src/round';
import {decodeSeal, encodeSeal, sealFromOutcome, streakFromSeals} from './src/seal';
import RoundScreen from './src/RoundScreen';

/** The wallet lifecycle as the user experiences it. */
type WalletState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'unavailable' // no compatible wallet on this device
  | 'cancelled' // user backed out of the wallet flow
  | 'timeout'; // the handoff never returned

const T = {
  bg: T.ink,
  surface: T.panel,
  border: T.hairline,
  ink: T.paper,
  dim: T.muted,
  faint: T.muted,
  signal: T.signal,
  signalInk: '#1E1400',
  chain: T.steel,
  warn: T.alert,
  bad: T.alert,
  good: T.signal,
};

/** Specific and true. No claim the record cannot support. */
const PRODUCT_LINE =
  'One round a day. The streak is written to Solana, so anyone can check it without trusting this app.';

export default function App() {
  const [state, setState] = useState<WalletState>('disconnected');
  const [address, setAddress] = useState<string | null>(null);
  const [rawError, setRawError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [showDiagnostics, setShowDiagnostics] = useState(false);

  const say = useCallback((line: string) => {
    console.log('MWASCAFFOLD', line);
    setLog(prev => [...prev, line].slice(-14));
  }, []);

  // Launch diagnostics. Deliberately no wallet interaction: the emulator runner
  // has no funded wallet, so anything behind a wallet tap would never execute in
  // CI - and a launch that reaches for a wallet is the defect this file exists
  // to remove.
  useEffect(() => {
    say(`rpc ${RPC_ENDPOINT}`);
    say(`identity ${APP_IDENTITY.name}`);
    try {
      const probe = sealFromOutcome(roundIdFor(new Date()), {
        peak: 0.42,
        durationMs: 10_400,
        source: 'manual',
      });
      const encoded = encodeSeal(probe);
      const decoded = decodeSeal(encoded);
      const streak = streakFromSeals(decoded ? [decoded] : []);
      say(`seal "${encoded}"`);
      say(`seal-roundtrip ${decoded && decoded.roundId === probe.roundId ? 'OK' : 'FAIL'}`);
      say(`streak-length ${streak.length} latest ${streak.latest}`);
    } catch (e: any) {
      say(`seal-error ${e?.message ?? String(e)}`);
    }
  }, [say]);

  /**
   * The one place the wallet flow is entered. Everything around it exists to
   * make this moment feel intentional, and nothing here imitates it.
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
      say('connect-ok');
    } catch (e: any) {
      settled = true;
      clearTimeout(guard);
      const message = e?.message ?? String(e);
      setRawError(message);
      say(`connect-error ${message}`);

      // Classify by what actually happened, so the screen can say something true
      // and useful rather than a generic failure. The message is the only signal
      // the platform gives us; the raw text stays in diagnostics.
      const lower = message.toLowerCase();
      if (lower.includes('cancel') || lower.includes('reject') || lower.includes('declin') || lower.includes('denied')) {
        setState('cancelled');
      } else {
        setState('unavailable');
      }
    }
  }, [say]);

  const onRetry = useCallback(() => {
    setState('disconnected');
    setRawError(null);
  }, []);

  const short = address ? `${address.slice(0, 4)}…${address.slice(-4)}` : null;
  const diagnostics = useMemo(
    () => (
      <Diagnostics
        log={log}
        rawError={rawError}
        expanded={showDiagnostics}
        onToggle={() => setShowDiagnostics(v => !v)}
      />
    ),
    [log, rawError, showDiagnostics],
  );

  // ---------------------------------------------------------------- connected
  if (state === 'connected' && address) {
    return (
      <View style={s.root}>
        <SafeAreaView style={s.flex}>
          <View style={s.walletBar}>
            <View style={s.walletDot} />
            <Text style={s.walletText}>{short}</Text>
            <Text style={s.walletMeta}>connected</Text>
          </View>
          <RoundScreen address={address} />
        </SafeAreaView>
        <SafeAreaView style={s.diagWrap}>{diagnostics}</SafeAreaView>
      </View>
    );
  }

  // --------------------------------------------------------------------- home
  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.body}>
        <View style={s.brandBlock}>
          <View style={s.mark}>
            <Pulse />
          </View>
          <Text style={s.brand}>Clock In</Text>
          <Text style={s.brandSub}>A daily round, sealed on Solana</Text>
        </View>

        {state === 'connecting' ? (
          <View style={s.stateBlock}>
            <ActivityIndicator color={T.signal} />
            <Text style={s.stateTitle}>Connecting wallet…</Text>
            <Text style={s.stateBody}>
              Preparing a secure connection. Your wallet app will open to approve it — nothing is
              signed until you approve it there.
            </Text>
          </View>
        ) : state === 'unavailable' ? (
          <Notice
            tone="warn"
            title="Wallet unavailable"
            body="We couldn't find a compatible wallet on this device. Clock In signs through Mobile Wallet Adapter, which needs a wallet app installed alongside it."
            action="Try again"
            onAction={onConnect}
            secondary="How do I get a wallet?"
            onSecondary={() => Linking.openURL('https://solana.com/ecosystem/wallets')}
          />
        ) : state === 'cancelled' ? (
          <Notice
            tone="neutral"
            title="Connection cancelled"
            body="Nothing was signed and nothing changed. You can connect whenever you're ready."
            action="Connect wallet"
            onAction={onConnect}
          />
        ) : state === 'timeout' ? (
          <Notice
            tone="warn"
            title="The wallet didn't respond"
            body="We asked your wallet to connect and it never came back. Check that the wallet app is open and responsive, then try again."
            action="Try again"
            onAction={onConnect}
          />
        ) : (
          <>
            <Text style={s.pitch}>{PRODUCT_LINE}</Text>

            <Pressable style={s.primary} onPress={onConnect} accessibilityRole="button">
              <Text style={s.primaryText}>Connect Wallet</Text>
            </Pressable>
            <Text style={s.underPrimary}>Securely connect using Mobile Wallet Adapter</Text>

            <View style={s.rule} />
            <Text style={s.howTitle}>How it works</Text>
            <Step n="1" text="Connect a wallet. It stays on this device; we never see your keys." />
            <Step n="2" text="Take today's round and hold to attest it." />
            <Step n="3" text="The day is sealed to Solana, and the streak becomes something anyone can verify." />
            <Text style={s.limit}>
              Runs on devnet. The seal proves your wallet signed this claim at this time — not that a
              physical act happened, which the record itself states openly.
            </Text>
          </>
        )}

        <Pressable style={s.ghost} onPress={() => setShowDiagnostics(v => !v)} accessibilityRole="button">
          <Text style={s.ghostText}>
            {showDiagnostics ? 'Hide developer diagnostics' : 'Developer diagnostics'}
          </Text>
        </Pressable>
        {showDiagnostics && (
          <View style={s.diagCard}>
            {log.map((l, i) => (
              <Text key={i} style={s.mono}>
                {l}
              </Text>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** One slow pulse. The only motion on the screen, and it means "today". */
function Pulse() {
  const v = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, {toValue: 1, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true}),
        Animated.timing(v, {toValue: 0.35, duration: 1600, easing: Easing.inOut(Easing.ease), useNativeDriver: true}),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v]);
  return <Animated.View style={[s.markInner, {opacity: v}]} />;
}

function Step({n, text}: {n: string; text: string}) {
  return (
    <View style={s.step}>
      <Text style={s.stepN}>{n}</Text>
      <Text style={s.stepText}>{text}</Text>
    </View>
  );
}

function Notice(props: {
  tone: 'warn' | 'neutral';
  title: string;
  body: string;
  action: string;
  onAction: () => void;
  secondary?: string;
  onSecondary?: () => void;
}) {
  const colour = props.tone === 'warn' ? T.warn : T.dim;
  return (
    <View style={s.notice}>
      <Text style={[s.noticeTitle, {color: colour}]}>{props.title}</Text>
      <Text style={s.noticeBody}>{props.body}</Text>
      <Pressable style={s.primary} onPress={props.onAction} accessibilityRole="button">
        <Text style={s.primaryText}>{props.action}</Text>
      </Pressable>
      {props.secondary && props.onSecondary ? (
        <Pressable onPress={props.onSecondary}>
          <Text style={s.link}>{props.secondary}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function Diagnostics({
  log,
  rawError,
  expanded,
  onToggle,
}: {
  log: string[];
  rawError: string | null;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <View style={s.diagBar}>
      <Pressable onPress={onToggle} style={s.diagHead} accessibilityRole="button">
        <Text style={s.diagTitle}>Developer diagnostics</Text>
        <Text style={s.diagChevron}>{expanded ? '▾' : '▸'}</Text>
      </Pressable>
      {expanded ? (
        <ScrollView style={s.diagBody} nestedScrollEnabled>
          {log.map((l, i) => (
            <Text key={i} style={s.mono}>
              {l}
            </Text>
          ))}
          {rawError ? <Text style={[s.mono, {color: T.bad}]}>last-error {rawError}</Text> : null}
          <Text style={s.monoDim}>rpc {RPC_ENDPOINT}</Text>
          <Text style={s.monoDim}>explorer https://explorer.solana.com/?cluster=devnet</Text>
        </ScrollView>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: {flex: 1, backgroundColor: T.bg},
  flex: {flex: 1},
  body: {padding: 24, paddingBottom: 56},

  brandBlock: {alignItems: 'center', marginTop: 34, marginBottom: 30},
  mark: {
    width: 62,
    height: 62,
    borderRadius: 31,
    borderWidth: 2,
    borderColor: T.chain,
    alignItems: 'center',
    justifyContent: 'center',
  },
  markInner: {width: 22, height: 22, borderRadius: 11, backgroundColor: T.signal},
  brand: {color: T.ink, fontSize: 30, fontWeight: '800', marginTop: 18, letterSpacing: -0.4},
  brandSub: {color: T.dim, fontSize: 14, marginTop: 6},

  pitch: {color: T.ink, fontSize: 19, lineHeight: 28, fontWeight: '600'},

  primary: {
    backgroundColor: T.signal,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 22,
  },
  primaryText: {color: T.signalInk, fontSize: 17, fontWeight: '800'},
  underPrimary: {color: T.faint, fontSize: 12.5, textAlign: 'center', marginTop: 10},

  stateBlock: {alignItems: 'center', paddingVertical: 34},
  stateTitle: {color: T.ink, fontSize: 19, fontWeight: '700', marginTop: 18},
  stateBody: {color: T.dim, fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: 10},

  notice: {paddingVertical: 18},
  noticeTitle: {fontSize: 20, fontWeight: '800'},
  noticeBody: {color: T.dim, fontSize: 14.5, lineHeight: 22, marginTop: 10},
  link: {color: T.signal, fontSize: 14, marginTop: 16, textAlign: 'center'},

  rule: {height: 1, backgroundColor: T.border, marginTop: 30},
  howTitle: {color: T.ink, fontSize: 15, fontWeight: '700', marginTop: 20},
  step: {flexDirection: 'row', marginTop: 14},
  stepN: {color: T.chain, fontSize: 14, fontWeight: '800', width: 22},
  stepText: {color: T.dim, fontSize: 14, lineHeight: 21, flex: 1},
  limit: {color: T.faint, fontSize: 12.5, lineHeight: 19, marginTop: 22},

  ghost: {marginTop: 34, borderTopWidth: 1, borderTopColor: T.border, paddingTop: 16},
  ghostText: {color: T.faint, fontSize: 13, textAlign: 'center', fontWeight: '600'},
  diagCard: {backgroundColor: T.surface, borderRadius: 10, padding: 14, marginTop: 14},
  mono: {color: '#C6D0DA', fontSize: 11, lineHeight: 17, fontVariant: ['tabular-nums']},
  monoDim: {color: T.faint, fontSize: 11, lineHeight: 17},

  walletBar: {flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12},
  walletDot: {width: 7, height: 7, borderRadius: 4, backgroundColor: T.good, marginRight: 8},
  walletText: {color: T.ink, fontSize: 13.5, fontWeight: '700', fontVariant: ['tabular-nums']},
  walletMeta: {color: T.faint, fontSize: 12.5, marginLeft: 8},

  diagWrap: {borderTopWidth: 1, borderTopColor: T.border, backgroundColor: T.bg},
  diagBar: {paddingHorizontal: 20, paddingVertical: 6},
  diagHead: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8},
  diagTitle: {color: T.faint, fontSize: 12, fontWeight: '700', letterSpacing: 0.4},
  diagChevron: {color: T.faint, fontSize: 13},
  diagBody: {maxHeight: 190, paddingBottom: 8},
});
