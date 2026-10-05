/**
 * The hold.
 *
 * A ten-second press with no feedback is asking for ten seconds of blind faith,
 * which was the review's point. This makes the wait legible and felt:
 *
 *  - the action is a vessel, not a button, and it fills from the bottom up.
 *    Bottom-up because "brimming" is a vertical idea; a left-right wipe reads as
 *    a progress bar, which is a different thing.
 *  - the empty part is drawn, not blank: `signalTrack` is the fill colour at 22%
 *    (Apple Fitness's ring-track treatment), so the container reads as something
 *    being filled rather than as an empty stage with something in front of it.
 *  - motion is LINEAR over exactly 10000ms. The reference app eases out, which is
 *    right for decoration, but a hold is a measurement - ease-out would tell the
 *    user they had held longer than they had.
 *  - it is felt: one impact on press, a tick each second, two pulses at the end,
 *    and deliberately nothing at all on an early release, where the absence of a
 *    buzz is the signal that it did not take.
 *
 * Haptics use React Native's own Vibration rather than adding expo-haptics and
 * expo-modules-core to a bare RN app for three feedback types. The mapping to the
 * haptic vocabulary is in UX-DESIGN.md section 3.2.
 *
 * Under reduced motion the fill does not animate at all; the count is shown as a
 * number with the same per-second ticks. Nothing here is carried by animation
 * alone.
 */

import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import {T, signalTrack, type} from './theme';

const HOLD_MS = 10_000;
const SECONDS = HOLD_MS / 1000;
const VESSEL_HEIGHT = 124;

type Props = {
  /** What the hold does, in sentence case. Shown under the vessel. */
  label: string;
  /** Already true for today: the vessel sits full and does not respond. */
  sealed?: boolean;
  sealedLabel?: string;
  disabled?: boolean;
  /** Fired the instant the press begins, so the round engine can time the act. */
  onHoldStart?: () => void;
  /** Fired on an early release, before the fill drains. */
  onRelease?: () => void;
  /** Fired once, when the hold has been kept for the full ten seconds. */
  onComplete: () => void;
};

export default function HoldVessel({
  label,
  sealed = false,
  sealedLabel = 'Today is sealed',
  disabled = false,
  onHoldStart,
  onRelease,
  onComplete,
}: Props) {
  const progress = useRef(new Animated.Value(0)).current;
  const [holding, setHolding] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(SECONDS);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [height, setHeight] = useState(VESSEL_HEIGHT);

  const tick = useRef<ReturnType<typeof setInterval> | null>(null);
  const completion = useRef<ReturnType<typeof setTimeout> | null>(null);
  const taken = useRef(false); // the hold has been granted

  const stopTimers = useCallback(() => {
    if (tick.current) {
      clearInterval(tick.current);
      tick.current = null;
    }
    if (completion.current) {
      clearTimeout(completion.current);
      completion.current = null;
    }
  }, []);

  useEffect(() => {
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduceMotion)
      .catch(() => {});
    return () => {
      sub?.remove?.();
      stopTimers();
    };
  }, [stopTimers]);

  /** Press in: acknowledge the touch immediately, then start counting. */
  const onPressIn = useCallback(() => {
    if (sealed || disabled) return;
    taken.current = false;
    setHolding(true);
    setSecondsLeft(SECONDS);
    Vibration.vibrate(40); // impact: the touch is acknowledged at once
    onHoldStart?.();

    if (!reduceMotion) {
      progress.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration: HOLD_MS,
        easing: Easing.linear, // a measurement, not a decoration
        useNativeDriver: true,
      }).start();
    }

    if (tick.current) clearInterval(tick.current);
    tick.current = setInterval(() => {
      setSecondsLeft(n => (n > 0 ? n - 1 : 0));
      Vibration.vibrate(20); // the count is felt, not read
    }, 1000);

    // Completion is driven by its own timer, not by the animation callback, so
    // that reduced motion and normal motion behave identically. It is cleared on
    // release: without that, letting go early would still seal the round a
    // moment later, which is the exact opposite of what the gesture means.
    completion.current = setTimeout(() => {
      completion.current = null;
      if (tick.current) {
        clearInterval(tick.current);
        tick.current = null;
      }
      taken.current = true;
      setHolding(false);
      Vibration.vibrate([0, 60, 80, 60]); // unmistakably not a tick
      onComplete();
    }, HOLD_MS);
  }, [sealed, disabled, reduceMotion, progress, onComplete, onHoldStart]);

  /**
   * Release. An interrupted hold is not a failure, so there is no message and no
   * error: the fill drains, the count resets, and nothing buzzes.
   */
  const onPressOut = useCallback(() => {
    if (sealed || disabled) return;
    if (taken.current) return; // already granted; leave the completed state alone
    onRelease?.();
    stopTimers();
    setHolding(false);
    setSecondsLeft(SECONDS);
    progress.stopAnimation();
    Animated.timing(progress, {
      toValue: 0,
      duration: 250,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [sealed, disabled, progress, stopTimers, onRelease]);

  // A full-height block translated down, so the fill rises rather than scaling
  // from its centre. Interpolating a transform keeps this on the native driver.
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [height, 0],
  });

  const settled = sealed || taken.current;

  return (
    <View>
      <Pressable
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        disabled={sealed || disabled}
        accessibilityRole="button"
        accessibilityLabel={sealed ? sealedLabel : label}
        accessibilityHint={
          sealed
            ? undefined
            : 'Press and hold for ten seconds. A tick each second marks the time.'
        }
        accessibilityState={{disabled: sealed || disabled}}
        style={({pressed}) => [
          s.vessel,
          {backgroundColor: signalTrack, borderColor: T.hairline},
          pressed && !settled && s.pressed,
        ]}
        onLayout={e => setHeight(e.nativeEvent.layout.height)}>
        {reduceMotion ? (
          // No sweep: the vessel is simply full or empty, and the number counts.
          settled && <View style={[s.fill, {backgroundColor: T.signal}]} />
        ) : (
          <Animated.View
            pointerEvents="none"
            style={[s.fill, {backgroundColor: T.signal, transform: [{translateY}]}]}>
            {/* The leading edge: 2px brighter. This is the light. */}
            <View style={s.edge} />
          </Animated.View>
        )}

        {reduceMotion && !settled && (
          <View style={s.centre} pointerEvents="none">
            <Text style={[s.count, {color: T.paper}]}>{holding ? secondsLeft : SECONDS}</Text>
          </View>
        )}
      </Pressable>

      <Text style={[s.label, {color: sealed ? T.signal : T.paper}]}>
        {sealed ? sealedLabel : label}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  vessel: {
    height: VESSEL_HEIGHT,
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  pressed: {transform: [{scale: 0.97}]},
  fill: {position: 'absolute', left: 0, right: 0, top: 0, bottom: 0},
  edge: {position: 'absolute', top: 0, left: 0, right: 0, height: 2, backgroundColor: '#6EE79A'},
  centre: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: {fontSize: 52, fontWeight: '800', fontVariant: ['tabular-nums']},
  label: {...type.section, marginTop: 12},
});
