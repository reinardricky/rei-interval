import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatDuration, totalSeconds } from '../models/config';
import { theme } from '../theme';
import type { IntervalApp } from '../useIntervalApp';

const ACCENT = '#22C55E';

export function CompleteScreen({ app }: { app: IntervalApp }) {
  const insets = useSafeAreaInsets();

  return (
    <LinearGradient
      colors={['#1B3B27', '#13221A', theme.base]}
      locations={[0, 0.4, 0.78]}
      style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      <View style={styles.center}>
        <View style={styles.check}>
          <Text style={styles.checkGlyph}>✓</Text>
        </View>
        <Text style={styles.title}>Session complete</Text>
        <Text style={styles.detail}>
          {app.timeline.workCount} work intervals  ·  {formatDuration(totalSeconds(app.config))}
          {app.config.sets > 1 ? `  ·  ${app.config.sets} sets` : ''}
        </Text>
        <View style={styles.actions}>
          <Pressable style={[styles.button, styles.primary]} onPress={app.start}>
            <Text style={styles.primaryText}>Run it again</Text>
          </Pressable>
          <Pressable style={[styles.button, styles.secondary]} onPress={app.reset}>
            <Text style={styles.secondaryText}>Back to setup</Text>
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.base },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  check: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkGlyph: { color: '#04160B', fontSize: 52, fontWeight: '800' },
  title: {
    color: theme.text,
    fontSize: 30,
    fontWeight: '800',
    marginTop: 26,
    letterSpacing: -0.5,
  },
  detail: {
    color: theme.textDim,
    fontSize: 14,
    marginTop: 10,
    textAlign: 'center',
    fontWeight: '500',
  },
  actions: { flexDirection: 'row', gap: 12, marginTop: 32, flexWrap: 'wrap', justifyContent: 'center' },
  button: { paddingHorizontal: 26, paddingVertical: 15, borderRadius: 30 },
  primary: { backgroundColor: ACCENT },
  primaryText: { color: '#04160B', fontSize: 15, fontWeight: '800' },
  secondary: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  secondaryText: { color: theme.text, fontSize: 15, fontWeight: '800' },
});
