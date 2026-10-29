import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { StopwatchBar } from './src/components/StopwatchBar';
import { CompleteScreen } from './src/screens/CompleteScreen';
import { SetupScreen } from './src/screens/SetupScreen';
import { WorkoutScreen } from './src/screens/WorkoutScreen';
import { theme } from './src/theme';
import { useIntervalApp } from './src/useIntervalApp';
import { useStopwatch } from './src/useStopwatch';

export default function App() {
  const stopwatch = useStopwatch();
  // Starting intervals means the workout is on, so the stopwatch comes along —
  // but pausing them does not pause it: the breaks are part of the workout.
  const app = useIntervalApp({ onSessionStart: stopwatch.start });
  const ready = app.hydrated && stopwatch.hydrated;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <View style={styles.root}>
        {!ready ? (
          // Presets come from storage; rendering setup first would flash the
          // stock intervals before the athlete's own tab loads.
          <View style={styles.splash}>
            <Text style={styles.splashText}>Rei&apos;s Interval</Text>
          </View>
        ) : app.isActive ? (
          <WorkoutScreen app={app} />
        ) : app.status === 'completed' ? (
          <CompleteScreen app={app} />
        ) : (
          <SetupScreen app={app} />
        )}
        {/* Rendered after the screen so it stacks on top of it. */}
        {ready ? (
          <StopwatchBar stopwatch={stopwatch} solid={!app.isActive && app.status !== 'completed'} />
        ) : null}
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: theme.base },
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  splashText: {
    color: theme.brand,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
});
