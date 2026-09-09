import { requireOptionalNativeModule } from 'expo-modules-core';

/**
 * SoundPool-backed cue playback. See the Kotlin module for why this exists
 * rather than driving the cues through `expo-audio`.
 *
 * Optional on purpose: if the native module is missing — an iOS build, or a
 * native project that has not been rebuilt since this module was added — this
 * resolves to `null` and the caller falls back to `expo-audio` rather than the
 * app going silent.
 */
export type CuePlayer = {
  /** Decodes `res/raw/<name>.wav` into the pool. Returns false if absent. */
  load(name: string): boolean;
  /** Fires a cue. Returns false if the sample was not ready. */
  play(name: string): boolean;
};

export const CuePlayer = requireOptionalNativeModule<CuePlayer>('CuePlayer');
