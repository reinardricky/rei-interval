import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

import { initAudio, playCue } from './audio';
import { IntervalConfig, defaultConfig, sanitizeConfig } from './models/config';
import {
  DEFAULT_PRESET_NAME,
  Preset,
  createPreset,
  uniqueName,
} from './models/preset';
import { Timeline, buildTimeline, indexAt } from './models/timeline';
import * as storage from './storage';

export type Status = 'idle' | 'running' | 'paused' | 'completed';

const KEEP_AWAKE_TAG = 'reis-interval-workout';
/** Sample rate for the UI. Accuracy does not depend on it — see below. */
const TICK_MS = 100;

export function useIntervalApp() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [activeId, setActiveId] = useState<string>('');
  const [config, setConfig] = useState<IntervalConfig>(defaultConfig);
  const [status, setStatus] = useState<Status>('idle');
  const [elapsed, setElapsed] = useState(0); // seconds
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  /**
   * The timer is a *sampler*, not an accumulator. Elapsed time is always
   * recomputed from `Date.now()`, so a throttled or suspended JS timer (Android
   * pauses timers for backgrounded apps) costs animation smoothness and nothing
   * else: the next tick that fires is correct. Subtracting 1 per tick instead
   * would compound every missed tick into permanent drift.
   */
  const startedAtRef = useRef<number | null>(null);
  const accumulatedRef = useRef(0);
  const skipRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cuedSegmentRef = useRef(-1);
  const cuedSecondRef = useRef(-1);
  const soundRef = useRef(true);
  /** Mirrors `elapsed` so the tick loop need not depend on render state. */
  const elapsedRef = useRef(0);
  /** Indirection so the interval always calls the latest `tick`. */
  const tickRef = useRef<() => void>(() => {});

  soundRef.current = soundEnabled;

  const timeline: Timeline = useMemo(() => buildTimeline(config), [config]);

  const readElapsed = useCallback(() => {
    const live = startedAtRef.current === null ? 0 : Date.now() - startedAtRef.current;
    return (accumulatedRef.current + live) / 1000 + skipRef.current;
  }, []);

  // ── Hydrate ────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [stored, storedId, sound] = await Promise.all([
        storage.loadPresets(),
        storage.loadActivePresetId(),
        storage.loadSoundEnabled(),
      ]);
      if (cancelled) return;

      let list = stored;
      if (list.length === 0) {
        list = [createPreset(DEFAULT_PRESET_NAME, defaultConfig)];
        void storage.savePresets(list);
      }
      const active = list.find((p) => p.id === storedId) ?? list[0];

      setPresets(list);
      setActiveId(active.id);
      setConfig(sanitizeConfig(active.config));
      setSoundEnabled(sound);
      setHydrated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Cues ───────────────────────────────────────────────────────
  const cueSegmentStart = useCallback(
    (index: number) => {
      cuedSegmentRef.current = index;
      cuedSecondRef.current = -1;
      if (!soundRef.current) return;
      const segment = timeline.segments[index];
      if (!segment) return;
      playCue(segment.phase === 'work' ? 'work' : 'rest');
    },
    [timeline],
  );

  /**
   * Counts down the last three seconds of a phase. Guarded on
   * (segment, second) so a sampled loop cannot fire the same cue twice.
   */
  const cueCountdown = useCallback((index: number, secondsLeft: number) => {
    if (secondsLeft > 3 || secondsLeft < 1) return;
    if (index === cuedSegmentRef.current && secondsLeft === cuedSecondRef.current) {
      return;
    }
    cuedSegmentRef.current = index;
    cuedSecondRef.current = secondsLeft;
    if (soundRef.current) playCue('tick');
  }, []);

  // ── Transport ──────────────────────────────────────────────────
  const stopTicker = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const finish = useCallback(() => {
    stopTicker();
    startedAtRef.current = null;
    setElapsed(timeline.totalDuration);
    setStatus('completed');
    if (soundRef.current) playCue('complete');
    void deactivateKeepAwake(KEEP_AWAKE_TAG);
  }, [stopTicker, timeline.totalDuration]);

  const tick = useCallback(() => {
    const now = readElapsed();
    if (now >= timeline.totalDuration) {
      finish();
      return;
    }
    const previous = indexAt(timeline, elapsedRef.current);
    const current = indexAt(timeline, now);
    elapsedRef.current = now;
    setElapsed(now);

    if (current !== previous) {
      cueSegmentStart(current);
    } else {
      const segment = timeline.segments[current];
      if (segment) {
        cueCountdown(current, Math.ceil(segment.start + segment.duration - now));
      }
    }
  }, [cueCountdown, cueSegmentStart, finish, readElapsed, timeline]);

  elapsedRef.current = elapsed;
  tickRef.current = tick;

  const startTicker = useCallback(() => {
    stopTicker();
    intervalRef.current = setInterval(() => tickRef.current(), TICK_MS);
  }, [stopTicker]);

  const start = useCallback(async () => {
    if (timeline.segments.length === 0 || status === 'running') return;

    if (status === 'paused') {
      startedAtRef.current = Date.now();
      setStatus('running');
      startTicker();
      void activateKeepAwakeAsync(KEEP_AWAKE_TAG);
      return;
    }

    // Init on a user gesture so the first cue is not the one that warms up the
    // audio pipeline.
    void initAudio();

    accumulatedRef.current = 0;
    skipRef.current = 0;
    cuedSegmentRef.current = -1;
    cuedSecondRef.current = -1;
    elapsedRef.current = 0;
    startedAtRef.current = Date.now();
    setElapsed(0);
    setStatus('running');
    startTicker();
    cueSegmentStart(0);
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG);
  }, [cueSegmentStart, startTicker, status, timeline.segments.length]);

  const pause = useCallback(() => {
    if (status !== 'running') return;
    if (startedAtRef.current !== null) {
      accumulatedRef.current += Date.now() - startedAtRef.current;
      startedAtRef.current = null;
    }
    stopTicker();
    setElapsed(readElapsed());
    setStatus('paused');
    void deactivateKeepAwake(KEEP_AWAKE_TAG);
  }, [readElapsed, status, stopTicker]);

  const toggle = useCallback(() => {
    if (status === 'running') pause();
    else void start();
  }, [pause, start, status]);

  const reset = useCallback(() => {
    stopTicker();
    startedAtRef.current = null;
    accumulatedRef.current = 0;
    skipRef.current = 0;
    cuedSegmentRef.current = -1;
    cuedSecondRef.current = -1;
    elapsedRef.current = 0;
    setElapsed(0);
    setStatus('idle');
    void deactivateKeepAwake(KEEP_AWAKE_TAG);
  }, [stopTicker]);

  /** Credits the remainder of the current phase to the skip offset. */
  const skip = useCallback(() => {
    if (status !== 'running' && status !== 'paused') return;
    const now = readElapsed();
    const index = indexAt(timeline, now);
    const segment = timeline.segments[index];
    if (!segment) return;

    skipRef.current += Math.max(0, segment.start + segment.duration - now);
    const next = readElapsed();
    if (next >= timeline.totalDuration) {
      finish();
      return;
    }
    elapsedRef.current = next;
    setElapsed(next);
    cueSegmentStart(indexAt(timeline, next));
  }, [cueSegmentStart, finish, readElapsed, status, timeline]);

  // Returning to the foreground resyncs immediately rather than waiting for the
  // next tick, so the clock is never visibly stale.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active' && status === 'running') tickRef.current();
    });
    return () => sub.remove();
  }, [status]);

  useEffect(() => () => stopTicker(), [stopTicker]);

  // ── Config & presets ───────────────────────────────────────────
  const isActive = status === 'running' || status === 'paused';

  const persistPresets = useCallback((next: Preset[]) => {
    setPresets(next);
    void storage.savePresets(next);
  }, []);

  /**
   * Every edit writes straight through to the open tab — there is no separate
   * save step, so the tab always holds what is on screen.
   */
  const updateConfig = useCallback(
    (next: IntervalConfig) => {
      if (isActive) return;
      setConfig(next);
      setStatus('idle');
      setElapsed(0);
      persistPresets(
        presets.map((p) => (p.id === activeId ? { ...p, config: next } : p)),
      );
    },
    [activeId, isActive, persistPresets, presets],
  );

  const selectPreset = useCallback(
    (id: string) => {
      if (isActive || id === activeId) return;
      const target = presets.find((p) => p.id === id);
      if (!target) return;
      setActiveId(target.id);
      setConfig(target.config);
      setStatus('idle');
      setElapsed(0);
      void storage.saveActivePresetId(target.id);
    },
    [activeId, isActive, presets],
  );

  /** A new tab starts from the stock intervals; `copyFrom` seeds a duplicate. */
  const createTab = useCallback(
    (name: string, copyFrom?: IntervalConfig) => {
      if (isActive) return;
      const trimmed = name.trim();
      if (!trimmed) return;
      const preset = createPreset(
        uniqueName(presets, trimmed),
        copyFrom ?? defaultConfig,
      );
      persistPresets([...presets, preset]);
      setActiveId(preset.id);
      setConfig(preset.config);
      setStatus('idle');
      setElapsed(0);
      void storage.saveActivePresetId(preset.id);
    },
    [isActive, persistPresets, presets],
  );

  const duplicateTab = useCallback(
    (id: string) => {
      const source = presets.find((p) => p.id === id);
      if (source) createTab(`${source.name} copy`, source.config);
    },
    [createTab, presets],
  );

  const renameTab = useCallback(
    (id: string, name: string) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      const unique = uniqueName(presets, trimmed, id);
      persistPresets(presets.map((p) => (p.id === id ? { ...p, name: unique } : p)));
    },
    [persistPresets, presets],
  );

  /**
   * The last tab is kept — the intervals need somewhere to live, and an empty
   * strip would leave no way back.
   */
  const deleteTab = useCallback(
    (id: string) => {
      if (isActive || presets.length <= 1) return;
      const index = presets.findIndex((p) => p.id === id);
      if (index < 0) return;
      const next = presets.filter((p) => p.id !== id);
      persistPresets(next);
      if (id !== activeId) return;

      // Deleting the open tab falls back to its neighbour rather than jumping
      // to the start of the strip.
      const fallback = next[Math.min(index, next.length - 1)];
      setActiveId(fallback.id);
      setConfig(fallback.config);
      setStatus('idle');
      setElapsed(0);
      void storage.saveActivePresetId(fallback.id);
    },
    [activeId, isActive, persistPresets, presets],
  );

  const toggleSound = useCallback(() => {
    setSoundEnabled((previous) => {
      const next = !previous;
      void storage.saveSoundEnabled(next);
      if (next) void initAudio();
      return next;
    });
  }, []);

  // ── Derived read-outs ──────────────────────────────────────────
  const segmentIndex = indexAt(timeline, elapsed);
  const segment = timeline.segments[segmentIndex];
  const phase = segment?.phase ?? timeline.segments[timeline.segments.length - 1]?.phase ?? 'work';
  const remainingInPhase = segment
    ? Math.max(0, segment.start + segment.duration - elapsed)
    : 0;
  const phaseProgress = segment
    ? Math.min(1, Math.max(0, (elapsed - segment.start) / segment.duration))
    : 1;

  return {
    hydrated,
    presets,
    activeId,
    config,
    timeline,
    status,
    isActive,
    soundEnabled,
    // read-outs
    segmentIndex,
    phase,
    secondsRemaining: Math.ceil(remainingInPhase),
    phaseProgress,
    totalRemaining: Math.max(0, timeline.totalDuration - elapsed),
    overallProgress:
      timeline.totalDuration === 0 ? 0 : Math.min(1, elapsed / timeline.totalDuration),
    currentCycle: segment?.cycle ?? config.cycles,
    currentSet: segment?.set ?? config.sets,
    canDelete: presets.length > 1,
    // actions
    start,
    pause,
    toggle,
    reset,
    skip,
    updateConfig,
    selectPreset,
    createTab,
    duplicateTab,
    renameTab,
    deleteTab,
    toggleSound,
  };
}

export type IntervalApp = ReturnType<typeof useIntervalApp>;
