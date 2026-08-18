# Rymdresan – Från jorden till månen

Ett stående arkadspel för webbläsare och Android där Johannes och hans brorsöner flyger till månen.

## Spela lokalt

Krav: Node.js 20+.

```powershell
npm install
npm run dev
```

Öppna adressen som Vite visar. Spelet skalar automatiskt till fönstret men är designat för portrait.

## Kontroller

- Mobil/pekdon: håll och dra raketen åt vänster eller höger.
- Tangentbord: `A`/`D` eller vänster/höger.
- Paintball-pistol: Mittenknappen (android) och spacetangenten (web)
- Pausknappen finns uppe till höger.

## Innehåll

- Fem mjukt övergående höjdzoner från låg himmel till månfärd.
- Fåglar, propellerplan, luftballonger, satelliter och asteroider.
- Myntmönster samt sköld, paintball, myntboost och tidsbubbla.
- Fyra parallaxdjup, partiklar, fönsteranimationer och adaptiv fart.
- Månlandning med låggravitationhopp och resultatkort.
- Globalt sparad highscore.

## Produktionsbygge för webben

```powershell
npm run build
npm run preview
```

Färdiga webbfiler hamnar i `dist/`.

## Android

Androidprojektet finns i `android/` och använder Capacitor. Senaste Capacitor kräver JDK 21; på den här datorn finns det i Android Studios `jbr`.

```powershell
npm run android:sync
$env:JAVA_HOME='C:\Program Files\Android\Android Studio\jbr'
Set-Location android
.\gradlew.bat assembleDebug
```

APK:n hamnar i:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

Installera på en USB-ansluten enhet:

```powershell
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Om `adb install` fastnar kan APK:n skickas och installeras i två steg:

```powershell
adb push android/app/build/outputs/apk/debug/app-debug.apk /data/local/tmp/rymdjojjo-debug.apk
adb shell pm install -r /data/local/tmp/rymdjojjo-debug.apk
```

## Projektstruktur

- `src/scenes/BootScene.ts` laddning och genererade texturer.
- `src/scenes/MenuScene.ts` titel, hjälp och highscore.
- `src/scenes/GameScene.ts` intro, flygloop, zoner, powerups och final.
- `src/game/visuals.ts` originalritade spelobjekt och porträttkomposition.
- `src/game/AudioBus.ts` genererade ljudeffekter via Web Audio.
- `public/assets/` AI-skapade, projektbundna nyckelassets.
- `PLAN.md` produktions- och designplan.
- `artifacts/` verifieringsbilder från Pixel 7 Pro.
