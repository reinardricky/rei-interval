import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { theme } from '../theme';

type Props = {
  label: string;
  hint?: string;
  glyph: string;
  accent: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  isDuration?: boolean;
  enabled?: boolean;
  onChange: (value: number) => void;
};

/**
 * Labelled row with -/+ controls. Tapping the value opens a keypad: steppers
 * alone are painful for long rests (a 3-minute set rest is 36 taps at 5s each).
 */
export function StepperRow({
  label,
  hint,
  glyph,
  accent,
  value,
  min = 0,
  max = 3600,
  step = 5,
  isDuration = true,
  enabled = true,
  onChange,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const display = !isDuration
    ? String(value)
    : value < 60
      ? `${value}s`
      : value % 60 === 0
        ? `${value / 60}m`
        : `${Math.floor(value / 60)}m ${value % 60}s`;

  const nudge = (delta: number) => {
    const next = Math.min(max, Math.max(min, value + delta));
    if (next !== value) {
      void Haptics.selectionAsync();
      onChange(next);
    }
  };

  const commit = () => {
    const parsed = parseInt(draft, 10);
    if (Number.isFinite(parsed)) onChange(Math.min(max, Math.max(min, parsed)));
    setEditing(false);
  };

  return (
    <View style={[styles.row, !enabled && styles.disabled]}>
      <View style={[styles.badge, { backgroundColor: `${accent}24` }]}>
        <Text style={styles.badgeGlyph}>{glyph}</Text>
      </View>
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Pressable
        onPress={enabled && value > min ? () => nudge(-step) : undefined}
        style={[styles.button, (!enabled || value <= min) && styles.buttonOff]}
      >
        <Text style={styles.buttonGlyph}>−</Text>
      </Pressable>
      <Pressable
        onPress={
          enabled
            ? () => {
                setDraft(String(value));
                setEditing(true);
              }
            : undefined
        }
        style={styles.valueBox}
      >
        <Text style={styles.value}>{display}</Text>
      </Pressable>
      <Pressable
        onPress={enabled && value < max ? () => nudge(step) : undefined}
        style={[styles.button, (!enabled || value >= max) && styles.buttonOff]}
      >
        <Text style={styles.buttonGlyph}>+</Text>
      </Pressable>

      <Modal visible={editing} transparent animationType="fade" onRequestClose={() => setEditing(false)}>
        <Pressable style={styles.backdrop} onPress={() => setEditing(false)}>
          <Pressable style={styles.card} onPress={() => {}}>
            <Text style={styles.cardTitle}>{label}</Text>
            <TextInput
              value={draft}
              onChangeText={(text) => setDraft(text.replace(/[^0-9]/g, ''))}
              autoFocus
              selectTextOnFocus
              keyboardType="number-pad"
              style={styles.input}
              returnKeyType="done"
              onSubmitEditing={commit}
            />
            <Text style={styles.cardHint}>
              {isDuration ? 'Seconds' : 'Count'} · between {min} and {max}
            </Text>
            <View style={styles.cardActions}>
              <Pressable onPress={() => setEditing(false)} style={styles.action}>
                <Text style={styles.cancel}>Cancel</Text>
              </Pressable>
              <Pressable onPress={commit} style={[styles.action, styles.confirm]}>
                <Text style={styles.confirmText}>Set</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  disabled: { opacity: 0.45 },
  badge: { width: 38, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  badgeGlyph: { fontSize: 18 },
  text: { flex: 1, marginLeft: 12 },
  label: { color: theme.text, fontSize: 15, fontWeight: '700' },
  hint: { color: theme.textFaint, fontSize: 11, marginTop: 1 },
  button: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonOff: { opacity: 0.35 },
  buttonGlyph: { color: theme.text, fontSize: 19, fontWeight: '700', lineHeight: 22 },
  valueBox: { minWidth: 68, alignItems: 'center', paddingHorizontal: 4 },
  value: {
    color: theme.text,
    fontSize: 16,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.68)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#1A1A1D',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cardTitle: { color: theme.text, fontSize: 18, fontWeight: '800', marginBottom: 14 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    color: theme.text,
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: 12,
  },
  cardHint: { color: theme.textFaint, fontSize: 12, marginTop: 8, textAlign: 'center' },
  cardActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 16 },
  action: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10 },
  cancel: { color: theme.textDim, fontWeight: '700', fontSize: 15 },
  confirm: { backgroundColor: theme.brand },
  confirmText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
