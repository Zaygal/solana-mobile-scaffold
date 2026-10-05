/**
 * The press primitive.
 *
 * One implementation of "the surface heard you", so every tappable thing in the
 * app behaves identically. The previous build had Pressables whose only feedback
 * was the platform's ripple, which is why touching things felt like touching a
 * web page.
 *
 * Press: scale to 0.94 over 90ms on the press curve. Release: spring back, so it
 * settles rather than snapping. Haptic on the press, never on release, and the
 * caller decides what the haptic means.
 */

import React, {useRef} from 'react';
import {Animated, Pressable, StyleProp, ViewStyle} from 'react-native';
import {DUR, EASE, haptic, HapticKind, useReducedMotion} from '../motion';

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  hapticKind?: HapticKind;
  accessibilityLabel?: string;
  accessibilityRole?: 'button' | 'link' | 'tab';
  accessibilityState?: {selected?: boolean; disabled?: boolean};
};

export default function Press({
  children,
  onPress,
  style,
  disabled,
  hapticKind = 'impact',
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const reduced = useReducedMotion();

  const down = () => {
    if (disabled) return;
    haptic(hapticKind);
    if (reduced) return;
    Animated.timing(scale, {
      toValue: 0.94,
      duration: DUR.press,
      easing: EASE.press,
      useNativeDriver: true,
    }).start();
  };

  const up = () => {
    if (reduced) return;
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 22,
      bounciness: 7,
    }).start();
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={down}
      onPressOut={up}
      disabled={disabled}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}>
      <Animated.View style={[style, {transform: [{scale}]}, disabled && {opacity: 0.5}]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
