import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Preset, presetSummary } from '../models/preset';
import { onAccent, theme } from '../theme';
import { NamePrompt } from './NamePrompt';

type Props = {
  presets: Preset[];
  activeId: string;
  canDelete: boolean;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
};

/**
 * Horizontal strip of preset tabs plus a "+" to add one. Each tab owns its
 * intervals and saves as you edit, so there is no explicit save action —
 * switching tabs is the whole interaction.
 */
export function PresetTabs({
  presets,
  activeId,
  canDelete,
  onSelect,
  onCreate,
  onRename,
  onDuplicate,
  onDelete,
}: Props) {
  const scrollRef = useRef<ScrollView>(null);
  const countRef = useRef(presets.length);
  const [sheetFor, setSheetFor] = useState<Preset | null>(null);
  const [prompt, setPrompt] = useState<'create' | 'rename' | null>(null);
  const [renameTarget, setRenameTarget] = useState<Preset | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Preset | null>(null);

  useEffect(() => {
    // A tab added off the right edge would otherwise open invisibly.
    if (presets.length > countRef.current) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
    countRef.current = presets.length;
  }, [presets.length]);

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {presets.map((preset) => {
          const isActive = preset.id === activeId;
          return (
            <Pressable
              key={preset.id}
              onPress={() => (isActive ? setSheetFor(preset) : onSelect(preset.id))}
              onLongPress={() => setSheetFor(preset)}
              style={[styles.tab, isActive ? styles.tabActive : styles.tabIdle]}
            >
              <Text
                numberOfLines={1}
                style={[styles.tabText, isActive ? styles.tabTextActive : styles.tabTextIdle]}
              >
                {preset.name}
              </Text>
              {isActive ? <Text style={styles.tabMore}>···</Text> : null}
            </Pressable>
          );
        })}
      </ScrollView>
      <Pressable onPress={() => setPrompt('create')} style={styles.add}>
        <Text style={styles.addGlyph}>+</Text>
      </Pressable>

      <OptionsSheet
        preset={sheetFor}
        canDelete={canDelete}
        onClose={() => setSheetFor(null)}
        onRename={(preset) => {
          setSheetFor(null);
          setRenameTarget(preset);
          setPrompt('rename');
        }}
        onDuplicate={(preset) => {
          setSheetFor(null);
          onDuplicate(preset.id);
        }}
        onDelete={(preset) => {
          setSheetFor(null);
          setConfirmDelete(preset);
        }}
      />

      <NamePrompt
        visible={prompt !== null}
        title={prompt === 'rename' ? 'Rename preset' : 'New preset'}
        initialValue={prompt === 'rename' ? (renameTarget?.name ?? '') : ''}
        actionLabel={prompt === 'rename' ? 'Rename' : 'Create'}
        onCancel={() => setPrompt(null)}
        onSubmit={(name) => {
          if (prompt === 'rename' && renameTarget) onRename(renameTarget.id, name);
          else if (prompt === 'create') onCreate(name);
          setPrompt(null);
        }}
      />

      <ConfirmDelete
        preset={confirmDelete}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={(preset) => {
          setConfirmDelete(null);
          onDelete(preset.id);
        }}
      />
    </View>
  );
}

function OptionsSheet({
  preset,
  canDelete,
  onClose,
  onRename,
  onDuplicate,
  onDelete,
}: {
  preset: Preset | null;
  canDelete: boolean;
  onClose: () => void;
  onRename: (p: Preset) => void;
  onDuplicate: (p: Preset) => void;
  onDelete: (p: Preset) => void;
}) {
  return (
    <Modal visible={preset !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.grabber} />
          {preset ? (
            <>
              <Text style={styles.sheetTitle}>{preset.name}</Text>
              <Text style={styles.sheetSubtitle}>{presetSummary(preset)}</Text>
              <SheetItem label="Rename" onPress={() => onRename(preset)} />
              <SheetItem label="Duplicate" onPress={() => onDuplicate(preset)} />
              <SheetItem
                label="Delete"
                destructive
                disabled={!canDelete}
                hint={canDelete ? undefined : 'Keep at least one preset'}
                onPress={() => onDelete(preset)}
              />
            </>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SheetItem({
  label,
  onPress,
  destructive,
  disabled,
  hint,
}: {
  label: string;
  onPress: () => void;
  destructive?: boolean;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={[styles.sheetItem, disabled && styles.disabled]}
    >
      <Text
        style={[
          styles.sheetItemText,
          destructive && { color: theme.danger },
          disabled && { color: theme.textFaint },
        ]}
      >
        {label}
      </Text>
      {hint ? <Text style={styles.sheetHint}>{hint}</Text> : null}
    </Pressable>
  );
}

function ConfirmDelete({
  preset,
  onCancel,
  onConfirm,
}: {
  preset: Preset | null;
  onCancel: () => void;
  onConfirm: (p: Preset) => void;
}) {
  return (
    <Modal visible={preset !== null} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.sheetBackdrop} onPress={onCancel}>
        <Pressable style={styles.confirmCard} onPress={() => {}}>
          <Text style={styles.sheetTitle}>Delete preset?</Text>
          <Text style={styles.sheetSubtitle}>
            &quot;{preset?.name}&quot; and its intervals will be removed. This cannot be undone.
          </Text>
          <View style={styles.confirmActions}>
            <Pressable onPress={onCancel} style={styles.action}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => preset && onConfirm(preset)}
              style={[styles.action, { backgroundColor: theme.danger }]}
            >
              <Text style={styles.confirmText}>Delete</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center' },
  strip: { gap: 8, paddingRight: 8, alignItems: 'center' },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
    maxWidth: 190,
  },
  tabActive: { backgroundColor: theme.brand, borderColor: theme.brand },
  tabIdle: { backgroundColor: theme.surface, borderColor: theme.border },
  tabText: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  tabTextActive: { color: onAccent(theme.brand) },
  tabTextIdle: { color: theme.textDim },
  tabMore: { color: onAccent(theme.brand), marginLeft: 8, fontSize: 14, fontWeight: '800' },
  add: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.brandWash,
  },
  addGlyph: { color: theme.brand, fontSize: 24, fontWeight: '600', lineHeight: 28 },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.68)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1A1A1D',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingBottom: 34,
    paddingTop: 10,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginBottom: 14,
  },
  sheetTitle: { color: theme.text, fontSize: 18, fontWeight: '800' },
  sheetSubtitle: { color: theme.textDim, fontSize: 13, marginTop: 4, marginBottom: 12 },
  sheetItem: { paddingVertical: 15, borderTopWidth: 1, borderTopColor: theme.border },
  sheetItemText: { color: theme.text, fontSize: 16, fontWeight: '600' },
  sheetHint: { color: theme.textFaint, fontSize: 12, marginTop: 2 },
  disabled: { opacity: 0.55 },
  confirmCard: {
    margin: 24,
    marginBottom: 60,
    backgroundColor: '#1A1A1D',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: theme.border,
  },
  confirmActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  action: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 10 },
  cancelText: { color: theme.textDim, fontWeight: '700', fontSize: 15 },
  confirmText: { color: onAccent(theme.danger), fontWeight: '800', fontSize: 15 },
});
