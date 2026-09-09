import { IntervalConfig, defaultConfig, sanitizeConfig } from './config';

/** A named interval setup. In this app a preset *is* a tab. */
export type Preset = {
  id: string;
  name: string;
  config: IntervalConfig;
};

let seq = 0;

/**
 * Ids only need to be unique within one device's list, so the clock plus a
 * counter is enough — the counter matters because duplicating a tab can mint
 * two ids inside the same millisecond.
 */
export function createPreset(name: string, config: IntervalConfig = defaultConfig): Preset {
  seq += 1;
  return { id: `${Date.now()}-${seq}`, name, config };
}

export const DEFAULT_PRESET_NAME = 'Default';

/** One-line description of the intervals, for the tab options sheet. */
export function presetSummary(preset: Preset): string {
  const c = preset.config;
  const parts = [
    `${c.workSeconds}s work`,
    ...(c.restSeconds > 0 ? [`${c.restSeconds}s rest`] : []),
    `${c.cycles} ${c.cycles === 1 ? 'cycle' : 'cycles'}`,
    ...(c.sets > 1 ? [`${c.sets} sets`] : []),
  ];
  return parts.join('  ·  ');
}

/**
 * Tab names are how the athlete tells tabs apart, so a collision gets a numeric
 * suffix rather than silently producing two identical labels. Matching is
 * case-insensitive but the suffixed name keeps the casing they typed.
 */
export function uniqueName(presets: Preset[], name: string, ignoreId?: string): string {
  const taken = (candidate: string) =>
    presets.some(
      (p) => p.id !== ignoreId && p.name.toLowerCase() === candidate.toLowerCase(),
    );
  if (!taken(name)) return name;
  for (let i = 2; i < 100; i++) {
    const candidate = `${name} ${i}`;
    if (!taken(candidate)) return candidate;
  }
  return name;
}

/** Skips malformed records rather than dropping the whole list. */
export function parsePresets(raw: unknown): Preset[] {
  if (!Array.isArray(raw)) return [];
  const out: Preset[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const { id, name, config } = item as Record<string, unknown>;
    if (typeof id !== 'string' || typeof name !== 'string') continue;
    out.push({ id, name, config: sanitizeConfig(config) });
  }
  return out;
}
