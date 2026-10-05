/**
 * A sheet.
 *
 * Modal presentation is how a phone does a task rather than a place: it slides
 * up, it owns the screen while it is open, and dismissing it returns you exactly
 * where you were. Its absence was part of why the old interface read as a web
 * page - there were no tasks, only one long document.
 *
 * React Native's own Modal, with the platform's slide transition. No dependency.
 */

import React from 'react';
import {Modal, Pressable, StyleSheet, Text, View} from 'react-native';
import {T, type} from '../theme';

type Props = {
  visible: boolean;
  title?: string;
  onClose: () => void;
  children: React.ReactNode;
};

export default function Sheet({visible, title, onClose, children}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent>
      <Pressable style={s.scrim} onPress={onClose} accessibilityLabel="Dismiss" />
      <View style={s.sheet}>
        <View style={s.grabber} />
        <View style={s.head}>
          <Text style={s.title}>{title ?? ''}</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
            <Text style={s.close}>Close</Text>
          </Pressable>
        </View>
        <View style={s.body}>{children}</View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '86%',
    backgroundColor: T.ink,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: T.hairline,
    paddingBottom: 28,
  },
  grabber: {
    alignSelf: 'center',
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: T.hairline,
    marginTop: 10,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: {...type.display, fontSize: 21},
  close: {...type.section, color: T.muted, fontWeight: '600'},
  body: {paddingHorizontal: 22, paddingTop: 6},
});
