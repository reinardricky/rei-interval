# Rei's Interval

A Tabata / HIIT interval timer for Android. Dark, high-contrast, and built so the
clock stays honest even when Android throttles background timers.

## Features

- **Preset tabs.** Each tab is a named workout config and saves as you edit it —
  there is no save button. Add with `+`, rename, duplicate or delete from the tab
  options sheet (tap the open tab, or long-press any tab).
- **Configurable intervals** — prepare, work, rest, cycles, sets, rest between
  sets. Steppers for quick nudges, tap the value for a keypad.
- **Circuits** — chain presets into one continuous workout (switch to
  *Circuits* above the tabs). Only the first exercise gets its prepare
  countdown; between exercises the earlier one's *rest between sets* runs as
  the break. Steps link to their presets, so editing a preset updates every
  circuit using it. Optionally pause before each new exercise until you tap.
- **Workout stopwatch** — a total-time clock pinned to the top of every screen,
  independent of the intervals. Starting a workout starts it; pausing the
  intervals does not pause it. Stop freezes the total until you clear it, and it
  survives the app being closed.
- **Workout screen** — large countdown ring, phase colour as an accent, cycle and
  set trackers, and an *Up next* queue of the whole session that auto-scrolls.
- **Audio cues** — a tick on the last three seconds and a distinct tone at each
  phase change. Mutable, and the setting persists.
- **Screen stays awake** for the duration of a workout.

## Requirements

This is a plain native Android project — you build it yourself and install it
over a USB cable. There is no cloud build step and no Expo Go.

- **Node ≥ 22.13** (or 20.19.4+, or 24.3+). React Native 0.86 declares this and
  will emit `EBADENGINE` warnings on older versions — Node 22.4 in particular is
  just below the line.
- **JDK 17 or newer**, with `JAVA_HOME` set.
- **Android SDK**, with `ANDROID_HOME` set. Android Studio installs it to
  `%LOCALAPPDATA%\Android\Sdk` on Windows, `~/Library/Android/sdk` on macOS.
- Add `$ANDROID_HOME/platform-tools` to your `PATH` so you can run `adb`
  yourself. The build does not need it — it finds `adb` via `ANDROID_HOME` — but
  every debugging step below does.

## Running on a device over USB

On the phone, enable **Developer options** (tap Build number seven times in
Settings → About phone), then turn on **USB debugging**. Plug in the cable and
accept the RSA fingerprint prompt.

```bash
adb devices          # should list your phone as "device", not "unauthorized"
npm install
npm run android      # Gradle build → installs via adb → starts Metro
```

The first build compiles the native project and takes a few minutes. After that,
JS changes reload instantly over the cable and you only rebuild when native
dependencies or anything under `android/` changes.

If the app is already installed and you only want the JS dev server:

```bash
npm start            # Metro on localhost, reached over the cable via adb reverse
```

`npm start` uses `--localhost`, which routes Metro through `adb reverse
tcp:8081` — the phone talks to your machine over USB, so it works with no shared
Wi-Fi at all. Use `npm run start:lan` instead if you'd rather serve over the
network. If the app can't reach the bundler, re-run the forward by hand:

```bash
adb reverse tcp:8081 tcp:8081
```

Useful while running:

```bash
adb logcat -s ReactNative:V ReactNativeJS:V   # JS logs and redbox stack traces
adb shell input keyevent 82                   # open the dev menu on the device
adb uninstall com.reinardricky.reisinterval   # start from a clean install
```

## Building an APK

```bash
npm run apk
# → android/app/build/outputs/apk/release/app-release.apk
```

Install it on the connected phone with `adb install -r <path>`, or use
`npm run android:release` to build the release variant and push it over the
cable in one step. `npm run aab` produces an app bundle for the Play Store.

> **If the release build dies with `clang frontend command failed due to
> signal`,** it ran out of memory rather than hitting a code problem. Ninja
> fans out one C++ job per core across four ABIs, which a loaded machine will
> not survive. Build one architecture at a time instead:
>
> ```bash
> cd android && gradlew assembleRelease --max-workers=2 -PreactNativeArchitectures=arm64-v8a
> ```
>
> `arm64-v8a` covers every phone made in the last several years. Debug builds
> compile the same code with lighter optimisation and are not affected.

> **Release builds are signed with the debug keystore.** That is fine for
> sideloading onto your own phone, but you must generate a real keystore and
> point `signingConfigs.release` in [`android/app/build.gradle`](android/app/build.gradle)
> at it before publishing anywhere.

## Working with the native project

`android/` is committed and is edited by hand — permissions, the launcher icon,
the app label, Gradle config. **Do not run `expo prebuild`**; it regenerates the
folder from `app.json` and would overwrite your changes.

The consequence is that `app.json` no longer drives the native side. Fields like
`android.package`, `icon` and `splash` were applied once at generation time;
changing them now does nothing on its own. Edit the native file instead:

| Change | File |
|---|---|
| App name | `android/app/src/main/res/values/strings.xml` |
| Package / version | `android/app/build.gradle` |
| Permissions, deep links | `android/app/src/main/AndroidManifest.xml` |
| Launcher icons | `android/app/src/main/res/mipmap-*/` |

The Expo SDK packages (`expo-audio`, `expo-haptics`, `expo-keep-awake`,
`expo-linear-gradient`) remain as ordinary autolinked npm dependencies — they
are native modules compiled into the APK like any other React Native library.

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

Phase palette: Prepare amber, Work electric violet, Rest green, Set Rest sky.
Work and rest sit ~110° apart on the wheel because that pair is the one read
from the corner of the eye mid-effort — they have to be unmistakable, not
merely different. Ink on top of an accent is not chosen by hand: `onAccent()`
in [`src/theme.ts`](src/theme.ts) picks black or white by relative luminance,
so the palette can move without quietly dropping text below contrast — white on
the old orange was only 2.9:1.
