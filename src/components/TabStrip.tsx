import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { Named } from '../models/preset';
import { onAccent, theme } from '../theme';
import { NamePrompt } from './NamePrompt';

type Props<T extends Named> = {
  items: T[];
  activeId: string;
  /** What a tab is called in sheets and prompts: "preset", "circuit". */
  noun: string;
  placeholder: string;
  canDelete: boolean;
  /** One-line description for the options sheet. */
  describe: (item: T) => string;
  /** Body of the delete confirmation. */
  deleteMessage: (item: T) => string;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
};

/**
 * Horizontal strip of tabs plus a "+" to add one. Each tab saves as you edit,
 * so there is no explicit save action — switching tabs is the whole
 * interaction. Serves both presets and circuits.
 */
export function TabStrip<T extends Named>({
  items,
  activeId,
  noun,
  placeholder,
  canDelete,
  describe,
  deleteMessage,
  onSelect,
  onCreate,
  onRename,
  onDuplicate,
  onDelete,
}: Props<T>) {
  const scrollRef = useRef<ScrollView>(null);
  const countRef = useRef(items.length);
  /** The open tab is brought into view once, when the strip first lays out. */
  const revealedRef = useRef(false);
  const [sheetFor, setSheetFor] = useState<T | null>(null);
  const [prompt, setPrompt] = useState<'create' | 'rename' | null>(null);
  const [renameTarget, setRenameTarget] = useState<T | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<T | null>(null);

  useEffect(() => {
    // A tab added off the right edge would otherwise open invisibly.
    if (items.length > countRef.current) {
      scrollRef.current?.scrollToEnd({ animated: true });
    }
    countRef.current = items.length;
  }, [items.length]);

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
      >
        {items.map((item) => {
          const isActive = item.id === activeId;
          return (
            <Pressable
              key={item.id}
              onPress={() => (isActive ? setSheetFor(item) : onSelect(item.id))}
              onLongPress={() => setSheetFor(item)}
              onLayout={
                isActive
                  ? (event) => {
                      // Mounting starts the strip at the left edge, which can
                      // leave the open tab hidden off the right.
                      if (revealedRef.current) return;
                      revealedRef.current = true;
                      const x = Math.max(0, event.nativeEvent.layout.x - 16);
                      scrollRef.current?.scrollTo({ x, animated: false });
                    }
                  : undefined
              }
              style={[styles.tab, isActive ? styles.tabActive : styles.tabIdle]}
            >
              <Text
                numberOfLines={1}
                style={[styles.tabText, isActive ? styles.tabTextActive : styles.tabTextIdle]}
              >
                {item.name}
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
        item={sheetFor}
        noun={noun}
        canDelete={canDelete}
        describe={describe}
        onClose={() => setSheetFor(null)}
        onRename={(item) => {
          setSheetFor(null);
          setRenameTarget(item);
          setPrompt('rename');
        }}
        onDuplicate={(item) => {
          setSheetFor(null);
          onDuplicate(item.id);
        }}
        onDelete={(item) => {
          setSheetFor(null);
          setConfirmDelete(item);
        }}
      />

      <NamePrompt
        visible={prompt !== null}
        title={prompt === 'rename' ? `Rename ${noun}` : `New ${noun}`}
        initialValue={prompt === 'rename' ? (renameTarget?.name ?? '') : ''}
        actionLabel={prompt === 'rename' ? 'Rename' : 'Create'}
        placeholder={placeholder}
        onCancel={() => setPrompt(null)}
        onSubmit={(name) => {
          if (prompt === 'rename' && renameTarget) onRename(renameTarget.id, name);
          else if (prompt === 'create') onCreate(name);
          setPrompt(null);
        }}
      />

      <ConfirmDelete
        item={confirmDelete}
        title={`Delete ${noun}?`}
        message={confirmDelete ? deleteMessage(confirmDelete) : ''}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={(item) => {
          setConfirmDelete(null);
          onDelete(item.id);
        }}
      />
    </View>
  );
}

function OptionsSheet<T extends Named>({
  item,
  noun,
  canDelete,
  describe,
  onClose,
  onRename,
  onDuplicate,
  onDelete,
}: {
  item: T | null;
  noun: string;
  canDelete: boolean;
  describe: (item: T) => string;
  onClose: () => void;
  onRename: (item: T) => void;
  onDuplicate: (item: T) => void;
  onDelete: (item: T) => void;
}) {
  return (
    <Modal visible={item !== null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.grabber} />
          {item ? (
            <>
              <Text style={styles.sheetTitle}>{item.name}</Text>
              <Text style={styles.sheetSubtitle}>{describe(item)}</Text>
              <SheetItem label="Rename" onPress={() => onRename(item)} />
              <SheetItem label="Duplicate" onPress={() => onDuplicate(item)} />
              <SheetItem
                label="Delete"
                destructive
                disabled={!canDelete}
                hint={canDelete ? undefined : `Keep at least one ${noun}`}
                onPress={() => onDelete(item)}
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

function ConfirmDelete<T extends Named>({
  item,
  title,
  message,
  onCancel,
  onConfirm,
}: {
  item: T | null;
  title: string;
  message: string;
  onCancel: () => void;
  onConfirm: (item: T) => void;
}) {
  return (
    <Modal visible={item !== null} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.sheetBackdrop} onPress={onCancel}>
        <Pressable style={styles.confirmCard} onPress={() => {}}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <Text style={styles.sheetSubtitle}>{message}</Text>
          <View style={styles.confirmActions}>
            <Pressable onPress={onCancel} style={styles.action}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => item && onConfirm(item)}
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
