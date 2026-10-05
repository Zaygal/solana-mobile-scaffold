/**
 * The frame every tab screen is drawn inside.
 *
 * This is the piece that stops the app reading as a web page. A mobile screen
 * has a compact header that stays put, one scrollable body, and a bottom inset
 * that clears the tab bar - not a vertically stacked set of document sections
 * running off the bottom of the viewport.
 *
 * The header is deliberately small: a title, an optional one-line subtitle, and
 * at most one action on the right. No hero area, no oversized type.
 */

import React from 'react';
import {
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {T, type} from '../theme';

export const TAB_BAR_HEIGHT = 58;

type Props = {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  /** Screens that manage their own scrolling (lists with pull-to-refresh). */
  children: React.ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
};

export default function Screen({
  title,
  subtitle,
  action,
  children,
  scroll = true,
  refreshing,
  onRefresh,
}: Props) {
  const body = scroll ? (
    <ScrollView
      style={s.body}
      contentContainerStyle={s.bodyContent}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={T.muted} />
        ) : undefined
      }>
      {children}
    </ScrollView>
  ) : (
    <View style={[s.body, s.bodyContent]}>{children}</View>
  );

  return (
    <View style={s.root}>
      <View style={s.header}>
        <View style={s.headerText}>
          <Text style={s.title}>{title}</Text>
          {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
        </View>
        {action ? <View style={s.headerAction}>{action}</View> : null}
      </View>
      {body}
    </View>
  );
}

/**
 * The top inset has to clear the system status bar, because the header's title is
 * drawn at the top of the window and the status bar's clock and notification icons
 * are painted over it when it does not.
 *
 * This uses || and not ??. StatusBar.currentHeight returns 0 on at least one real
 * device, and ?? only falls through on null or undefined - so 0 passed straight
 * through, TOP_INSET became 0, and every screen title sat underneath the clock.
 */
export const TOP_INSET =
  Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 44;

const s = StyleSheet.create({
  root: {flex: 1, backgroundColor: T.ink},
  header: {
    paddingTop: TOP_INSET + 10,
    paddingHorizontal: 20,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.hairline,
  },
  headerText: {flex: 1},
  headerAction: {marginLeft: 12},
  title: {...type.display, fontSize: 26},
  subtitle: {...type.body, marginTop: 2},
  body: {flex: 1},
  bodyContent: {paddingHorizontal: 20, paddingBottom: TAB_BAR_HEIGHT + 24},
});
