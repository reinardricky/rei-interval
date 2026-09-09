import { defaultConfig, sanitizeConfig, totalSeconds } from './config';
import { buildCueSchedule, buildTimeline, indexAt, nextDueCue } from './timeline';
import { parsePresets, uniqueName, type Preset } from './preset';

describe('timeline', () => {
  it('flattened length agrees with totalSeconds', () => {
    const configs = [
      defaultConfig,
      { ...defaultConfig, prepareSeconds: 0, restSeconds: 0 },
      { ...defaultConfig, cycles: 1, sets: 1 },
      { ...defaultConfig, cycles: 1, sets: 4, setRestSeconds: 90 },
      { prepareSeconds: 15, workSeconds: 7, restSeconds: 3, cycles: 6, sets: 3, setRestSeconds: 120 },
    ];
    for (const config of configs) {
      expect(buildTimeline(config).totalDuration).toBe(totalSeconds(config));
    }
  });

  it('lays out prepare, work/rest cycles and set rests in order', () => {
    const timeline = buildTimeline({
      prepareSeconds: 10,
      workSeconds: 20,
      restSeconds: 10,
      cycles: 2,
      sets: 2,
      setRestSeconds: 60,
    });
    expect(timeline.segments.map((s) => s.phase)).toEqual([
      'prepare',
      'work', 'rest', 'work',
      'setRest',
      'work', 'rest', 'work',
    ]);
  });

  it('omits zero-length phases', () => {
    const timeline = buildTimeline({
      ...defaultConfig,
      prepareSeconds: 0,
      restSeconds: 0,
      cycles: 3,
      sets: 1,
    });
    expect(new Set(timeline.segments.map((s) => s.phase))).toEqual(new Set(['work']));
  });

  it('indexAt resolves boundaries to the segment that is starting', () => {
    const timeline = buildTimeline({
      prepareSeconds: 10,
      workSeconds: 20,
      restSeconds: 10,
      cycles: 2,
      sets: 1,
      setRestSeconds: 0,
    });
    expect(indexAt(timeline, 0)).toBe(0);
    expect(indexAt(timeline, 9)).toBe(0);
    expect(indexAt(timeline, 10)).toBe(1);
    expect(indexAt(timeline, 30)).toBe(2);
    expect(indexAt(timeline, 40)).toBe(3);
    // Past the end, so the engine can complete.
    expect(indexAt(timeline, 60)).toBe(timeline.segments.length);
  });

  it('cycle and set counters advance with the session', () => {
    const timeline = buildTimeline({
      prepareSeconds: 0,
      workSeconds: 10,
      restSeconds: 5,
      cycles: 2,
      sets: 2,
      setRestSeconds: 30,
    });
    expect(
      timeline.segments.filter((s) => s.phase === 'work').map((s) => `${s.set}/${s.cycle}`),
    ).toEqual(['1/1', '1/2', '2/1', '2/2']);
  });
});

describe('cue schedule', () => {
  it('opens every phase and counts down its last three seconds', () => {
    const timeline = buildTimeline({
      prepareSeconds: 10,
      workSeconds: 20,
      restSeconds: 0,
      cycles: 1,
      sets: 1,
      setRestSeconds: 0,
    });
    expect(buildCueSchedule(timeline)).toEqual([
      { at: 0, cue: 'rest' }, // prepare opens on the non-work tone
      { at: 7, cue: 'tick' },
      { at: 8, cue: 'tick' },
      { at: 9, cue: 'tick' },
      { at: 10, cue: 'work' },
      { at: 27, cue: 'tick' },
      { at: 28, cue: 'tick' },
      { at: 29, cue: 'tick' },
      { at: 30, cue: 'complete' },
    ]);
  });

  it('never ticks before a phase it belongs to has begun', () => {
    // A 2s phase has room for one countdown tick, not three.
    const timeline = buildTimeline({
      prepareSeconds: 0,
      workSeconds: 2,
      restSeconds: 0,
      cycles: 1,
      sets: 1,
      setRestSeconds: 0,
    });
    const schedule = buildCueSchedule(timeline);
    expect(schedule.every((event) => event.at >= 0)).toBe(true);
    expect(schedule).toEqual([
      { at: 0, cue: 'work' },
      { at: 1, cue: 'tick' },
      { at: 2, cue: 'complete' },
    ]);
  });

  it('is ordered, and every cue lands inside the session', () => {
    const timeline = buildTimeline(defaultConfig);
    const schedule = buildCueSchedule(timeline);
    const offsets = schedule.map((event) => event.at);
    expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
    expect(offsets[0]).toBe(0);
    expect(offsets[offsets.length - 1]).toBe(timeline.totalDuration);
  });

  it('opens each phase exactly once', () => {
    const timeline = buildTimeline(defaultConfig);
    const openings = buildCueSchedule(timeline).filter((event) => event.cue !== 'tick');
    // One per segment, plus the completion cue.
    expect(openings).toHaveLength(timeline.segments.length + 1);
  });
});

