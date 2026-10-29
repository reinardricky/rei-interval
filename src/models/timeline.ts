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
  /** 1-based position within the exercise. */
  cycle: number;
  set: number;
  /** Offset from session start, in seconds. */
  start: number;
  /** Index into `Timeline.blocks`: the exercise this segment belongs to. */
  block: number;
  /**
   * The break between two exercises of a circuit. It belongs to the exercise
   * coming up, so during it the screen already shows what is next.
   */
  between: boolean;
};

/** One exercise of the session: a single preset, or one step of a circuit. */
export type Block = {
  name: string;
  cycles: number;
  sets: number;
};

export type Timeline = {
  segments: Segment[];
  totalDuration: number;
  workCount: number;
  blocks: Block[];
  /**
   * Offsets at which the session stops and waits for a tap before carrying on,
   * ascending. Each sits on the opening of an exercise.
   */
  holds: number[];
};

/** One exercise of a circuit, resolved to the intervals it runs. */
export type CircuitStep = {
  name: string;
  config: IntervalConfig;
};

/**
 * Flattens a config into an ordered list of segments with absolute offsets.
 *
 * Precomputing the timeline is what keeps the engine trivial: "where am I?"
 * becomes a lookup against elapsed time rather than a pile of mutable counters,
 * so skip, progress and the up-next list all fall out of the same structure.
 */
export function buildTimeline(config: IntervalConfig, name = ''): Timeline {
  return buildCircuitTimeline([{ name, config }]);
}

/**
 * Chains several setups into one continuous session.
 *
 * Only the opening exercise gets its prepare countdown: after that the athlete
 * is already warm and moving. The break between two exercises is the earlier
 * one's set rest, so finishing an exercise earns the same recovery as finishing
 * one of its sets.
 */
export function buildCircuitTimeline(steps: CircuitStep[], pauseBetween = false): Timeline {
  const segments: Segment[] = [];
  const blocks: Block[] = [];
  const holds: number[] = [];
  let cursor = 0;

  const add = (
    phase: Phase,
    duration: number,
    cycle: number,
    set: number,
    block: number,
    between = false,
  ) => {
    if (duration <= 0) return;
    segments.push({ phase, duration, cycle, set, start: cursor, block, between });
    cursor += duration;
  };

  steps.forEach(({ name, config }, block) => {
    const cycles = Math.max(1, config.cycles);
    const sets = Math.max(1, config.sets);
    blocks.push({ name, cycles, sets });

    if (block === 0) {
      add('prepare', config.prepareSeconds, 1, 1, block);
    } else {
      add('setRest', steps[block - 1].config.setRestSeconds, 1, 1, block, true);
      // Held after the break rather than before it, so the recovery still runs
      // on its own and the wait only covers getting set up.
      if (pauseBetween) holds.push(cursor);
    }

    for (let set = 1; set <= sets; set++) {
      for (let cycle = 1; cycle <= cycles; cycle++) {
        add('work', config.workSeconds, cycle, set, block);
        // No plain rest after the final cycle — the set rest (or the end of the
        // exercise) covers that recovery instead.
        if (cycle < cycles) add('rest', config.restSeconds, cycle, set, block);
      }
      if (set < sets) add('setRest', config.setRestSeconds, cycles, set, block);
    }
  });

  return {
    segments,
    totalDuration: cursor,
    workCount: segments.filter((s) => s.phase === 'work').length,
    blocks,
    holds,
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

/**
 * The cue owed at `now`, and where the cursor moves to.
 *
 * Deliberately a *lookup*, not a chain: it takes the clock and a cursor and
 * re-derives the answer from scratch every time. A scheduler that arms each cue
 * from the previous one has a single point of failure — one link that fails to
 * arm silently kills every cue after it — whereas a lookup driven by the
 * sampling loop simply catches up on the next sample.
 *
 * `lead` fires a cue slightly before its instant, to cover the latency between
 * asking for a sound and hearing it. `stale` walks the cursor past cues the
 * clock has already left behind, so skipping a phase does not empty the whole
 * queue of swallowed cues at once.
 */
export function nextDueCue(
  schedule: CueEvent[],
  cursor: number,
  now: number,
  lead: number,
  stale: number,
): { cue: CueName | null; cursor: number } {
  let index = cursor;
  while (index < schedule.length && schedule[index].at < now - stale) index++;

  const event = schedule[index];
  if (event && event.at <= now + lead) {
    return { cue: event.cue, cursor: index + 1 };
  }
  return { cue: null, cursor: index };
}
