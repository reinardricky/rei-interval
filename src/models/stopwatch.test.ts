import { formatElapsed } from './config';
import {
  idleStopwatch,
  parseStopwatch,
  pauseStopwatch,
  startStopwatch,
  stopStopwatch,
  stopwatchElapsed,
} from './stopwatch';

describe('stopwatch', () => {
  it('reads from timestamps, banking time across pauses', () => {
    let s = startStopwatch(idleStopwatch, 1_000);
    expect(stopwatchElapsed(s, 6_000)).toBe(5_000);
    s = pauseStopwatch(s, 6_000);
    // Time spent paused does not count.
    expect(stopwatchElapsed(s, 60_000)).toBe(5_000);
    s = startStopwatch(s, 60_000);
    expect(stopwatchElapsed(s, 62_500)).toBe(7_500);
  });

  it('freezes on stop, and starting again begins a fresh workout', () => {
    let s = startStopwatch(idleStopwatch, 0);
    s = stopStopwatch(s, 90_000);
    expect(s.status).toBe('stopped');
    expect(stopwatchElapsed(s, 999_999)).toBe(90_000);
    s = startStopwatch(s, 100_000);
    expect(stopwatchElapsed(s, 101_000)).toBe(1_000);
  });

  it('ignores transitions that do not apply', () => {
    const running = startStopwatch(idleStopwatch, 0);
    expect(startStopwatch(running, 5_000)).toBe(running);
    expect(pauseStopwatch(idleStopwatch, 5_000)).toBe(idleStopwatch);
    expect(stopStopwatch(idleStopwatch, 5_000)).toBe(idleStopwatch);
  });

  it('never reads negative when the wall clock goes backwards', () => {
    const s = startStopwatch(idleStopwatch, 10_000);
    expect(stopwatchElapsed(s, 4_000)).toBe(0);
  });

  it('survives a round trip through storage, and rejects junk', () => {
    const s = pauseStopwatch(startStopwatch(idleStopwatch, 0), 3_000);
    expect(parseStopwatch(JSON.parse(JSON.stringify(s)))).toEqual(s);
    expect(parseStopwatch(null)).toEqual(idleStopwatch);
    expect(parseStopwatch({ status: 'running' })).toEqual(idleStopwatch);
    expect(parseStopwatch({ status: 'paused', accumulatedMs: -5 }).accumulatedMs).toBe(0);
  });

  it('formats as m:ss, then h:mm:ss past the hour', () => {
    expect(formatElapsed(0)).toBe('0:00');
    expect(formatElapsed(65_999)).toBe('1:05');
    expect(formatElapsed(3_600_000 + 2 * 60_000 + 3_000)).toBe('1:02:03');
  });
});
