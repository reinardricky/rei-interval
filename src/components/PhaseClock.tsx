import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { theme } from '../theme';

/**
 * Breathing room between the ring and the edge of the SVG viewport. Without it
 * the stroke's outer edge lands exactly on the viewport bounds and Android
 * shaves the antialiased pixels off the bottom and right.
 */
const RING_INSET = 2;

type Props = {
  secondsRemaining: number;
  progress: number;
  label: string;
  accent: string;
  diameter: number;
};

function format(seconds: number): string {
  const safe = Math.max(0, seconds);
  if (safe < 60) return String(safe);
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

/**
 * Big countdown wrapped in a phase-progress ring. Deliberately plain and
 * enormous: it has to be legible from the floor, at arm's length, mid-effort.
 *
 * Memoised because the workout screen re-renders ~10x a second: this should
 * repaint when the ring actually moves, not whenever the parent does.
 */
function PhaseClockInner({ secondsRemaining, progress, label, accent, diameter }: Props) {
  const text = format(secondsRemaining);
  // Geometry depends only on the size, which changes on rotation and never
  // during a phase — so it is not worth recomputing ten times a second.
  const { stroke, radius, circumference, centre, rotation } = useMemo(() => {
    const width = Math.max(8, diameter * 0.055);
    const r = (diameter - width) / 2 - RING_INSET;
    const mid = diameter / 2;
    return {
      stroke: width,
      radius: r,
      circumference: 2 * Math.PI * r,
      centre: mid,
      rotation: `rotate(-90 ${mid} ${mid})`,
    };
  }, [diameter]);
  // Drains clockwise from 12 o'clock as the phase elapses.
  const dashOffset = circumference * Math.min(1, Math.max(0, progress));
  const digitSize = text.length > 2 ? diameter * 0.3 : diameter * 0.4;

  return (
    <View style={{ width: diameter, height: diameter }}>
      <Svg width={diameter} height={diameter}>
        <Circle
          cx={centre}
          cy={centre}
          r={radius}
          stroke="rgba(255,255,255,0.10)"
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={centre}
          cy={centre}
          r={radius}
          stroke={accent}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={rotation}
        />
      </Svg>
      <View style={styles.center} pointerEvents="none">
        <Text
          style={[
            styles.label,
            { color: accent, fontSize: Math.max(12, diameter * 0.072) },
          ]}
        >
          {label.toUpperCase()}
        </Text>
        <Text style={[styles.digits, { fontSize: digitSize }]}>{text}</Text>
      </View>
    </View>
  );
}

export const PhaseClock = React.memo(PhaseClockInner);

const styles = StyleSheet.create({
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontWeight: '800',
    letterSpacing: 3,
    marginBottom: 4,
  },
  digits: {
    color: theme.text,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    includeFontPadding: false,
  },
});
