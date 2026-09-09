import { IntervalConfig } from './config';

export type Phase = 'prepare' | 'work' | 'rest' | 'setRest';

export const phaseLabel: Record<Phase, string> = {
  prepare: 'Prepare',
  work: 'WORK!',
  rest: 'Rest',
  setRest: 'Set Rest',
};

/** One contiguous stretch of the session at a fixed phase. */
export type Segment = {
  phase: Phase;
  /** Seconds. */
  duration: number;
  /** 1-based position within the session. */
  cycle: number;
  set: number;
  /** Offset from session start, in seconds. */
  start: number;
};

export type Timeline = {
  segments: Segment[];
  totalDuration: number;
  workCount: number;
  totalCycles: number;
};

/**
 * Flattens a config into an ordered list of segments with absolute offsets.
 *
 * Precomputing the timeline is what keeps the engine trivial: "where am I?"
 * becomes a lookup against elapsed time rather than a pile of mutable counters,
 * so skip, progress and the up-next list all fall out of the same structure.
 */
export function buildTimeline(config: IntervalConfig): Timeline {
  const segments: Segment[] = [];
  let cursor = 0;

  const add = (phase: Phase, duration: number, cycle: number, set: number) => {
    if (duration <= 0) return;
    segments.push({ phase, duration, cycle, set, start: cursor });
    cursor += duration;
  };

  const cycles = Math.max(1, config.cycles);
  const sets = Math.max(1, config.sets);

  add('prepare', config.prepareSeconds, 1, 1);

  for (let set = 1; set <= sets; set++) {
    for (let cycle = 1; cycle <= cycles; cycle++) {
      add('work', config.workSeconds, cycle, set);
      // No plain rest after the final cycle — the set rest (or the end of the
      // session) covers that recovery instead.
      if (cycle < cycles) add('rest', config.restSeconds, cycle, set);
    }
    if (set < sets) add('setRest', config.setRestSeconds, cycles, set);
  }

  return {
    segments,
    totalDuration: cursor,
    workCount: segments.filter((s) => s.phase === 'work').length,
    totalCycles: cycles,
  };
}

/**
 * Index of the segment containing `elapsed` seconds; `segments.length` once the
 * session is over. Linear scan is right here — sessions are tens of segments.
 */
export function indexAt(timeline: Timeline, elapsed: number): number {
  if (elapsed < 0) return 0;
  for (let i = 0; i < timeline.segments.length; i++) {
    if (elapsed < timeline.segments[i].start + timeline.segments[i].duration) {
      return i;
    }
  }
  return timeline.segments.length;
}

/** A sound the session makes, and the exact offset it belongs on. */
export type CueName = 'tick' | 'work' | 'rest' | 'complete';

export type CueEvent = {
  /** Offset from session start, in seconds. */
  at: number;
  cue: CueName;
};

/** How many seconds of countdown ticks close out a phase. */
const COUNTDOWN_FROM = 3;

/**
 * Every cue the session will make, in order.
 *
 * Precomputing these is what lets a cue be *scheduled* for its instant instead
 * of noticed after the fact by the sampling loop. Polling can only discover a
 * boundary on the next sample, so a 100ms loop puts every beep an average of
 * 50ms — and at worst a full tick — behind the second it belongs to, before
 * the audio pipeline has added any latency of its own.
 */
export function buildCueSchedule(timeline: Timeline): CueEvent[] {
  const events: CueEvent[] = [];

  timeline.segments.forEach((segment) => {
    events.push({ at: segment.start, cue: segment.phase === 'work' ? 'work' : 'rest' });

    const end = segment.start + segment.duration;
    for (let left = COUNTDOWN_FROM; left >= 1; left--) {
      const at = end - left;
      // A short phase has no room for the full countdown: never tick before the
      // phase has begun, and never double up on the cue that opens it.
      if (at > segment.start) events.push({ at, cue: 'tick' });
    }
  });

  if (timeline.totalDuration > 0) {
    events.push({ at: timeline.totalDuration, cue: 'complete' });
  }

  return events.sort((a, b) => a.at - b.at);
}
