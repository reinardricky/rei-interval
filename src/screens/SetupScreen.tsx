import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PresetTabs } from '../components/PresetTabs';
import { StepperRow } from '../components/StepperRow';
import { formatDuration, totalSeconds } from '../models/config';
import { onAccent, phaseColors, theme } from '../theme';

/** The session-summary card carries the brand gradient. */
const SUMMARY_WASH = [theme.brand, theme.brandDeep] as const;
import type { IntervalApp } from '../useIntervalApp';

export function SetupScreen({ app }: { app: IntervalApp }) {
  const insets = useSafeAreaInsets();
  const { config, timeline } = app;
  const set = <K extends keyof typeof config>(key: K, value: number) =>
    app.updateConfig({ ...config, [key]: value });

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 120 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.appTitle}>Rei&apos;s Interval</Text>

        <View style={styles.tabsWrap}>
          <PresetTabs
            presets={app.presets}
            activeId={app.activeId}
            canDelete={app.canDelete}
            onSelect={app.selectPreset}
            onCreate={app.createTab}
            onRename={app.renameTab}
            onDuplicate={app.duplicateTab}
            onDelete={app.deleteTab}
          />
        </View>

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
          <Text style={styles.summaryValue}>{formatDuration(totalSeconds(config))}</Text>
          <Text style={styles.summaryDetail}>
            {timeline.workCount} work intervals  ·  {config.cycles} cycles ×{' '}
            {config.sets} {config.sets === 1 ? 'set' : 'sets'}
          </Text>
        </LinearGradient>

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
        <StepperRow
          label="Rest between sets"
          hint="Long recovery between sets"
          glyph="💤"
          accent={phaseColors.setRest}
          value={config.setRestSeconds}
          min={0}
          max={1800}
          step={15}
          enabled={config.sets > 1}
          onChange={(v) => set('setRestSeconds', v)}
        />
      </ScrollView>

      <View style={[styles.startWrap, { paddingBottom: insets.bottom + 18 }]}>
        <Pressable style={styles.start} onPress={app.start}>
          <Text style={styles.startText}>▶  Start workout</Text>
        </Pressable>
      </View>
    </View>
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
  startText: {
    color: onAccent(theme.brand),
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
});
