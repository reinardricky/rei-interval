import AsyncStorage from '@react-native-async-storage/async-storage';

import { Circuit, Mode, parseCircuits } from './models/circuit';
import { Preset, parsePresets } from './models/preset';
import { StopwatchState, idleStopwatch, parseStopwatch } from './models/stopwatch';

const PRESETS_KEY = 'reis.presets';
const ACTIVE_KEY = 'reis.activePreset';
const SOUND_KEY = 'reis.sound';
const CIRCUITS_KEY = 'reis.circuits';
const ACTIVE_CIRCUIT_KEY = 'reis.activeCircuit';
const MODE_KEY = 'reis.mode';
const STOPWATCH_KEY = 'reis.stopwatch';

/**
 * Storage is best-effort: a read failure falls back to defaults and a write
 * failure is swallowed. Losing a preference must never break the timer.
 */
export async function loadPresets(): Promise<Preset[]> {
  try {
    const raw = await AsyncStorage.getItem(PRESETS_KEY);
    return raw ? parsePresets(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export async function savePresets(presets: Preset[]): Promise<void> {
  try {
    await AsyncStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
  } catch {
    // ignored
  }
}

export async function loadActivePresetId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(ACTIVE_KEY);
  } catch {
    return null;
  }
}

export async function saveActivePresetId(id: string): Promise<void> {
  try {
    await AsyncStorage.setItem(ACTIVE_KEY, id);
  } catch {
    // ignored
  }
}

export async function loadSoundEnabled(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(SOUND_KEY);
    return raw === null ? true : raw === 'true';
  } catch {
    return true;
  }
}

export async function saveSoundEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(SOUND_KEY, String(enabled));
  } catch {
    // ignored
  }
}

export async function loadCircuits(): Promise<Circuit[]> {
  try {
    const raw = await AsyncStorage.getItem(CIRCUITS_KEY);
    return raw ? parseCircuits(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export async function saveCircuits(circuits: Circuit[]): Promise<void> {
  try {
    await AsyncStorage.setItem(CIRCUITS_KEY, JSON.stringify(circuits));
  } catch {
    // ignored
  }
}

export async function loadActiveCircuitId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(ACTIVE_CIRCUIT_KEY);
  } catch {
    return null;
  }
}

export async function saveActiveCircuitId(id: string): Promise<void> {
  try {
    await AsyncStorage.setItem(ACTIVE_CIRCUIT_KEY, id);
  } catch {
    // ignored
  }
}

export async function loadMode(): Promise<Mode> {
  try {
    return (await AsyncStorage.getItem(MODE_KEY)) === 'circuits' ? 'circuits' : 'presets';
  } catch {
    return 'presets';
  }
}

export async function saveMode(mode: Mode): Promise<void> {
  try {
    await AsyncStorage.setItem(MODE_KEY, mode);
  } catch {
    // ignored
  }
}

export async function loadStopwatch(): Promise<StopwatchState> {
  try {
    const raw = await AsyncStorage.getItem(STOPWATCH_KEY);
    return raw ? parseStopwatch(JSON.parse(raw)) : idleStopwatch;
  } catch {
    return idleStopwatch;
  }
}

export async function saveStopwatch(state: StopwatchState): Promise<void> {
  try {
    await AsyncStorage.setItem(STOPWATCH_KEY, JSON.stringify(state));
  } catch {
    // ignored
  }
}
