# Rei's Interval

A Tabata / HIIT interval timer for Android. Dark, high-contrast, and built so the
clock stays honest even when Android throttles background timers.

## Features

- **Preset tabs.** Each tab is a named workout config and saves as you edit it —
  there is no save button. Add with `+`, rename, duplicate or delete from the tab
  options sheet (tap the open tab, or long-press any tab).
- **Configurable intervals** — prepare, work, rest, cycles, sets, rest between
  sets. Steppers for quick nudges, tap the value for a keypad.
- **Workout screen** — large countdown ring, phase colour as an accent, cycle and
  set trackers, and an *Up next* queue of the whole session that auto-scrolls.
- **Audio cues** — a tick on the last three seconds and a distinct tone at each
  phase change. Mutable, and the setting persists.
- **Screen stays awake** for the duration of a workout.

## Requirements

**Node ≥ 22.13** (or 20.19.4+, or 24.3+). React Native 0.86 declares this and
will emit `EBADENGINE` warnings on older versions — Node 22.4 in particular is
just below the line.

```bash
nvm install 22 && nvm use 22
```

## Running in development

```bash
npm install
npx expo start          # then press "a", or scan with Expo Go
```

Note: audio and keep-awake are native modules. They work in Expo Go, but if you
hit anything odd, build a development client (`eas build --profile development`).

## Building an APK

### Cloud (recommended — no Android SDK needed)

```bash
npm install -g eas-cli
eas login
eas build --platform android --profile preview
```

The `preview` profile is configured for `buildType: apk`, so you get an
installable APK rather than an AAB. EAS gives you a download link when it
finishes.

### Local

Requires the Android SDK and JDK 17 installed, with `ANDROID_HOME` set.

```bash
npm run prebuild          # expo prebuild --platform android --clean
cd android && ./gradlew assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk
```

The `android/` folder is generated and gitignored — regenerate it rather than
editing it by hand, or your changes will be wiped by the next prebuild.

## Verifying

```bash
npm run typecheck   # tsc --noEmit
npm test            # jest — timeline and preset logic
```

## How the timer works

The engine lives in [`src/useIntervalApp.ts`](src/useIntervalApp.ts). Two ideas
carry it:

**The interval is a sampler, not an accumulator.** Elapsed time is always
recomputed from `Date.now()` rather than decremented once per tick. Android
throttles (and eventually suspends) JS timers for backgrounded apps, so a
counter that subtracts per tick compounds every missed tick into permanent
drift. Sampling a clock means a throttled tick costs animation smoothness and
nothing else — the next tick that fires is already correct. Returning to the
foreground also forces an immediate resync via `AppState`.

**The session is precomputed as a flat timeline.** `buildTimeline()` in
[`src/models/timeline.ts`](src/models/timeline.ts) expands a config into an
ordered list of segments with absolute offsets. "Which phase am I in?" becomes a
lookup against elapsed seconds, so skip, progress, cycle/set counters and the
up-next list all derive from one source of truth — there are no mutable counters
that can fall out of step with each other.

## Design

Near-black ground (`#0E0E10`) with the phase colour used as an *accent* — the
ring, the active queue row, the primary control — plus a gradient wash bleeding
from the top. Flooding the screen with the phase colour is the obvious first
approach and it fails: nothing has anything to contrast against, and the queue
sinks into the background. Paused drains the accent to grey, so "not running" is
readable without reading anything.

Phase palette: Prepare amber, Work orange, Rest green, Set Rest blue.
