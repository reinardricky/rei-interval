import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

/**
 * Short cues for the interval timer.
 *
 * A beep that lands late — or not at all — is worse than no beep, because the
 * athlete is timing off it. Two things get in the way:
 *
 * 1. Setup is asynchronous but the first cue is not: the workout starts on the
 *    same tick as the button press. A cue asked for before the pipeline is warm
 *    is held and fired on completion (see `pending`).
 * 2. A player has to be rewound before it can sound again, and one player
 *    cannot overlap itself — the last three seconds tick once a second, and the
 *    phase-change cue lands on top of the final tick. Each cue therefore gets a
 *    small pool of voices used round-robin, so by the time a voice comes round
 *    again it has long finished.
 *
 * Do NOT try to rewind a player when it *finishes* in order to save the seek on
 * the hot path. Playback resumes off the back of that seek and the cue loops
 * forever.
 */
type CueName = 'tick' | 'work' | 'rest' | 'complete';

const sources: Record<CueName, number> = {
  tick: require('../assets/sounds/tick.wav'),
  work: require('../assets/sounds/work.wav'),
  rest: require('../assets/sounds/rest.wav'),
  complete: require('../assets/sounds/complete.wav'),
};

/**
 * Voices per cue. Ticks are the only cue that fires in quick succession; the
 * phase cues need a spare only for the boundary where one lands on the tail of
 * the last countdown tick.
 */
const voiceCount: Record<CueName, number> = {
  tick: 3,
  work: 2,
  rest: 2,
  complete: 1,
};

/**
 * How stale a cue held during warm-up may be before it is dropped. A beep half
 * a second late is a beep against the wrong second.
 */
const PENDING_MAX_AGE_MS = 400;

/** Status updates only drive progress UI, which this app has none of. Emitting
 *  them from every voice is pure bridge traffic, so ask for the slowest rate. */
const UPDATE_INTERVAL_MS = 1000;

type Pool = { voices: AudioPlayer[]; next: number };

let pools: Partial<Record<CueName, Pool>> = {};
let ready = false;
/** Memoised so concurrent callers share one warm-up rather than racing to
 *  build two sets of players. */
let initPromise: Promise<void> | null = null;
let pending: { name: CueName; at: number } | null = null;

export function initAudio(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // A timer must keep beeping with the ringer off and while another app is
      // playing music — nobody trains in silence.
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: true,
        interruptionMode: 'mixWithOthers',
      });
    } catch {
      // Audio mode is a nicety; carry on without it.
    }

    try {
      (Object.keys(sources) as CueName[]).forEach((name) => {
        pools[name] = {
          voices: Array.from({ length: voiceCount[name] }, () =>
            createAudioPlayer(sources[name], { updateInterval: UPDATE_INTERVAL_MS }),
          ),
          next: 0,
        };
      });
      ready = true;
    } catch {
      ready = false;
      return;
    }

    const queued = pending;
    pending = null;
    if (queued && Date.now() - queued.at <= PENDING_MAX_AGE_MS) playCue(queued.name);
  })();

  return initPromise;
}

export function playCue(name: CueName): void {
  if (!ready) {
    // The opening cue of a workout arrives on the same tick as the button
    // press, before warm-up can finish. Hold it rather than dropping it.
    pending = { name, at: Date.now() };
    void initAudio();
    return;
  }

  const pool = pools[name];
  if (!pool) return;

  const voice = pool.voices[pool.next];
  pool.next = (pool.next + 1) % pool.voices.length;

  try {
    // Rewind and play, neither awaiting the other. `play()` must never be made
    // conditional on the rewind resolving: a seek that rejects or never settles
    // then means silence, which is a worse failure than a slightly late beep.
    // The voice pool, not the ordering of these two calls, is what stops a cue
    // landing on a player that is still busy.
    void voice.seekTo(0);
    voice.play();
  } catch {
    // A dropped cue is not worth interrupting the workout for.
  }
}

export function releaseAudio(): void {
  Object.values(pools).forEach((pool) => {
    pool?.voices.forEach((voice) => {
      try {
        voice.remove();
      } catch {
        // ignored
      }
    });
  });
  pools = {};
  ready = false;
  initPromise = null;
  pending = null;
}
