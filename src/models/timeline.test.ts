import { defaultConfig, sanitizeConfig, totalSeconds } from './config';
import { buildCueSchedule, buildTimeline, indexAt } from './timeline';
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
