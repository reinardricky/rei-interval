import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { theme } from '../theme';

/**
 * The arc is animated rather than re-rendered.
 *
 * Driving `strokeDashoffset` from React state meant the ring could only move
 * as often as the engine sampled — ten steps a second — which reads as lag no
 * matter how cheap the render is. An `Animated.Value` drains continuously at
 * the display's own rate and never touches the render path.
 */
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Breathing room between the ring and the edge of the SVG viewport. Without it
 * the stroke's outer edge lands exactly on the viewport bounds and Android
 * shaves the antialiased pixels off the bottom and right.
 */
const RING_INSET = 2;

type Props = {
  secondsRemaining: number;
  /** Authoritative phase progress, used to re-sync the drain when it restarts. */
  progress: number;
  /** Milliseconds left in this phase, read when the drain restarts. */
  remainingMs: number;
  /** The drain runs only while the clock does. */
  running: boolean;
  /** Changes when the phase does, restarting the drain against the new one. */
  segmentIndex: number;
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
function PhaseClockInner({
  secondsRemaining,
  progress,
  remainingMs,
  running,
  segmentIndex,
  label,
  accent,
  diameter,
}: Props) {
  const text = format(secondsRemaining);
  // Geometry depends only on the size, which changes on rotation and never
  // during a phase.
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

  const drain = useRef(new Animated.Value(0)).current;
  // Read only when the drain restarts, so they do not need to be re-rendered
  // for. See the comparator below.
  const progressRef = useRef(progress);
  const remainingRef = useRef(remainingMs);
  progressRef.current = progress;
  remainingRef.current = remainingMs;

  useEffect(() => {
    drain.stopAnimation();
    // Re-sync to the real clock on every restart, so a drain that drifted over
    // a long phase cannot accumulate error across the session.
    drain.setValue(progressRef.current);
    if (!running) return;

    const animation = Animated.timing(drain, {
      toValue: 1,
      duration: Math.max(0, remainingRef.current),
      easing: Easing.linear,
      // `strokeDashoffset` is not a transform or opacity, so the native driver
      // cannot carry it. Animated still keeps this off the React render path.
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [drain, running, segmentIndex]);

  const dashOffset = useMemo(
    () =>
      drain.interpolate({
        inputRange: [0, 1],
        outputRange: [0, circumference],
        extrapolate: 'clamp',
      }),
    [circumference, drain],
  );

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
        <AnimatedCircle
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

/**
 * `progress` and `remainingMs` are deliberately excluded: they change ten times
 * a second but are only ever read through refs when the drain restarts, and
 * every prop that *does* trigger a restart is compared here — so the refs are
 * always fresh by the time the effect reads them. That drops this component
 * from ten renders a second to roughly one, leaving the JS thread free for the
 * animation itself.
 */
export const PhaseClock = React.memo(
  PhaseClockInner,
  (prev, next) =>
    prev.secondsRemaining === next.secondsRemaining &&
    prev.running === next.running &&
    prev.segmentIndex === next.segmentIndex &&
    prev.label === next.label &&
    prev.accent === next.accent &&
    prev.diameter === next.diameter,
);

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