describe('cue lookup', () => {
  const LEAD = 0.12;
  const STALE = 0.25;
  const TICK = 0.1;

  /** Walks a session at the real sample rate, collecting what was sounded. */
  function run(timeline: ReturnType<typeof buildTimeline>, from = 0) {
    const schedule = buildCueSchedule(timeline);
    const fired: { at: number; cue: string }[] = [];
    let cursor = 0;
    for (let now = from; now < timeline.totalDuration; now += TICK) {
      const due = nextDueCue(schedule, cursor, now, LEAD, STALE);
      cursor = due.cursor;
      if (due.cue) fired.push({ at: Number(now.toFixed(2)), cue: due.cue });
    }
    return fired;
  }

  const timeline = buildTimeline({
    prepareSeconds: 5,
    workSeconds: 6,
    restSeconds: 4,
    cycles: 2,
    sets: 1,
    setRestSeconds: 0,
  });

  it('sounds every cue in the schedule exactly once, in order', () => {
    const schedule = buildCueSchedule(timeline);
    // Including the completion cue: the lead pulls it onto the last sample
    // before the clock runs out.
    expect(run(timeline).map((f) => f.cue)).toEqual(schedule.map((e) => e.cue));
  });

  it('never fires a cue late, and never earlier than the lead', () => {
    const schedule = buildCueSchedule(timeline);
    run(timeline).forEach((f, i) => {
      const early = schedule[i].at - f.at;
      if (schedule[i].at === 0) {
        // Nothing precedes offset 0, so the opening cue lands exactly on it.
        expect(early).toBe(0);
        return;
      }
      // Firing is quantised to the sample grid, so a cue lands on the last
      // sample before its instant: strictly early, by at most the lead. Raising
      // CUE_LEAD_S only moves this once it crosses a multiple of TICK_MS.
      expect(early).toBeGreaterThan(0);
      expect(early).toBeLessThanOrEqual(LEAD + 1e-9);
    });
  });

  it('counts down the last three seconds of each phase', () => {
    // Work runs 5..11, so its countdown ticks belong to seconds 8, 9 and 10.
    const ticks = buildCueSchedule(timeline)
      .filter((e) => e.cue === 'tick' && e.at >= 5 && e.at < 11)
      .map((e) => e.at);
    expect(ticks).toEqual([8, 9, 10]);
  });

  it('recovers after a stalled run of samples instead of dying', () => {
    const schedule = buildCueSchedule(timeline);
    // Nothing sampled since the session began. A chain armed from the previous
    // cue would be dead here; the lookup just answers for the clock it is given
    // and sounds the cue that is due now.
    const due = nextDueCue(schedule, 0, 3.05, LEAD, STALE);
    expect(due.cue).toBe('tick'); // prepare runs 0..5, so this is "2 to go"
    expect(schedule[due.cursor - 1].at).toBe(3);
  });

  // SOUNDPOOL_LEAD_S and EXPO_AUDIO_LEAD_S in audio.ts. A lead approaching the
  // 1s gap between countdown ticks would start pulling cues out of order, so
  // both shipped values are walked rather than assumed safe.
  it.each([
    ['soundpool', 0.05],
    ['expo-audio', 0.6],
  ])('still sequences correctly at the %s lead', (_backend, lead) => {
    const schedule = buildCueSchedule(timeline);
    const fired: string[] = [];
    let cursor = 0;
    for (let now = 0; now < timeline.totalDuration; now += TICK) {
      const due = nextDueCue(schedule, cursor, now, lead, STALE);
      cursor = due.cursor;
      if (due.cue) fired.push(due.cue);
    }
    // The completion cue sits exactly on totalDuration — past the last sample a
    // running clock takes. Only a lead of at least one tick pulls it back onto
    // the grid; below that `finish()` owns it, which is why the engine sounds
    // it there when the cursor has not already consumed it.
    const beforeEnd = schedule
      .filter((e) => e.at < timeline.totalDuration)
      .map((e) => e.cue);
    expect(fired).toEqual(lead >= TICK ? schedule.map((e) => e.cue) : beforeEnd);
  });

  it('drops a cue the clock has left behind rather than firing it late', () => {
    const schedule = buildCueSchedule(timeline);
    // 0.9s past the tick at 4: too late to mean anything, so it is skipped and
    // the phase-opening cue at 5 is what sounds.
    expect(nextDueCue(schedule, 0, 4.9, LEAD, STALE).cue).toBe('work');
  });

  it('walks past cues a skip jumped over rather than firing a burst', () => {
    const schedule = buildCueSchedule(timeline);
    // Jumping from the start of prepare to the start of work skips 3 ticks.
    const due = nextDueCue(schedule, 0, 5, LEAD, STALE);
    expect(due.cue).toBe('work');
  });
});

describe('config sanitising', () => {
  it('falls back to defaults for junk and clamps out-of-range values', () => {
    expect(sanitizeConfig(null)).toEqual(defaultConfig);
    expect(sanitizeConfig({ workSeconds: 'nope' }).workSeconds).toBe(defaultConfig.workSeconds);
    expect(sanitizeConfig({ cycles: 9999 }).cycles).toBe(99);
    expect(sanitizeConfig({ workSeconds: 0 }).workSeconds).toBe(1);
  });
});

describe('presets', () => {
  const make = (id: string, name: string): Preset => ({ id, name, config: defaultConfig });

  it('suffixes colliding names case-insensitively, keeping typed casing', () => {
    const presets = [make('a', 'Power')];
    expect(uniqueName(presets, 'power')).toBe('power 2');
    expect(uniqueName(presets, 'Endurance')).toBe('Endurance');
    // Renaming a preset to its own name must not suffix it.
    expect(uniqueName(presets, 'Power', 'a')).toBe('Power');
  });

  it('skips malformed records rather than dropping the whole list', () => {
    const parsed = parsePresets([
      { id: 'a', name: 'Good', config: defaultConfig },
      { id: 1, name: 'Bad id' },
      null,
      { id: 'b', name: 'Also good' },
    ]);
    expect(parsed.map((p) => p.name)).toEqual(['Good', 'Also good']);
    expect(parsed[1].config).toEqual(defaultConfig);
  });

  it('is not an array', () => {
    expect(parsePresets('nope')).toEqual([]);
  });
});
