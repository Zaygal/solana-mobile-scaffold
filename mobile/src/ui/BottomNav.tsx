/**
 * Four destinations, always present, never scrolling away.
 *
 * Persistent bottom navigation is the single clearest signal that something is
 * an application rather than a document, and its absence is most of why the
 * previous interface read as a web page: there was nowhere to go, and no way to
 * tell where you already were.
 *
 * Icons are drawn from glyphs rather than an icon font or an icon package. Two
 * reasons: no new dependency in a bare React Native app, and these four marks
 * are simple enough to read at 22px without one.
 */

import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {T, type} from '../theme';

export type TabKey = 'today' | 'record' | 'verify' | 'profile';

export const TABS: {key: TabKey; label: string; glyph: string}[] = [
  {key: 'today', label: 'Today', glyph: '◉'},
  {key: 'record', label: 'Record', glyph: '☰'},
  {key: 'verify', label: 'Verify', glyph: '✓'},
  {key: 'profile', label: 'Profile', glyph: '☺'},
];

type Props = {
  active: TabKey;
  onChange: (key: TabKey) => void;
  /** Small count on a tab where a number is genuinely meaningful. */
  badge?: Partial<Record<TabKey, string>>;
};

export default function BottomNav({active, onChange, badge}: Props) {
  return (
    <View style={s.bar} accessibilityRole="tablist">
      {TABS.map(tab => {
        const on = tab.key === active;
        const b = badge?.[tab.key];
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{selected: on}}
            accessibilityLabel={tab.label}
            style={s.tab}
            hitSlop={8}>
            <View>
              <Text style={[s.glyph, {color: on ? T.signal : T.muted}]}>{tab.glyph}</Text>
              {b ? (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{b}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[s.label, {color: on ? T.paper : T.muted}]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    height: 58,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: T.hairline,
    backgroundColor: T.panel,
  },
  tab: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 6},
  glyph: {fontSize: 20, lineHeight: 22},
  label: {...type.label, fontSize: 10, letterSpacing: 0.6, marginTop: 3},
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
