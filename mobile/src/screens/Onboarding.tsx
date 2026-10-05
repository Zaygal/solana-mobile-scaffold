/**
 * First launch.
 *
 * Three panels, swipeable, skippable, shown once. The old first screen was a
 * brand, a sentence and a Connect Wallet button, which told a new user nothing
 * about the product and asked them for something before they had a reason to give
 * it.
 *
 * Swiping uses ScrollView with pagingEnabled rather than a gesture library:
 * horizontal paging is a platform behaviour, and this app has enough native
 * dependencies without adding one for a carousel.
 */

import React, {useRef, useState} from 'react';
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {T, type} from '../theme';

const PANELS = [
  {
    title: 'One round a day',
    body: 'A round is one UTC day. Inside it, one act: hold for ten seconds. That is the whole commitment, and it is small enough to keep.',
  },
  {
    title: 'The streak is written to Solana',
    body: 'Finishing a round seals the day on-chain. The streak is not a number this app keeps for you — it is read back from the network every time you open it.',
  },
  {
    title: 'You do not have to trust this app',
    body: 'The record can be checked without it, using a standalone verifier and nothing else. Where the evidence stops, the record says so.',
  },
];

export default function Onboarding({onDone}: {onDone: () => void}) {
  const [index, setIndex] = useState(0);
  const width = Dimensions.get('window').width;
  const ref = useRef<ScrollView>(null);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  const last = index === PANELS.length - 1;

  return (
    <View style={s.root}>
      <View style={s.topRow}>
        <Text style={s.brand}>Clock In</Text>
        <Pressable onPress={onDone} hitSlop={12} accessibilityRole="button">
          <Text style={s.skip}>Skip</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        style={s.pager}>
        {PANELS.map(p => (
          <View key={p.title} style={[s.panel, {width}]}>
            <Text style={s.title}>{p.title}</Text>
            <Text style={s.body}>{p.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={s.footer}>
        <View style={s.dots}>
          {PANELS.map((p, i) => (
            <View
              key={p.title}
              style={[s.dot, {backgroundColor: i === index ? T.signal : T.hairline}]}
            />
          ))}
        </View>
        <Pressable
          style={s.primary}
          onPress={() => {
            if (!last) ref.current?.scrollTo({x: width * (index + 1), animated: true});
            else onDone();
          }}
          accessibilityRole="button">
          <Text style={s.primaryText}>{last ? 'Get started' : 'Continue'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: {flex: 1, backgroundColor: T.ink},
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 58,
  },
  brand: {...type.label, color: T.muted},
  skip: {...type.section, color: T.muted, fontWeight: '600'},
  pager: {flex: 1},
  panel: {flex: 1, justifyContent: 'center', paddingHorizontal: 30},
  title: {...type.display, fontSize: 32, lineHeight: 38},
  body: {...type.body, color: T.paper, fontSize: 16, lineHeight: 24, marginTop: 16, opacity: 0.85},
  footer: {paddingHorizontal: 22, paddingBottom: 40},
  dots: {flexDirection: 'row', justifyContent: 'center', marginBottom: 22},
  dot: {width: 7, height: 7, borderRadius: 4, marginHorizontal: 4},
  primary: {
    height: 54,
    borderRadius: 14,
    backgroundColor: T.signal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {color: T.ink, fontSize: 16, fontWeight: '800'},
});
