import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import {Connection} from '@solana/web3.js';
import {connectWallet, sendTestTransfer} from './src/mobileWallet';
import {APP_IDENTITY, EXPLORER, RPC_ENDPOINT, TRANSFER_LAMPORTS} from './src/config';

type Phase = 'idle' | 'connecting' | 'sending' | 'done' | 'error';

export default function App() {
  const [phase, setPhase] = useState<Phase>('idle');
  const [address, setAddress] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const say = useCallback((line: string) => {
    console.log('MWASCAFFOLD', line);
    setLog(prev => [...prev, line].slice(-8));
  }, []);

  // The scaffold is a diagnostic build: it exercises the Mobile Wallet Adapter
  // path on launch so CI can assert on logcat without a human tapping.
  useEffect(() => {
    say(`rpc ${RPC_ENDPOINT}`);
    say(`identity ${APP_IDENTITY.name}`);
    (async () => {
      try {
        setPhase('connecting');
        const auth = await connectWallet();
        setAddress(auth.address);
        say('connected');
        setPhase('idle');
      } catch (e: any) {
        say(`connect-error ${e?.message ?? String(e)}`);
        setError(e?.message ?? String(e));
        setPhase('error');
      }
    })();
  }, [say]);

  const onSend = useCallback(async () => {
    if (!address) return;
    setError(null);
    setSignature(null);
    try {
      setPhase('sending');
      const connection = new Connection(RPC_ENDPOINT, 'confirmed');
      const sig = await sendTestTransfer({
        connection,
        fromAddress: address,
        lamports: TRANSFER_LAMPORTS,
      });
      setSignature(sig);
      say('confirmed');
      setPhase('done');
    } catch (e: any) {
      say(`send-error ${e?.message ?? String(e)}`);
      setError(e?.message ?? String(e));
      setPhase('error');
    }
  }, [address, say]);

  return (
    <SafeAreaView style={s.root}>
      <ScrollView contentContainerStyle={s.body}>
        <Text style={s.kicker}>SOLANA MOBILE STACK</Text>
        <Text style={s.title}>Mobile Wallet Adapter</Text>
        <Text style={s.sub}>Devnet only. Proves a real wallet transaction from a real APK.</Text>

        <View style={s.card}>
          <Text style={s.label}>WALLET</Text>
          <Text style={s.mono}>{address ?? '—'}</Text>
          <Text style={s.label}>STATUS</Text>
          <Text style={[s.value, phase === 'error' && s.bad]}>
            {phase === 'connecting' ? 'waiting for wallet approval…'
              : phase === 'sending' ? 'signing and sending…'
              : phase === 'done' ? 'transaction confirmed'
              : phase === 'error' ? 'failed' : 'ready'}
          </Text>
          {(phase === 'connecting' || phase === 'sending') && (
            <ActivityIndicator color="#7C5CFF" style={{marginTop: 12}} />
          )}
        </View>

        <TouchableOpacity
          style={[s.button, (!address || phase === 'sending') && s.buttonOff]}
          disabled={!address || phase === 'sending'}
          onPress={onSend}>
          <Text style={s.buttonText}>Send 0.0001 SOL to self</Text>
        </TouchableOpacity>

        {signature && (
          <View style={[s.card, s.good]}>
            <Text style={s.label}>SIGNATURE</Text>
            <Text style={s.mono}>{signature}</Text>
            <Text style={s.hint}>{EXPLORER(signature)}</Text>
          </View>
        )}

        {error && (
          <View style={[s.card, s.badCard]}>
            <Text style={s.label}>ERROR</Text>
            <Text style={s.mono}>{error}</Text>
          </View>
        )}

        <View style={s.card}>
          <Text style={s.label}>DIAGNOSTICS</Text>
          {log.map((l, i) => <Text key={i} style={s.mono}>{l}</Text>)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: {flex: 1, backgroundColor: '#0B0F14'},
  body: {padding: 22, paddingBottom: 48},
  kicker: {color: '#00E0B8', fontSize: 11, letterSpacing: 2.4, fontWeight: '700'},
  title: {color: '#F4F6FA', fontSize: 30, fontWeight: '800', marginTop: 6},
  sub: {color: '#8A93A5', fontSize: 13, marginTop: 6, lineHeight: 19},
  card: {backgroundColor: '#141A22', borderRadius: 14, padding: 16, marginTop: 16, borderWidth: 1, borderColor: '#1E2732'},
  good: {borderColor: '#00E0B8'},
  badCard: {borderColor: '#FF5C7A'},
  label: {color: '#6E7686', fontSize: 10, letterSpacing: 1.6, fontWeight: '700', marginTop: 6},
  value: {color: '#F4F6FA', fontSize: 16, marginTop: 4, fontWeight: '600'},
  bad: {color: '#FF5C7A'},
  mono: {color: '#C9D2E0', fontSize: 12, marginTop: 4, lineHeight: 18},
  hint: {color: '#7C5CFF', fontSize: 11, marginTop: 8},
  button: {backgroundColor: '#7C5CFF', borderRadius: 14, padding: 17, alignItems: 'center', marginTop: 18},
  buttonOff: {opacity: 0.35},
  buttonText: {color: '#FFFFFF', fontWeight: '700', fontSize: 15},
});
