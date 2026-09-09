import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CompleteScreen } from './src/screens/CompleteScreen';
import { SetupScreen } from './src/screens/SetupScreen';
import { WorkoutScreen } from './src/screens/WorkoutScreen';
import { theme } from './src/theme';
import { useIntervalApp } from './src/useIntervalApp';

export default function App() {
  const app = useIntervalApp();

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <View style={styles.root}>
        {!app.hydrated ? (
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
