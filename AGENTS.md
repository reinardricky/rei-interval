# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# The Android project is committed, not generated

`android/` is a hand-maintained native project. **Never run `expo prebuild`** —
it regenerates the folder from `app.json` and destroys hand edits.

`app.json` therefore does not drive the native build any more. Native changes
(app name, package, permissions, icons, Gradle config) go directly into the
files under `android/`.

The app is built and installed over a USB cable: `npm run android` for a debug
build, `npm run apk` for a release APK. There is no EAS/cloud build and no
Expo Go — the `expo-*` packages are ordinary autolinked native dependencies.
