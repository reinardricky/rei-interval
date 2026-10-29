/**
 * The workout stopwatch: one clock for the whole training session, across
 * presets, circuits and the breaks in between. It runs independently of the
 * interval engine.
 *
 * Like the engine it stores *when* it started rather than counting ticks, so
 * the reading survives a throttled timer, a backgrounded app and — because the
 * state is persisted — the app being killed mid-workout.
 */
export type StopwatchStatus = 'idle' | 'running' | 'paused' | 'stopped';

export type StopwatchState = {
  status: StopwatchStatus;
  /** Epoch ms of the current run; set only while running. */
  startedAt: number | null;
  /** Time banked by earlier runs, in ms. */
  accumulatedMs: number;
};

export const idleStopwatch: StopwatchState = {
  status: 'idle',
  startedAt: null,
  accumulatedMs: 0,
};

/**
 * Clamped at zero: a wall clock set backwards mid-run would otherwise read
 * negative.
 */
export function stopwatchElapsed(state: StopwatchState, now: number): number {
  const live =
    state.status === 'running' && state.startedAt !== null ? now - state.startedAt : 0;
  return Math.max(0, state.accumulatedMs + live);
}

/** Resumes from a pause; from anything else, starts a fresh workout at zero. */
export function startStopwatch(state: StopwatchState, now: number): StopwatchState {
  if (state.status === 'running') return state;
  if (state.status === 'paused') {
    return { status: 'running', startedAt: now, accumulatedMs: state.accumulatedMs };
  }
  return { status: 'running', startedAt: now, accumulatedMs: 0 };
}

export function pauseStopwatch(state: StopwatchState, now: number): StopwatchState {
  if (state.status !== 'running') return state;
  return { status: 'paused', startedAt: null, accumulatedMs: stopwatchElapsed(state, now) };
}

/** Freezes the reading as the workout total, until it is cleared. */
export function stopStopwatch(state: StopwatchState, now: number): StopwatchState {
  if (state.status !== 'running' && state.status !== 'paused') return state;
  return { status: 'stopped', startedAt: null, accumulatedMs: stopwatchElapsed(state, now) };
}

export function parseStopwatch(raw: unknown): StopwatchState {
  const source = (raw ?? {}) as Record<string, unknown>;
  const status = source.status;
  const accumulatedMs =
    typeof source.accumulatedMs === 'number' && Number.isFinite(source.accumulatedMs)
      ? Math.max(0, source.accumulatedMs)
      : 0;
  const startedAt =
    typeof source.startedAt === 'number' && Number.isFinite(source.startedAt)
      ? source.startedAt
      : null;

  if (status === 'running' && startedAt !== null) {
    return { status, startedAt, accumulatedMs };
  }
  if (status === 'paused' || status === 'stopped') {
    return { status, startedAt: null, accumulatedMs };
  }
  return idleStopwatch;
}
