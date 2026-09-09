import { createAudioPlayer, preload, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

import { CuePlayer } from '../modules/cue-player';

/**
 * Cues for the interval timer.
 *
 * Primary path is the `cue-player` native module, which uses Android's
 * `SoundPool`: short clips decoded into memory once and fired from there, in
 * tens of milliseconds, with no playback state to rewind. That is the same
 * model as the Web Audio API, and it is what a metronome actually needs.
 *
 * The fallback is `expo-audio`, which wraps ExoPlayer — a *media* player built
 * for streaming. It works, but it carries a playback position that has to be
 * rewound, takes hundreds of milliseconds to start, and is slower still (or
 * silent) on a player that is cold or has been idle. Everything awkward in this
 * file exists to prop that up: warming every player at startup, and firing cues
 * far enough ahead to hide the delay. None of it applies to the SoundPool path.
 *
 * Traps this must not fall back into, each of which broke the app once:
 *
 * - Never gate playback on a readiness flag. `isLoaded` is refreshed by status
 *   events, an idle player emits none, so it never flips and nothing sounds.
 * - Never rewind a player from inside its own status event. That restarts it,
 *   and the cue loops forever.
 * - Never make `play()` conditional on an awaited `seekTo`. A seek that never
 *   settles then means silence.
 */
export type CueName = 'tick' | 'work' | 'rest' | 'complete';

/** `res/raw` resource names, which is where the SoundPool path reads from. */
const rawNames: Record<CueName, string> = {
  tick: 'cue_tick',
  work: 'cue_work',
  rest: 'cue_rest',
  complete: 'cue_complete',
};

/** Bundled copies, used only by the `expo-audio` fallback. */
const sources: Record<CueName, number> = {
  tick: require('../assets/sounds/tick.wav'),
  work: require('../assets/sounds/work.wav'),
  rest: require('../assets/sounds/rest.wav'),
  complete: require('../assets/sounds/complete.wav'),
};

const names = Object.keys(rawNames) as CueName[];

/** True once the SoundPool samples are decoded and cues can go the fast way. */
let nativeReady = false;

// ── expo-audio fallback state ────────────────────────────────────────────────
let players: Partial<Record<CueName, AudioPlayer>> = {};
let cued = false;
let initPromise: Promise<void> | null = null;
let pending: { name: CueName; at: number } | null = null;

/** How stale a cue held during fallback warm-up may be before it is dropped. */
const PENDING_MAX_AGE_MS = 400;
/** Long enough for ExoPlayer to allocate an output track, inaudibly. */
const PRIME_MS = 200;

if (!CuePlayer) {
  // Only the fallback needs the bundler to start fetching these.
  try {
    names.forEach((name) => {
      void preload(sources[name]).catch(() => {});
    });
  } catch {
    // An optimisation only.
  }
}

export function initAudio(): Promise<void> {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const native = CuePlayer;
    if (native) {
      try {
        // Decoding is in-memory and takes milliseconds; no audio session to
        // configure, and nothing to warm up.
        names.forEach((name) => native.load(rawNames[name]));
        nativeReady = true;
        return;
      } catch {
        // Fall through and set up expo-audio instead.
      }
    }

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
      names.forEach((name) => {
        const player = createAudioPlayer(sources[name]);
        players[name] = player;
        prime(player);
      });
    } catch {
      players = {};
      return;
    }

    const queued = pending;
    pending = null;
    if (queued && Date.now() - queued.at <= PENDING_MAX_AGE_MS) playCue(queued.name);
  })();

  return initPromise;
}

/**
 * Plays an ExoPlayer through once inaudibly, so a workout never pays for its
 * first play. Driven by a plain timer, never by the player's own events.
 * Fallback path only — SoundPool has no such warm-up cost.
 */
function prime(player: AudioPlayer): void {
  try {
    // Silenced before play is ever called, so there is no audible window.
    player.volume = 0;
    player.play();
    setTimeout(() => {
      if (cued) return; // a real cue took the player over
      try {
        player.pause();
        void player.seekTo(0);
        player.volume = 1;
      } catch {
        // `playCue` restores the volume regardless.
      }
    }, PRIME_MS);
  } catch {
    // Priming is an optimisation, not a prerequisite.
  }
}

export function playCue(name: CueName): void {
  if (CuePlayer && nativeReady) {
    try {
      CuePlayer.play(rawNames[name]);
      return;
    } catch {
      // Drop through to the fallback for this cue.
    }
  }

  const player = players[name];
  if (!player) {
    pending = { name, at: Date.now() };
    void initAudio();
    return;
  }

  cued = true;
  try {
    player.volume = 1;
    void player.seekTo(0);
    player.play();
  } catch {
    // A dropped cue is not worth interrupting the workout for.
  }
}

export function releaseAudio(): void {
  Object.values(players).forEach((player) => {
    try {
      player?.remove();
    } catch {
      // ignored
    }
  });
  players = {};
  initPromise = null;
  pending = null;
  cued = false;
  // SoundPool samples are released by the native module's own teardown.
  nativeReady = false;
}

/** Which backend is live, for reporting timing problems against. */
export function audioBackend(): 'soundpool' | 'expo-audio' {
  return CuePlayer && nativeReady ? 'soundpool' : 'expo-audio';
}

/**
 * SoundPool fires a decoded in-memory sample in tens of milliseconds, so a cue
 * wants firing essentially on its instant. Anything larger and the beeps land
 * audibly ahead of the clock.
 */
const SOUNDPOOL_LEAD_S = 0.05;

/**
 * ExoPlayer's round trip was measured at roughly 600ms on device: cues fired
 * 0.1s early were heard about half a second late. The whole reason the native
 * module exists is to not need a number this large.
 */
const EXPO_AUDIO_LEAD_S = 0.6;

/**
 * How far ahead of its instant a cue must be fired to be *heard* on it.
 *
 * This belongs here rather than in the engine because only this module knows
 * which backend actually took, and the two differ by more than an order of
 * magnitude.
 */
export function cueLeadSeconds(): number {
  return audioBackend() === 'soundpool' ? SOUNDPOOL_LEAD_S : EXPO_AUDIO_LEAD_S;
}
