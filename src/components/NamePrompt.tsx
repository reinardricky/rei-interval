import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { theme } from '../theme';

type Props = {
  visible: boolean;
  title: string;
  initialValue: string;
  actionLabel: string;
  onCancel: () => void;
  onSubmit: (name: string) => void;
};

/** Small modal for naming and renaming preset tabs. */
export function NamePrompt({
  visible,
  title,
  initialValue,
  actionLabel,
  onCancel,
  onSubmit,
}: Props) {
  const [value, setValue] = useState(initialValue);

  useEffect(() => {
    if (visible) setValue(initialValue);
  }, [visible, initialValue]);

  const submit = () => {
    const trimmed = value.trim();
    if (trimmed) onSubmit(trimmed);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          {/* Swallow taps inside the card so they do not dismiss it. */}
          <Pressable style={styles.card} onPress={() => {}}>
            <Text style={styles.title}>{title}</Text>
            <TextInput
              value={value}
              onChangeText={setValue}
              autoFocus
              selectTextOnFocus
              maxLength={28}
              placeholder="e.g. Fingerboard"
              placeholderTextColor={theme.textFaint}
              style={styles.input}
              returnKeyType="done"
              onSubmitEditing={submit}
            />
            <View style={styles.actions}>
              <Pressable onPress={onCancel} style={styles.action}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={submit}
                disabled={!value.trim()}
                style={[styles.action, styles.confirm, !value.trim() && styles.disabled]}
              >
                <Text style={styles.confirmText}>{actionLabel}</Text>
              </Pressable>
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.68)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#1A1A1D',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.border,
  },
  title: { color: theme.text, fontSize: 18, fontWeight: '800', marginBottom: 14 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    color: theme.text,
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 18, gap: 8 },
  action: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10 },
  cancelText: { color: theme.textDim, fontWeight: '700', fontSize: 15 },
  confirm: { backgroundColor: theme.brand },
  disabled: { opacity: 0.4 },
  confirmText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
