import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';

import { Circuit, moveStep } from '../models/circuit';
import { formatDuration } from '../models/config';
import { Preset, presetSummary } from '../models/preset';
import { phaseColors, theme } from '../theme';

type Props = {
  circuit: Circuit;
  presets: Preset[];
  onChange: (next: Circuit) => void;
};

/**
 * The steps of a circuit, in play order. Steps point at presets, so the
 * intervals themselves are tuned on the preset's own tab; this only arranges
 * them. Between each pair it shows the break the session will take, which is
 * the earlier exercise's set rest.
 */
export function CircuitEditor({ circuit, presets, onChange }: Props) {
  const [picking, setPicking] = useState(false);
  // A step whose preset has been deleted is already gone from the circuit, but
  // filter defensively so a stale id can never render as a blank row.
  const steps = circuit.presetIds
    .map((id, index) => ({ index, preset: presets.find((p) => p.id === id) }))
    .filter((s): s is { index: number; preset: Preset } => s.preset !== undefined);

  const remove = (index: number) =>
    onChange({ ...circuit, presetIds: circuit.presetIds.filter((_, i) => i !== index) });

  return (
    <View>
      <Text style={styles.section}>EXERCISES</Text>
      {steps.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            No exercises yet. Add presets to play them back to back as one workout.
          </Text>
        </View>
      ) : null}

      {steps.map(({ index, preset }, position) => (
        <React.Fragment key={`${index}-${preset.id}`}>
          {position > 0 ? (
            <Break
              seconds={steps[position - 1].preset.config.setRestSeconds}
              from={steps[position - 1].preset.name}
              waits={circuit.pauseBetween}
            />
          ) : null}
          <View style={styles.step}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepNumber}>{position + 1}</Text>
            </View>
            <View style={styles.stepText}>
              <Text style={styles.stepName} numberOfLines={1}>
                {preset.name}
              </Text>
              <Text style={styles.stepDetail} numberOfLines={1}>
                {presetSummary(preset)}
              </Text>
            </View>
            <StepButton
              glyph="↑"
              label={`Move ${preset.name} up`}
              enabled={position > 0}
              onPress={() => onChange(moveStep(circuit, index, -1))}
            />
            <StepButton
              glyph="↓"
              label={`Move ${preset.name} down`}
              enabled={position < steps.length - 1}
              onPress={() => onChange(moveStep(circuit, index, 1))}
            />
            <StepButton
              glyph="✕"
              label={`Remove ${preset.name}`}
              enabled
              onPress={() => remove(index)}
            />
          </View>
        </React.Fragment>
      ))}

      <Pressable style={styles.add} onPress={() => setPicking(true)}>
        <Text style={styles.addText}>+  Add exercise</Text>
      </Pressable>

      <Text style={styles.section}>OPTIONS</Text>
      <View style={styles.option}>
        <View style={styles.optionBadge}>
          <Text style={styles.optionGlyph}>✋</Text>
        </View>
        <View style={styles.stepText}>
          <Text style={styles.stepName}>Pause between exercises</Text>
          <Text style={styles.stepDetail}>Wait for a tap after each break</Text>
        </View>
        <Switch
          value={circuit.pauseBetween}
          onValueChange={(pauseBetween) => onChange({ ...circuit, pauseBetween })}
          trackColor={{ false: 'rgba(255,255,255,0.18)', true: theme.brand }}
          thumbColor="#FFFFFF"
        />
      </View>

      <PresetPicker
        visible={picking}
        presets={presets}
        onClose={() => setPicking(false)}
        onPick={(preset) => {
          setPicking(false);
          onChange({ ...circuit, presetIds: [...circuit.presetIds, preset.id] });
        }}
      />
    </View>
  );
}

function Break({ seconds, from, waits }: { seconds: number; from: string; waits: boolean }) {
  const parts = [seconds > 0 ? `${formatDuration(seconds)} set rest` : 'No break'];
  if (waits) parts.push('then wait for tap');
  return (
    <View style={styles.break} accessibilityLabel={`${parts.join(', ')}, from ${from}`}>
      <View style={styles.breakLine} />
      <Text style={styles.breakText}>💤  {parts.join('  ·  ')}</Text>
      <View style={styles.breakLine} />
    </View>
  );
}

function StepButton({
  glyph,
  label,
  enabled,
  onPress,
}: {
  glyph: string;
  label: string;
  enabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={enabled ? onPress : undefined}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !enabled }}
      hitSlop={4}
      style={[styles.stepButton, !enabled && styles.stepButtonOff]}
    >
      <Text style={styles.stepButtonGlyph}>{glyph}</Text>
    </Pressable>
  );
}

function PresetPicker({
  visible,
  presets,
  onClose,
  onPick,
}: {
  visible: boolean;
  presets: Preset[];
  onClose: () => void;
  onPick: (preset: Preset) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <View style={styles.grabber} />
          <Text style={styles.sheetTitle}>Add exercise</Text>
          <Text style={styles.sheetSubtitle}>Pick a preset to add to the end of the circuit.</Text>
          <ScrollView style={styles.sheetList}>
            {presets.map((preset) => (
              <Pressable key={preset.id} style={styles.sheetItem} onPress={() => onPick(preset)}>
                <Text style={styles.sheetItemText}>{preset.name}</Text>
                <Text style={styles.sheetHint}>{presetSummary(preset)}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  section: {
    color: theme.textFaint,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginTop: 22,
    marginBottom: 10,
    marginLeft: 4,
  },
  empty: {
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.border,
    padding: 16,
    marginBottom: 10,
  },
  emptyText: { color: theme.textDim, fontSize: 13, textAlign: 'center' },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  stepBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.brandWash,
  },
  stepNumber: { color: theme.brand, fontSize: 16, fontWeight: '800' },
  stepText: { flex: 1, marginLeft: 6 },
  stepName: { color: theme.text, fontSize: 15, fontWeight: '700' },
  stepDetail: { color: theme.textFaint, fontSize: 11, marginTop: 1 },
  stepButton: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonOff: { opacity: 0.3 },
  stepButtonGlyph: { color: theme.text, fontSize: 15, fontWeight: '700' },
  break: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  breakLine: { flex: 1, height: 1, backgroundColor: `${phaseColors.setRest}40` },
  breakText: { color: phaseColors.setRest, fontSize: 12, fontWeight: '700' },
  add: {
    marginTop: 10,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: theme.brandWash,
  },
  addText: { color: theme.brand, fontSize: 15, fontWeight: '800' },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  optionBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${phaseColors.prepare}24`,
  },
  optionGlyph: { fontSize: 18 },
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
    maxHeight: '75%',
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
  sheetList: { flexGrow: 0 },
  sheetItem: { paddingVertical: 13, borderTopWidth: 1, borderTopColor: theme.border },
  sheetItemText: { color: theme.text, fontSize: 16, fontWeight: '600' },
  sheetHint: { color: theme.textFaint, fontSize: 12, marginTop: 2 },
});
