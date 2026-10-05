/**
 * The streak, and the four states the plan defines for it.
 *
 * Cold: an empty vessel, not a zero. A zero reads as failure; empty reads as
 * waiting.
 * Lit: the number on a track whose fill is the streak's real fraction of the next
 * milestone. A ring would be decoration; this is a quantity.
 * The seal: the number counts to its new value over 400ms on a LINEAR curve,
 * because it is counting elapsed days and a curve would overstate them.
 * Milestone: one pulse, once, keyed on the on-chain value.
 *
 * Nothing animates on mount. The count-up happens when the streak changes, which
 * means when the chain says it changed - not when the app is opened.
 */

import React, {useEffect, useRef, useState} from 'react';
import {Animated, StyleSheet, Text, View} from 'react-native';
import {T, type} from './theme';
import {DUR, EASE, haptic, isMilestone, milestoneFraction, milestoneTarget, useReducedMotion} from './motion';
import {AsyncStorageBridge} from './storage';

const SEEN_KEY = 'clockin.milestone.seen.v1';

type Props = {
  length: number;
  connected: boolean;
  onPress?: () => void;
};

export default function Streak({length, connected, onPress}: Props) {
  const [shown, setShown] = useState(length);
  const anim = useRef(new Animated.Value(length)).current;
  const prev = useRef(length);
  const fill = useRef(new Animated.Value(milestoneFraction(length))).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const reduced = useReducedMotion();

  // The count-up. Guarded on a genuine change so it never fires on open.
  useEffect(() => {
    if (prev.current === length) return;
    const from = prev.current;
    prev.current = length;

    if (reduced) {
      setShown(length);
      fill.setValue(milestoneFraction(length));
      haptic('success');
      return;
    }

    anim.setValue(from);
    const id = anim.addListener(({value}) => setShown(Math.round(value)));
    Animated.timing(anim, {
      toValue: length,
      duration: DUR.countUp,
      easing: EASE.linear,
      useNativeDriver: false,
    }).start(() => {
      anim.removeListener(id);
      setShown(length);
    });

    Animated.timing(fill, {
      toValue: milestoneFraction(length),
      duration: DUR.countUp,
      easing: EASE.linear,
      useNativeDriver: false,
    }).start();

    haptic('success');
  }, [length, anim, fill, reduced]);

  // Milestones. Recorded per device so reopening the app cannot re-fire it, and
  // keyed on the on-chain value so it cannot fire for a day that did not seal.
  useEffect(() => {
    if (!connected || !isMilestone(length)) return;
    let cancelled = false;
    (async () => {
      try {
        const seen = await AsyncStorageBridge.getItem(SEEN_KEY);
        if (cancelled || seen === String(length)) return;
        await AsyncStorageBridge.setItem(SEEN_KEY, String(length));
        if (reduced) return;
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1.02,
            duration: DUR.pulse / 2,
            easing: EASE.milestone,
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 1,
            duration: DUR.pulse / 2,
            easing: EASE.press,
            useNativeDriver: true,
          }),
        ]).start();
      } catch {
        // A storage failure means no celebration, not a broken screen.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [length, connected, pulse, reduced]);

  const target = milestoneTarget(length);
  const word = length === 1 ? 'day' : 'days';

  if (!connected) {
    return (
      <View style={s.block}>
        <View style={s.coldVessel} />
        <Text style={s.label}>not connected</Text>
        <View style={s.track} />
        <Text style={s.foot}>Connect a wallet to read the record.</Text>
      </View>
    );
  }

  return (
    <Animated.View style={{transform: [{scale: pulse}]}}>
      <View style={s.block}>
        <Text style={[s.big, {color: T.signal}]}>{shown}</Text>
        <Text style={s.label}>
          {word} sealed in a row
        </Text>

        <View style={s.track}>
          <Animated.View
            style={[
              s.fill,
              {
                width: fill.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
        <Text style={s.foot}>
          {length} of {target} to a milestone
        </Text>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  block: {marginTop: 22},
  /** An em dash at 84px read as a grey loading bar. An outlined empty vessel
   *  reads as waiting, which is what the state actually is. */
  coldVessel: {
    width: 48,
    height: 62,
    borderWidth: 1.5,
    borderColor: T.hairline,
    borderRadius: 8,
    marginTop: 6,
    marginBottom: 8,
  },
  big: {fontSize: 84, fontWeight: '800', letterSpacing: -3, lineHeight: 88},
  label: {...type.section, color: T.paper, marginTop: 2},
  track: {
    height: 3,
    borderRadius: 2,
    backgroundColor: T.hairline,
    marginTop: 12,
    overflow: 'hidden',
  },
  fill: {height: 3, borderRadius: 2, backgroundColor: T.signal},
  foot: {...type.metric, fontSize: 11, color: T.muted, marginTop: 8},
});
