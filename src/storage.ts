import AsyncStorage from '@react-native-async-storage/async-storage';

import { Preset, parsePresets } from './models/preset';

const PRESETS_KEY = 'reis.presets';
const ACTIVE_KEY = 'reis.activePreset';
const SOUND_KEY = 'reis.sound';

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
