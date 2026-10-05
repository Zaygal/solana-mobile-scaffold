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
import {Animated, Dimensions, Platform, Pressable, StatusBar, StyleSheet, Text, View} from 'react-native';
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

export const TABS: {key: TabKey; label: string}[] = [
  {key: 'today', label: 'Today'},
  {key: 'record', label: 'Record'},
  {key: 'verify', label: 'Verify'},
  {key: 'profile', label: 'Profile'},
];

/**
 * The marks are drawn, not typed.
 *
 * The first version used Unicode characters to avoid an icon dependency. The
 * reasoning was right and the characters were not: Record was U+2630 TRIGRAM FOR
 * HEAVEN, which is also the universal hamburger menu, and Profile was U+25EF
 * LARGE CIRCLE, which is an unselected radio button. On a four-tab bar those do
 * not read as slightly-off icons, they name the wrong destination - a menu, and a
 * choice not yet made.
 *
 * Unicode has no person glyph and no list glyph that is not a menu, so these are
 * Views instead: same dependency-free footprint, unambiguous shapes. Record is a
 * stack of entries, because that is what the screen is.
 */
function Mark({tab, color}: {tab: TabKey; color: string}) {
  if (tab === 'today') {
    return (
      <View style={[m.box, m.ring, {borderColor: color}]}>
        <View style={[m.dot, {backgroundColor: color}]} />
      </View>
    );
  }
  if (tab === 'record') {
    return (
      <View style={m.box}>
        <View style={[m.cardBack, {borderColor: color}]} />
        <View style={[m.cardFront, {borderColor: color, backgroundColor: T.panel}]} />
      </View>
    );
  }
  if (tab === 'verify') {
    return (
      <View style={m.box}>
        <View style={[m.check, {borderRightColor: color, borderBottomColor: color}]} />
      </View>
    );
  }
  return (
    <View style={m.box}>
      <View style={[m.head, {backgroundColor: color}]} />
      <View style={[m.shoulders, {backgroundColor: color}]} />
    </View>
  );
}

type Props = {
  active: TabKey;
  onChange: (key: TabKey) => void;
  badge?: Partial<Record<TabKey, string>>;
};

function Tab({
  tabKey,
  label,
  on,
  badge,
  onPress,
}: {
  tabKey: TabKey;
  label: string;
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
      <Pressable onPress={onPress}>
        <Mark tab={tabKey} color={on ? T.signal : T.muted} />
      </Pressable>
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
          tabKey={tab.key}
          label={tab.label}
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

const m = StyleSheet.create({
  box: {width: 22, height: 22, alignItems: 'center', justifyContent: 'center'},
  ring: {borderWidth: 2, borderRadius: 11},
  dot: {width: 8, height: 8, borderRadius: 4},
  cardBack: {position: 'absolute', width: 13, height: 13, borderWidth: 1.7, borderRadius: 3, top: 2, left: 2},
  cardFront: {position: 'absolute', width: 13, height: 13, borderWidth: 1.7, borderRadius: 3, top: 6, left: 6},
  check: {width: 12, height: 12, borderRightWidth: 2.4, borderBottomWidth: 2.4, transform: [{rotate: '45deg'}], marginTop: -4},
  head: {width: 8, height: 8, borderRadius: 4, marginBottom: 1.5},
  shoulders: {width: 17, height: 8, borderTopLeftRadius: 9, borderTopRightRadius: 9},
});

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
