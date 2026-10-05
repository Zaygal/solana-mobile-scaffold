/**
 * Four destinations, always present, never scrolling away.
 *
 * Persistent bottom navigation is the single clearest signal that something is an
 * application rather than a document, and its absence is most of why the previous
 * interface read as a web page: there was nowhere to go, and no way to tell where
 * you already were.
 *
 * The active tab draws its underline outward from the centre in 160ms. React
 * Native scales a transform from an element's centre by default, so a scaleX from
 * 0 to 1 IS the centre-outward draw - no transform origin needed.
 *
 * Glyphs rather than an icon package: no new dependency in a bare React Native
 * app, and four marks this simple read fine at 20px.
 */

import React, {useEffect, useRef} from 'react';
import {Animated, Dimensions, Platform, StatusBar, StyleSheet, Text, View} from 'react-native';
import {T, type} from '../theme';
import {DUR, EASE, haptic, useReducedMotion} from '../motion';

/**
 * The system navigation bar sits on top of the tab bar on a device that draws the
 * app edge to edge, which is what the capture shows. Without pulling in a native
 * safe-area dependency two days before submission, the inset is derivable: window
 * height excludes the system bars, screen height does not.
 */
const _win = Dimensions.get('window');
const _scr = Dimensions.get('screen');
const BOTTOM_INSET =
  Platform.OS === 'android'
    ? Math.max(0, _scr.height - _win.height - (StatusBar.currentHeight ?? 0))
    : 0;

export type TabKey = 'today' | 'record' | 'verify' | 'profile';

export const TABS: {key: TabKey; label: string; glyph: string}[] = [
  {key: 'today', label: 'Today', glyph: '\u25c9'},
  {key: 'record', label: 'Record', glyph: '\u2630'},
  {key: 'verify', label: 'Verify', glyph: '\u2713'},
  {key: 'profile', label: 'Profile', glyph: '\u25ef'},
];

type Props = {
  active: TabKey;
  onChange: (key: TabKey) => void;
  badge?: Partial<Record<TabKey, string>>;
};

function Tab({
  label,
  glyph,
  on,
  badge,
  onPress,
}: {
  label: string;
  glyph: string;
  on: boolean;
  badge?: string;
  onPress: () => void;
}) {
  const draw = useRef(new Animated.Value(on ? 1 : 0)).current;
  const reduced = useReducedMotion();

  useEffect(() => {
    if (reduced) {
      draw.setValue(on ? 1 : 0);
      return;
    }
    Animated.timing(draw, {
      toValue: on ? 1 : 0,
      duration: DUR.tab,
      easing: EASE.press,
      useNativeDriver: true,
    }).start();
  }, [on, draw, reduced]);

  return (
    <View
      style={st.tab}
      accessibilityRole="tab"
      accessibilityState={{selected: on}}
      accessibilityLabel={label}>
      <Text
        onPress={onPress}
        suppressHighlighting
        style={[st.glyph, {color: on ? T.signal : T.muted}]}>
        {glyph}
      </Text>
      {badge ? (
        <View style={st.badge}>
          <Text style={st.badgeText}>{badge}</Text>
        </View>
      ) : null}
      <Text
        onPress={onPress}
        suppressHighlighting
        style={[st.label, {color: on ? T.paper : T.muted}]}>
        {label}
      </Text>
      <Animated.View
        style={[
          st.underline,
          {backgroundColor: on ? T.signal : T.hairline, transform: [{scaleX: draw}]},
        ]}
      />
    </View>
  );
}

export default function BottomNav({active, onChange, badge}: Props) {
  return (
    <View style={st.bar} accessibilityRole="tablist">
      {TABS.map(tab => (
        <Tab
          key={tab.key}
          label={tab.label}
          glyph={tab.glyph}
          on={tab.key === active}
          badge={badge?.[tab.key]}
          onPress={() => {
            if (tab.key === active) return;
            haptic('tick');
            onChange(tab.key);
          }}
        />
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    height: 62 + BOTTOM_INSET,
    paddingBottom: BOTTOM_INSET,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.hairline,
    backgroundColor: T.panel,
  },
  tab: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 7},
  glyph: {fontSize: 20, lineHeight: 24},
  label: {...type.label, fontSize: 10, letterSpacing: 0.6, marginTop: 3},
  underline: {
    position: 'absolute',
    bottom: 0,
    left: '22%',
    right: '22%',
    height: 2,
    borderRadius: 1,
  },
  badge: {
    position: 'absolute',
    right: -12,
    top: -4,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: T.signal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {color: T.ink, fontSize: 10, fontWeight: '800'},
});
