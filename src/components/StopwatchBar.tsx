import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatElapsed } from '../models/config';
import { stopwatchElapsed } from '../models/stopwatch';
import { theme } from '../theme';
import type { Stopwatch } from '../useStopwatch';
import { TransportIcon, type TransportIconName } from './TransportIcon';

/** Height of the bar below the status bar. Screens pad their top by this. */
export const STOPWATCH_BAR_HEIGHT = 52;

/** The digits only change once a second; sampling faster just lands closer to the edge. */
const SAMPLE_MS = 250;

type Props = {
  stopwatch: Stopwatch;
  /**
   * Over a scrolling screen the bar needs a ground of its own, or content
   * slides underneath the digits. Over the workout screen it stays clear so
   * the phase wash runs to the top.
   */
  solid: boolean;
};

/**
 * The workout stopwatch, pinned above every screen. It keeps its own sampler
 * so ticking re-renders only this bar, never the screen beneath it.
 */
export function StopwatchBar({ stopwatch, solid }: Props) {
  const insets = useSafeAreaInsets();
  const { state } = stopwatch;
  const running = state.status === 'running';
  const now = useNow(running);
  const elapsed = stopwatchElapsed(state, now);

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.root,
        { paddingTop: insets.top, height: insets.top + STOPWATCH_BAR_HEIGHT },
        solid && styles.solid,
      ]}
    >
      {state.status === 'idle' ? (
        <Pressable
          onPress={stopwatch.start}
          accessibilityRole="button"
          accessibilityLabel="Start workout timer"
          style={styles.startPill}
        >
          <Text style={styles.glyph}>⏱</Text>
          <Text style={styles.startText}>Workout timer</Text>
        </Pressable>
      ) : (
        <View style={[styles.pill, state.status === 'stopped' && styles.pillDone]}>
          <Text style={styles.glyph}>{state.status === 'stopped' ? '✓' : '⏱'}</Text>
          <Text style={styles.label} numberOfLines={1}>
            {state.status === 'stopped'
              ? 'WORKOUT TOTAL'
              : state.status === 'paused'
                ? 'WORKOUT · PAUSED'
                : 'WORKOUT'}
          </Text>
          <Text
            style={[
              styles.time,
              state.status === 'paused' && styles.timePaused,
              state.status === 'stopped' && styles.timeDone,
            ]}
          >
            {formatElapsed(elapsed)}
          </Text>
          {state.status === 'stopped' ? (
            <IconButton icon="close" label="Clear workout timer" onPress={stopwatch.clear} />
          ) : (
            <>
              <IconButton
                icon={running ? 'pause' : 'play'}
                label={running ? 'Pause workout timer' : 'Resume workout timer'}
                onPress={stopwatch.toggle}
              />
              <IconButton icon="stop" label="Stop workout timer" onPress={stopwatch.stop} />
            </>
          )}
        </View>
      )}
    </View>
  );
}

/** Wall-clock time, re-sampled only while `active`. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    setNow(Date.now());
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), SAMPLE_MS);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

function IconButton({
  icon,
  label,
  onPress,
}: {
  icon: TransportIconName;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.iconButton}
    >
      <TransportIcon name={icon} size={16} color={theme.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  solid: { backgroundColor: 'rgba(14,14,16,0.94)' },
  startPill: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
  },
  startText: { color: theme.textDim, fontSize: 13, fontWeight: '700' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 40,
    paddingLeft: 14,
    paddingRight: 4,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: theme.border,
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
  pillDone: { borderColor: `${theme.success}66` },
  glyph: { fontSize: 14, color: theme.text },
  label: {
    flex: 1,
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  time: {
    color: theme.text,
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    marginRight: 2,
  },
  timePaused: { color: theme.textDim },
  timeDone: { color: theme.success },
  iconButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});
