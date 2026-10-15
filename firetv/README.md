# FlipSign for Fire TV

A tiny Android app (one screen, no third-party libraries) that shows the FlipSign display page full screen on a Fire TV Stick. To install and use it, see [Fire TV app in the main README](../README.md#fire-tv-app). This page is for building it.

What it does:

- Full-screen WebView of `http://<server>:3000/`, with JavaScript, local storage and sound allowed without a tap.
- Keeps the screen on, which also stops the Fire TV screensaver from covering the board.
- If the server can't be reached it says so and retries every 10 seconds. If the page's renderer ever crashes, it starts a fresh one.
- ≡ (Menu) opens setup (server address, start at boot). Back is ignored on the board so a stray press can't take the sign down.
- Starts itself when the Fire TV boots, once "display over other apps" has been granted (see the main README).

## Build

Needs JDK 17 and the Android SDK (platform 34, build-tools 34). Point Gradle at the SDK with `ANDROID_HOME` or a `local.properties` file containing `sdk.dir=/path/to/sdk`.

```bash
cd firetv
./gradlew assembleDebug lint      # app/build/outputs/apk/debug/app-debug.apk
adb connect <fire-tv-ip>          # Fire TV: Settings → My Fire TV → Developer options → ADB debugging
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

The app version follows `package.json` at the repo root, so one release tag covers the server and the app.

## Release signing

Release builds must always be signed with the same key, or users will have to uninstall before they can upgrade. The key lives outside the repo:

```bash
mkdir -p ~/.config/flipsign && chmod 700 ~/.config/flipsign
keytool -genkeypair -keystore ~/.config/flipsign/release.jks -storetype PKCS12 \
  -alias flipsign -keyalg RSA -keysize 4096 -validity 36500 -dname "CN=FlipSign"
cat > ~/.config/flipsign/keystore.properties <<'EOF'
storeFile=release.jks
storePassword=<password>
keyAlias=flipsign
keyPassword=<password>
EOF
chmod 600 ~/.config/flipsign/*
```

Back up both files somewhere safe. Use `FLIPSIGN_KEYSTORE_PROPERTIES=/path/to/keystore.properties` to keep them elsewhere.

Then `./release.sh` builds `dist/flipsign-firetv-<version>.apk` and prints its signing certificate and SHA-256. Attach that file to the GitHub release.

## Icons

`tools/make_icons.py` (Pillow) draws the 320×180 Fire TV banner and the launcher icons as split-flap tiles. The PNGs are committed, so you only need it to change the look.
