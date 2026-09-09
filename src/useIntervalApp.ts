import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

import { initAudio, playCue, releaseAudio } from './audio';
import { IntervalConfig, defaultConfig, sanitizeConfig } from './models/config';
import {
  DEFAULT_PRESET_NAME,
  Preset,
  createPreset,
  uniqueName,
} from './models/preset';
import { CueEvent, Timeline, buildCueSchedule, buildTimeline, indexAt } from './models/timeline';
import * as storage from './storage';

export type Status = 'idle' | 'running' | 'paused' | 'completed';

const KEEP_AWAKE_TAG = 'reis-interval-workout';
/** Sample rate for the UI. Accuracy does not depend on it — see below. */
const TICK_MS = 100;

/**
 * How far ahead of its nominal instant each cue is fired.
 *
 * A cue is not instantaneous: the call crosses into the audio module, the
 * player is rewound, and Android's mixer adds output latency of its own before
 * anything reaches the speaker. Firing exactly on the second therefore *sounds*
 * late. This is the single number to tune if the beeps still sit behind the
 * clock — raise it to pull them earlier.
 */
const CUE_LEAD_MS = 120;

/**
 * A cue this far behind the clock is stale and is dropped rather than fired
 * against the wrong second. Skipping a phase walks the cursor past a run of
 * cues that no longer belong to the session.
 */
const CUE_STALE_S = 0.25;

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
  const soundRef = useRef(true);
  /** Cursor into `cueSchedule`: the next cue the session owes. */
  const cueIndexRef = useRef(0);
  const cueTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Indirection so the interval always calls the latest `tick`. */
  const tickRef = useRef<() => void>(() => {});
  /** Indirection so a fired cue can chain to the latest scheduler. */
  const scheduleCuesRef = useRef<() => void>(() => {});

  soundRef.current = soundEnabled;

  const timeline: Timeline = useMemo(() => buildTimeline(config), [config]);
  const cueSchedule: CueEvent[] = useMemo(() => buildCueSchedule(timeline), [timeline]);

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

  /**
   * Warm the audio pipeline as soon as the app settles, not on the start
   * button. Building the players costs enough that the opening cue would
   * otherwise be the one paying for it — and that cue marks second zero.
   */
  useEffect(() => {
    if (!hydrated || !soundEnabled) return;
    void initAudio();
  }, [hydrated, soundEnabled]);

  useEffect(() => () => releaseAudio(), []);

  // ── Cues ───────────────────────────────────────────────────────
  const clearCueTimer = useCallback(() => {
    if (cueTimerRef.current !== null) {
      clearTimeout(cueTimerRef.current);
      cueTimerRef.current = null;
    }
  }, []);

  /**
   * Arms a timer for the next cue the session owes, aimed `CUE_LEAD_MS` ahead
   * of its instant.
   *
   * Cues are scheduled rather than discovered by the sampling loop. Polling can
   * only notice a boundary on the following sample, which put every beep up to
   * a full tick late before the audio pipeline added anything; a timer aimed at
   * the instant itself has no such floor. Each fired cue arms the next, so the
   * chain re-derives its delay from the clock every time and cannot accumulate
   * drift.
   */
  const scheduleCues = useCallback(() => {
    clearCueTimer();
    // `startedAtRef` is the authority on "the clock is moving" — unlike
    // `status`, it is current the instant the transport changes.
    if (startedAtRef.current === null) return;

    const now = readElapsed();
    let index = cueIndexRef.current;
    while (index < cueSchedule.length && cueSchedule[index].at < now - CUE_STALE_S) {
      index++;
    }
    cueIndexRef.current = index;

    const event = cueSchedule[index];
    if (!event) return;

    cueTimerRef.current = setTimeout(
      () => {
        cueTimerRef.current = null;
        cueIndexRef.current = index + 1;
        if (soundRef.current) playCue(event.cue);
        scheduleCuesRef.current();
      },
      Math.max(0, (event.at - now) * 1000 - CUE_LEAD_MS),
    );
  }, [clearCueTimer, cueSchedule, readElapsed]);

  scheduleCuesRef.current = scheduleCues;

  // ── Transport ──────────────────────────────────────────────────
  const stopTicker = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const finish = useCallback(() => {
    stopTicker();
    clearCueTimer();
    startedAtRef.current = null;
    setElapsed(timeline.totalDuration);
    setStatus('completed');
    // The scheduler normally sounds this a beat before the clock runs out. Only
    // fire it here if the session ended some other way — a throttled timer, or
    // a skip through the final phase.
    if (cueIndexRef.current < cueSchedule.length && soundRef.current) playCue('complete');
    cueIndexRef.current = cueSchedule.length;
    void deactivateKeepAwake(KEEP_AWAKE_TAG);
  }, [clearCueTimer, cueSchedule.length, stopTicker, timeline.totalDuration]);

  /** Drives the display only. Cues run on their own schedule, so a late or
   *  coalesced tick costs animation smoothness and nothing audible. */
  const tick = useCallback(() => {
    const now = readElapsed();
    if (now >= timeline.totalDuration) {
      finish();
      return;
    }
    setElapsed(now);
  }, [finish, readElapsed, timeline.totalDuration]);

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
      scheduleCues();
      void activateKeepAwakeAsync(KEEP_AWAKE_TAG);
      return;
    }

    // Normally a no-op: the pipeline was warmed at mount. Kept as a fallback
    // for the case where sound was toggled on a moment ago.
    void initAudio();

    accumulatedRef.current = 0;
    skipRef.current = 0;
    cueIndexRef.current = 0;
    startedAtRef.current = Date.now();
    setElapsed(0);
    setStatus('running');
    startTicker();
    // The opening cue sits at offset 0, so this arms it for right now.
    scheduleCues();
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG);
  }, [scheduleCues, startTicker, status, timeline.segments.length]);

  const pause = useCallback(() => {
    if (status !== 'running') return;
    if (startedAtRef.current !== null) {
      accumulatedRef.current += Date.now() - startedAtRef.current;
      startedAtRef.current = null;
    }
    stopTicker();
    clearCueTimer();
    setElapsed(readElapsed());
    setStatus('paused');
    void deactivateKeepAwake(KEEP_AWAKE_TAG);
  }, [clearCueTimer, readElapsed, status, stopTicker]);

  const toggle = useCallback(() => {
    if (status === 'running') pause();
    else void start();
  }, [pause, start, status]);

  const reset = useCallback(() => {
    stopTicker();
    clearCueTimer();
    startedAtRef.current = null;
    accumulatedRef.current = 0;
    skipRef.current = 0;
    cueIndexRef.current = 0;
    setElapsed(0);
    setStatus('idle');
    void deactivateKeepAwake(KEEP_AWAKE_TAG);
  }, [clearCueTimer, stopTicker]);

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
    setElapsed(next);
    // Re-arming walks the cursor past every cue the jump swallowed and fires
    // the one opening the new phase, which is now due.
    scheduleCues();
  }, [finish, readElapsed, scheduleCues, status, timeline]);

  // Returning to the foreground resyncs immediately rather than waiting for the
  // next tick, so the clock is never visibly stale.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next !== 'active' || status !== 'running') return;
      tickRef.current();
      // Background throttling leaves the pending cue timer aimed at a stale
      // delay; re-derive it from the clock.
      scheduleCuesRef.current();
    });
    return () => sub.remove();
  }, [status]);

  useEffect(
    () => () => {
      stopTicker();
      clearCueTimer();
    },
    [clearCueTimer, stopTicker],
  );

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
