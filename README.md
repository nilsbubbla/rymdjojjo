# Rymdresan – From Earth to the Moon

A vertical arcade game for browsers and Android where Johannes and his nephews fly to the Moon.

## Play locally

Requirements: Node.js 20+.

```powershell
npm install
npm run dev
```

Open the address shown by Vite. The game scales automatically to the window but is designed for portrait.

## Controls

- Mobile/touch: hold and drag the rocket left or right.
- Keyboard: `A`/`D` or the left/right arrow keys.
- Paintball gun: middle button (Android) and spacebar (web).
- The pause button is in the top-right corner.

## Content

- Five smoothly transitioning altitude zones from low sky to lunar journey.
- Birds, propeller planes, hot air balloons, satellites and asteroids.
- Coin patterns plus shield, paintball, coin boost and time bubble power-ups.
- Four parallax layers, particles, window animations and adaptive speed.
- Moon landing with low-gravity jump and results screen.
- Globally saved high score.

## Production build for the web

```powershell
npm run build
npm run preview
```

The finished web files end up in `dist/`.

## Android

The Android project lives in `android/` and uses Capacitor. Current Capacitor requires JDK 21; on this computer it is available in Android Studio's `jbr`.

```powershell
npm run android:sync
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
Set-Location android
.\gradlew.bat assembleDebug
```

The APK ends up at:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Install it on a USB-connected device:

```powershell
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

If `adb install` gets stuck, the APK can be pushed and installed in two steps:

```powershell
adb push android/app/build/outputs/apk/debug/app-debug.apk /data/local/tmp/rymdjojjo-debug.apk
adb shell pm install -r /data/local/tmp/rymdjojjo-debug.apk
```

## Project structure

- `src/scenes/BootScene.ts` loading and generated textures.
- `src/scenes/MenuScene.ts` title, help and high score.
- `src/scenes/GameScene.ts` intro, flight loop, zones, power-ups and finale.
- `src/game/visuals.ts` original-drawn game objects and portrait composition.
- `src/game/AudioBus.ts` generated sound effects via Web Audio.
- `public/assets/` AI-created key assets bundled with the project.
- `PLAN.md` production and design plan.
- `artifacts/` verification images from Pixel 7 Pro.
- `server/` high score API and deployment files (see `server/README.md`).
