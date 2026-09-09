import React from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PhaseClock } from '../components/PhaseClock';
import { PhaseList } from '../components/PhaseList';
import { formatClock } from '../models/config';
import { phaseLabel } from '../models/timeline';
import { pausedColor, phaseColors, theme, tint } from '../theme';
import type { IntervalApp } from '../useIntervalApp';

/**
 * Built on a near-black ground with the phase colour used as an accent — ring,
 * active row, primary control — plus a gradient wash bleeding from the top.
 * Flooding the screen with the phase colour instead leaves nothing to contrast
 * against: text, cards and the queue all sink into the background.
 */
export function WorkoutScreen({ app }: { app: IntervalApp }) {
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const paused = app.status === 'paused';
  // Paused drains the colour out entirely — an unmistakable signal that the
  // clock is not running, without needing to read anything.
  const accent = paused ? pausedColor : phaseColors[app.phase];

  const diameter = Math.max(
    140,
    Math.min(300, Math.min(height * 0.34, width * 0.74)),
  );

  return (
    <LinearGradient
      colors={[tint(accent, 0.42), tint(accent, 0.12), theme.base]}
      locations={[0, 0.34, 0.7]}
      style={styles.root}
    >
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.headerLabel}>TOTAL REMAINING</Text>
            <Text style={styles.headerValue}>{formatClock(app.totalRemaining)}</Text>
          </View>
          <Pressable onPress={app.toggleSound} hitSlop={12}>
            <Text style={styles.sound}>{app.soundEnabled ? '🔊' : '🔇'}</Text>
          </Pressable>
        </View>
        <View style={styles.track}>
          <View
            style={[
              styles.trackFill,
              { width: `${app.overallProgress * 100}%`, backgroundColor: accent },
            ]}
          />
        </View>
      </View>

      <View style={styles.clockWrap}>
        <PhaseClock
          secondsRemaining={app.secondsRemaining}
          progress={app.phaseProgress}
          label={paused ? 'Paused' : phaseLabel[app.phase]}
          accent={accent}
          diameter={diameter}
        />
        <View style={styles.chips}>
          <Chip label="Cycle" value={`${app.currentCycle}/${app.config.cycles}`} />
          {app.config.sets > 1 ? (
            <Chip label="Set" value={`${app.currentSet}/${app.config.sets}`} />
          ) : null}
        </View>
      </View>

      <View style={styles.listWrap}>
        <PhaseList
          timeline={app.timeline}
          currentIndex={app.segmentIndex}
          showSets={app.config.sets > 1}
          accent={accent}
        />
      </View>

      <View style={[styles.controls, { paddingBottom: insets.bottom + 16 }]}>
        <RoundButton glyph="↻" label="Reset" onPress={app.reset} size={54} />
        <RoundButton
          glyph={app.status === 'running' ? '❚❚' : '▶'}
          label={app.status === 'running' ? 'Pause' : 'Resume'}
          onPress={app.toggle}
          size={78}
          fill={accent}
        />
        <RoundButton glyph="⏭" label="Skip phase" onPress={app.skip} size={54} />
      </View>
    </LinearGradient>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.chipValue}>{value}</Text>
    </View>
  );
}

function RoundButton({
  glyph,
  label,
  onPress,
  size,
  fill,
}: {
  glyph: string;
  label: string;
  onPress: () => void;
  size: number;
  fill?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.round,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: fill ?? 'rgba(255,255,255,0.10)',
        },
      ]}
    >
      <Text
        style={{
          color: fill ? '#000' : '#fff',
          fontSize: size * 0.34,
          fontWeight: '700',
        }}
      >
        {glyph}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.base },
  header: { paddingHorizontal: 22, paddingRight: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center' },
  headerText: { flex: 1 },
  headerLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.8,
  },
  headerValue: {
    color: theme.text,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  sound: { fontSize: 20 },
  track: {
    height: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginTop: 12,
    overflow: 'hidden',
  },
  trackFill: { height: 4, borderRadius: 4 },
  clockWrap: { alignItems: 'center', paddingTop: 14 },
  chips: { flexDirection: 'row', gap: 10, marginTop: 20 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: theme.border,
  },
  chipLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  chipValue: {
    color: theme.text,
    fontSize: 17,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  listWrap: { flex: 1, marginTop: 22 },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 30,
    paddingTop: 8,
  },
  round: { alignItems: 'center', justifyContent: 'center' },
});
