import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { theme } from '../theme';

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
 */
export function PhaseClock({ secondsRemaining, progress, label, accent, diameter }: Props) {
  const text = format(secondsRemaining);
  const stroke = Math.max(8, diameter * 0.055);
  const radius = (diameter - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  // Drains clockwise from 12 o'clock as the phase elapses.
  const dashOffset = circumference * Math.min(1, Math.max(0, progress));
  const digitSize = text.length > 2 ? diameter * 0.3 : diameter * 0.4;

  return (
    <View style={{ width: diameter, height: diameter }}>
      <Svg width={diameter} height={diameter}>
        <Circle
          cx={diameter / 2}
          cy={diameter / 2}
          r={radius}
          stroke="rgba(255,255,255,0.10)"
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={diameter / 2}
          cy={diameter / 2}
          r={radius}
          stroke={accent}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${diameter / 2} ${diameter / 2})`}
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
