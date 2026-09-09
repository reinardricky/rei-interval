import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

/**
 * Short synthesised cues for the interval timer.
 *
 * Players are created once and rewound on each use: constructing a player per
 * beep adds enough latency that a cue meant for the exact second lands late.
 */
type CueName = 'tick' | 'work' | 'rest' | 'complete';

const sources: Record<CueName, number> = {
  tick: require('../assets/sounds/tick.wav'),
  work: require('../assets/sounds/work.wav'),
  rest: require('../assets/sounds/rest.wav'),
  complete: require('../assets/sounds/complete.wav'),
};

let players: Partial<Record<CueName, AudioPlayer>> = {};
let ready = false;

export async function initAudio(): Promise<void> {
  if (ready) return;
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
      players[name] = createAudioPlayer(sources[name]);
    });
    ready = true;
  } catch {
    ready = false;
  }
}

export function playCue(name: CueName): void {
  const player = players[name];
  if (!player) return;
  try {
    // Rewind first: a player left at the end would otherwise stay silent.
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
  ready = false;
}
