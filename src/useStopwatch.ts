import { useCallback, useEffect, useState } from 'react';

import {
  StopwatchState,
  idleStopwatch,
  pauseStopwatch,
  startStopwatch,
  stopStopwatch,
} from './models/stopwatch';
import * as storage from './storage';

/**
 * State and transport for the workout stopwatch. Holds no ticker of its own:
 * the reading is derived from timestamps, so only the bar that displays it
 * needs to re-render while it runs.
 */
export function useStopwatch() {
  const [state, setState] = useState<StopwatchState>(idleStopwatch);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void storage.loadStopwatch().then((stored) => {
      if (cancelled) return;
      setState(stored);
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const apply = useCallback(
    (transition: (state: StopwatchState, now: number) => StopwatchState) => {
      setState((previous) => {
        const next = transition(previous, Date.now());
        if (next !== previous) void storage.saveStopwatch(next);
        return next;
      });
    },
    [],
  );

  const start = useCallback(() => apply(startStopwatch), [apply]);
  const pause = useCallback(() => apply(pauseStopwatch), [apply]);
  const stop = useCallback(() => apply(stopStopwatch), [apply]);
  const clear = useCallback(() => apply(() => idleStopwatch), [apply]);
  const toggle = useCallback(
    () => apply((s, now) => (s.status === 'running' ? pauseStopwatch(s, now) : startStopwatch(s, now))),
    [apply],
  );

  return { hydrated, state, start, pause, stop, clear, toggle };
}

export type Stopwatch = ReturnType<typeof useStopwatch>;
