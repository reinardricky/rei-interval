import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CircuitEditor } from '../components/CircuitEditor';
import { STOPWATCH_BAR_HEIGHT } from '../components/StopwatchBar';
import { TabStrip } from '../components/TabStrip';
import { StepperRow } from '../components/StepperRow';
import { Circuit, Mode, circuitsUsing, resolveSteps } from '../models/circuit';
import { formatDuration } from '../models/config';
import { Preset, presetSummary } from '../models/preset';
import { buildCircuitTimeline } from '../models/timeline';
import { onAccent, phaseColors, theme } from '../theme';

/** The session-summary card carries the brand gradient. */
const SUMMARY_WASH = [theme.brand, theme.brandDeep] as const;
import type { IntervalApp } from '../useIntervalApp';

export function SetupScreen({ app }: { app: IntervalApp }) {
  const insets = useSafeAreaInsets();
  const { config, timeline, activeCircuit } = app;
  const set = <K extends keyof typeof config>(key: K, value: number) =>
    app.updateConfig({ ...config, [key]: value });
  const canStart = timeline.segments.length > 0;

  const describeCircuit = (circuit: Circuit) => {
    const steps = resolveSteps(circuit, app.presets);
    const length = formatDuration(buildCircuitTimeline(steps).totalDuration);
    return `${steps.length} ${steps.length === 1 ? 'exercise' : 'exercises'}  ·  ${length}`;
  };

  const presetDeleteMessage = (preset: Preset) => {
    const used = circuitsUsing(app.circuits, preset.id);
    const knockOn = used
      ? ` It will also be removed from ${used} ${used === 1 ? 'circuit' : 'circuits'}.`
      : '';
    return `"${preset.name}" and its intervals will be removed.${knockOn} This cannot be undone.`;
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + STOPWATCH_BAR_HEIGHT + 2,
            paddingBottom: insets.bottom + 120,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.appTitle}>Rei&apos;s Interval</Text>

        <ModeToggle mode={app.mode} onChange={app.selectMode} />

        <View style={styles.tabsWrap}>
          {app.isCircuit ? (
            // Keyed so switching modes mounts a fresh strip: a reused one keeps
            // the other list's scroll offset and tab count, and mistakes the
            // longer list for newly added tabs.
            <TabStrip
              key="circuits"
              items={app.circuits}
              activeId={activeCircuit?.id ?? ''}
              noun="circuit"
              placeholder="e.g. Leg day"
              canDelete
              describe={describeCircuit}
              deleteMessage={(c) =>
                `"${c.name}" will be removed. The presets it uses are kept. This cannot be undone.`
              }
              onSelect={app.selectCircuit}
              onCreate={(name) => app.createCircuit(name)}
              onRename={app.renameCircuit}
              onDuplicate={app.duplicateCircuit}
              onDelete={app.deleteCircuit}
            />
          ) : (
            <TabStrip
              key="presets"
              items={app.presets}
              activeId={app.activeId}
              noun="preset"
              placeholder="e.g. Fingerboard"
              canDelete={app.canDelete}
              describe={presetSummary}
              deleteMessage={presetDeleteMessage}
              onSelect={app.selectPreset}
              onCreate={(name) => app.createTab(name)}
              onRename={app.renameTab}
              onDuplicate={app.duplicateTab}
              onDelete={app.deleteTab}
            />
          )}
        </View>

        {app.isCircuit && !activeCircuit ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No circuits yet</Text>
            <Text style={styles.emptyText}>
              Tap + to chain presets into one continuous workout. Each exercise
              is followed by its set rest before the next one starts.
            </Text>
          </View>
        ) : (
          <LinearGradient
            colors={SUMMARY_WASH}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.summary}
          >
            <View style={styles.summaryHeader}>
              <Text style={styles.summaryLabel}>SESSION LENGTH</Text>
              <Pressable onPress={app.toggleSound} hitSlop={10}>
                <Text style={styles.soundGlyph}>{app.soundEnabled ? '🔊' : '🔇'}</Text>
              </Pressable>
            </View>
            <Text style={styles.summaryValue}>{formatDuration(timeline.totalDuration)}</Text>
            <Text style={styles.summaryDetail}>
              {app.isCircuit
                ? `${timeline.blocks.length} ${timeline.blocks.length === 1 ? 'exercise' : 'exercises'}  ·  ${timeline.workCount} work intervals`
                : `${timeline.workCount} work intervals  ·  ${config.cycles} cycles × ${config.sets} ${config.sets === 1 ? 'set' : 'sets'}`}
            </Text>
          </LinearGradient>
        )}

        {app.isCircuit ? (
          activeCircuit ? (
            <CircuitEditor
              circuit={activeCircuit}
              presets={app.presets}
              onChange={app.updateCircuit}
            />
          ) : null
        ) : (
          <PresetFields config={config} set={set} />
        )}
      </ScrollView>

      <View style={[styles.startWrap, { paddingBottom: insets.bottom + 18 }]}>
        <Pressable
          style={[styles.start, !canStart && styles.startDisabled]}
          onPress={canStart ? app.start : undefined}
          accessibilityState={{ disabled: !canStart }}
        >
          <Text style={styles.startText}>
            {app.isCircuit ? '▶  Start circuit' : '▶  Start workout'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (mode: Mode) => void }) {
  return (
    <View style={styles.mode} accessibilityRole="tablist">
      {(['presets', 'circuits'] as const).map((option) => {
        const selected = option === mode;
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={[styles.modeOption, selected && styles.modeOptionActive]}
          >
            <Text style={[styles.modeText, selected && styles.modeTextActive]}>
              {option === 'presets' ? 'Presets' : 'Circuits'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function PresetFields({
  config,
  set,
}: {
  config: IntervalApp['config'];
  set: (key: keyof IntervalApp['config'], value: number) => void;
}) {
  return (
    <>
      <Text style={styles.section}>INTERVALS</Text>
      <StepperRow
        label="Prepare"
        hint="Countdown before the first work interval"
        glyph="⏳"
        accent={phaseColors.prepare}
        value={config.prepareSeconds}
        min={0}
        max={300}
        onChange={(v) => set('prepareSeconds', v)}
      />
      <StepperRow
        label="Work"
        hint="Time under tension"
        glyph="⚡"
        accent={phaseColors.work}
        value={config.workSeconds}
        min={1}
        max={900}
        onChange={(v) => set('workSeconds', v)}
      />
      <StepperRow
        label="Rest"
        hint="Recovery between cycles"
        glyph="🧘"
        accent={phaseColors.rest}
        value={config.restSeconds}
        min={0}
        max={900}
        onChange={(v) => set('restSeconds', v)}
      />

      <Text style={styles.section}>VOLUME</Text>
      <StepperRow
        label="Cycles"
        hint="Work / rest rounds per set"
        glyph="🔁"
        accent={phaseColors.work}
        value={config.cycles}
        min={1}
        max={99}
        step={1}
        isDuration={false}
        onChange={(v) => set('cycles', v)}
      />
      <StepperRow
        label="Sets"
        hint="Groups of cycles"
        glyph="📚"
        accent={phaseColors.work}
        value={config.sets}
        min={1}
        max={20}
        step={1}
        isDuration={false}
        onChange={(v) => set('sets', v)}
      />
      {/* Always editable: even a single-set preset uses it as the break
          after it in a circuit. */}
      <StepperRow
        label="Rest between sets"
        hint={
          config.sets > 1
            ? 'Long recovery between sets'
            : 'Break after this exercise in a circuit'
        }
        glyph="💤"
        accent={phaseColors.setRest}
        value={config.setRestSeconds}
        min={0}
        max={1800}
        step={15}
        onChange={(v) => set('setRestSeconds', v)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.base },
  content: { paddingHorizontal: 16, maxWidth: 640, width: '100%', alignSelf: 'center' },
  appTitle: {
    color: theme.text,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  tabsWrap: { marginBottom: 16 },
  mode: {
    flexDirection: 'row',
    padding: 3,
    borderRadius: 12,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    marginBottom: 12,
  },
  modeOption: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  modeOptionActive: { backgroundColor: theme.surfaceStrong },
  modeText: { color: theme.textFaint, fontSize: 13, fontWeight: '700' },
  modeTextActive: { color: theme.text },
  empty: {
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.border,
    padding: 18,
  },
  emptyTitle: { color: theme.text, fontSize: 16, fontWeight: '800' },
  emptyText: { color: theme.textDim, fontSize: 13, marginTop: 6, lineHeight: 19 },
  summary: { borderRadius: 18, padding: 16 },
  summaryHeader: { flexDirection: 'row', alignItems: 'center' },
  summaryLabel: {
    flex: 1,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  soundGlyph: { fontSize: 18 },
  summaryValue: {
    color: '#fff',
    fontSize: 34,
    fontWeight: '800',
    marginTop: 6,
    letterSpacing: -1,
  },
  summaryDetail: { color: 'rgba(255,255,255,0.92)', fontSize: 13, marginTop: 4 },
  section: {
    color: theme.textFaint,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginTop: 22,
    marginBottom: 10,
    marginLeft: 4,
  },
  startWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: 'rgba(14,14,16,0.94)',
  },
  start: {
    backgroundColor: theme.brand,
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  startDisabled: { opacity: 0.4 },
  startText: {
    color: onAccent(theme.brand),
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
