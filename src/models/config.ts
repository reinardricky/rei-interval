/** User-tunable parameters of a Tabata / HIIT session. All durations in seconds. */
export type IntervalConfig = {
  prepareSeconds: number;
  workSeconds: number;
  restSeconds: number;
  cycles: number;
  sets: number;
  setRestSeconds: number;
};

/** Starting point for a fresh install: classic Tabata, 20s on / 10s off. */
export const defaultConfig: IntervalConfig = {
  prepareSeconds: 10,
  workSeconds: 20,
  restSeconds: 10,
  cycles: 8,
  sets: 1,
  setRestSeconds: 60,
};

/** Total wall-clock length of the whole session, in seconds. */
export function totalSeconds(c: IntervalConfig): number {
  const work = c.workSeconds * c.cycles * c.sets;
  // Rest runs between cycles only — the last cycle of a set rolls straight into
  // the set rest, or ends the session.
  const rest = c.restSeconds * (c.cycles - 1) * c.sets;
  const setRest = c.setRestSeconds * (c.sets - 1);
  return c.prepareSeconds + work + rest + setRest;
}

export function configsEqual(a: IntervalConfig, b: IntervalConfig): boolean {
  return (
    a.prepareSeconds === b.prepareSeconds &&
    a.workSeconds === b.workSeconds &&
    a.restSeconds === b.restSeconds &&
    a.cycles === b.cycles &&
    a.sets === b.sets &&
    a.setRestSeconds === b.setRestSeconds
  );
}

/** Coerces anything parsed from storage into a valid config. */
export function sanitizeConfig(raw: unknown): IntervalConfig {
  const source = (raw ?? {}) as Partial<Record<keyof IntervalConfig, unknown>>;
  const read = (key: keyof IntervalConfig, min: number, max: number): number => {
    const value = source[key];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return defaultConfig[key];
    }
    return Math.min(max, Math.max(min, Math.round(value)));
  };
  return {
    prepareSeconds: read('prepareSeconds', 0, 300),
    workSeconds: read('workSeconds', 1, 900),
    restSeconds: read('restSeconds', 0, 900),
    cycles: read('cycles', 1, 99),
    sets: read('sets', 1, 20),
    setRestSeconds: read('setRestSeconds', 0, 1800),
  };
}

export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  if (minutes === 0) return `${rest}s`;
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
}

/** mm:ss, for the running clock. */
export function formatClock(seconds: number): string {
  const safe = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}
