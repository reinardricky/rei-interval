import { defaultConfig, type IntervalConfig } from './config';
import { circuitsUsing, moveStep, parseCircuits, resolveSteps, type Circuit } from './circuit';
import { buildCircuitTimeline, buildCueSchedule, indexAt } from './timeline';
import type { Preset } from './preset';

const config = (overrides: Partial<IntervalConfig>): IntervalConfig => ({
  prepareSeconds: 10,
  workSeconds: 20,
  restSeconds: 10,
  cycles: 2,
  sets: 1,
  setRestSeconds: 60,
  ...overrides,
});

describe('circuit timeline', () => {
  const push = { name: 'Push-ups', config: config({ setRestSeconds: 45 }) };
  const squat = {
    name: 'Squats',
    config: config({ prepareSeconds: 15, sets: 2, setRestSeconds: 30 }),
  };

  it('prepares only once, and bridges exercises with the earlier set rest', () => {
    const timeline = buildCircuitTimeline([push, squat]);
    expect(
      timeline.segments.map((s) => `${s.block}:${s.phase}${s.between ? '*' : ''}`),
    ).toEqual([
      '0:prepare',
      '0:work', '0:rest', '0:work',
      '1:setRest*', // Push-ups' set rest, not Squats' own set rest or prepare
      '1:work', '1:rest', '1:work',
      '1:setRest',
      '1:work', '1:rest', '1:work',
    ]);
    expect(timeline.segments.find((s) => s.between)?.duration).toBe(45);
  });

  it('adds up to the parts, less the later prepares, plus the breaks', () => {
    const timeline = buildCircuitTimeline([push, squat]);
    // push: 10 + 20 + 10 + 20 = 60; break 45; squat: (20 + 10 + 20) × 2 + 30 = 130
    expect(timeline.totalDuration).toBe(60 + 45 + 130);
    expect(timeline.workCount).toBe(6);
  });

  it('records each exercise with its own cycle and set counts', () => {
    expect(buildCircuitTimeline([push, squat]).blocks).toEqual([
      { name: 'Push-ups', cycles: 2, sets: 1 },
      { name: 'Squats', cycles: 2, sets: 2 },
    ]);
  });

  it('skips a zero-length break rather than adding an empty segment', () => {
    const noBreak = { ...push, config: config({ setRestSeconds: 0 }) };
    const timeline = buildCircuitTimeline([noBreak, squat]);
    expect(timeline.segments.some((s) => s.between)).toBe(false);
    expect(timeline.segments.every((s) => s.duration > 0)).toBe(true);
  });

  it('holds at the opening of each later exercise, after its break', () => {
    const timeline = buildCircuitTimeline([push, squat, push], true);
    // push 60, break 45 → squat opens at 105; squat 130, break 30 → push opens at 265.
    expect(timeline.holds).toEqual([105, 265]);
    for (const hold of timeline.holds) {
      const opening = timeline.segments[indexAt(timeline, hold)];
      expect(opening.start).toBe(hold);
      expect(opening.phase).toBe('work');
    }
    expect(buildCircuitTimeline([push, squat]).holds).toEqual([]);
  });

  it('opens the next exercise on the work cue, at the hold', () => {
    const timeline = buildCircuitTimeline([push, squat], true);
    const openings = buildCueSchedule(timeline).filter(
      (e) => e.at === timeline.holds[0] && e.cue !== 'tick',
    );
    expect(openings).toEqual([{ at: timeline.holds[0], cue: 'work' }]);
  });

  it('plays a single step like the preset on its own', () => {
    const one = buildCircuitTimeline([squat]);
    expect(one.segments[0].phase).toBe('prepare');
    expect(one.segments.some((s) => s.between)).toBe(false);
  });

  it('is empty with no steps', () => {
    const timeline = buildCircuitTimeline([]);
    expect(timeline.segments).toEqual([]);
    expect(timeline.totalDuration).toBe(0);
  });
});

describe('circuits', () => {
  const presets: Preset[] = [
    { id: 'a', name: 'A', config: defaultConfig },
    { id: 'b', name: 'B', config: defaultConfig },
  ];
  const circuit: Circuit = {
    id: 'c',
    name: 'C',
    presetIds: ['a', 'gone', 'b', 'a'],
    pauseBetween: false,
  };

  it('resolves steps in order, skipping deleted presets and allowing repeats', () => {
    expect(resolveSteps(circuit, presets).map((s) => s.name)).toEqual(['A', 'B', 'A']);
  });

  it('counts the circuits a preset appears in', () => {
    expect(circuitsUsing([circuit, { ...circuit, presetIds: ['b'] }], 'a')).toBe(1);
    expect(circuitsUsing([circuit], 'zzz')).toBe(0);
  });

  it('moves steps and refuses to move past either end', () => {
    expect(moveStep(circuit, 0, 1).presetIds).toEqual(['gone', 'a', 'b', 'a']);
    expect(moveStep(circuit, 0, -1)).toBe(circuit);
    expect(moveStep(circuit, 3, 1)).toBe(circuit);
  });

  it('parses stored circuits, skipping malformed records', () => {
    expect(
      parseCircuits([
        { id: 'x', name: 'X', presetIds: ['a', 3, 'b'], pauseBetween: true },
        { id: 2, name: 'Bad' },
        { id: 'y', name: 'Y' },
      ]),
    ).toEqual([
      { id: 'x', name: 'X', presetIds: ['a', 'b'], pauseBetween: true },
      { id: 'y', name: 'Y', presetIds: [], pauseBetween: false },
    ]);
    expect(parseCircuits('nope')).toEqual([]);
  });
});
