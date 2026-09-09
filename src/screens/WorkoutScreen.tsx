import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PhaseClock } from '../components/PhaseClock';
import { PhaseList } from '../components/PhaseList';
import { TransportIcon, type TransportIconName } from '../components/TransportIcon';
import { formatClock } from '../models/config';
import { phaseLabel } from '../models/timeline';
import { onAccent, pausedColor, phaseColors, theme, tint } from '../theme';
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

  // A fresh array every tick would push a new gradient across to the native
  // view ten times a second for a wash that only changes when the phase does.
  const wash = useMemo(
    () => [tint(accent, 0.42), tint(accent, 0.12), theme.base] as const,
    [accent],
  );

  return (
    <LinearGradient
      colors={wash}
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
        <RoundButton icon="reset" label="Reset" onPress={app.reset} size={54} />
        <RoundButton
          icon={app.status === 'running' ? 'pause' : 'play'}
          label={app.status === 'running' ? 'Pause' : 'Resume'}
          onPress={app.toggle}
          size={78}
          fill={accent}
        />
        <RoundButton icon="skip" label="Skip phase" onPress={app.skip} size={54} />
      </View>
    </LinearGradient>
  );
}

const Chip = React.memo(function Chip({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipLabel}>{label.toUpperCase()}</Text>
      <Text style={styles.chipValue}>{value}</Text>
    </View>
  );
});

const RoundButton = React.memo(function RoundButton({
  icon,
  label,
  onPress,
  size,
  fill,
}: {
  icon: TransportIconName;
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
      <TransportIcon
        name={icon}
        size={Math.round(size * 0.42)}
        color={fill ? onAccent(fill) : theme.text}
      />
    </Pressable>
  );
});

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
