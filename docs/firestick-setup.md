# Fire TV: alternatives and troubleshooting

The recommended way to show FlipSign on a Fire TV is the [FlipSign Fire TV app](../README.md#fire-tv-app). This page covers another option and what to do when something goes wrong.

## Alternative: Fully Kiosk Browser

If you'd rather not sideload the FlipSign app, a kiosk browser works too.

1. Install **Fully Kiosk Browser**: search for it in the Appstore, or sideload the APK from fully-kiosk.com with Downloader (see the Install steps in the README for allowing Downloader to install apps). Fully Kiosk's free mode shows a watermark when Plus features are used; Plus is a one-time licence, roughly $11 per device.
2. **Start URL:** `http://<server>:3000/` (the server's IP address; `.local` names often don't resolve on Fire TV).
3. **Settings to turn on** (names vary by version): keep screen on; launch on boot; fullscreen with system bars hidden; autoplay media without a user gesture; reload on connection loss.

The built-in Silk browser also opens the page, but shows browser bars and is too slow for a smooth flip animation.

## Troubleshooting

- **"Can't reach the FlipSign server"** in the app: check the server is running (`http://<server>:3000/healthz` should say `ok` in a phone browser on the same Wi-Fi), that the address in setup (≡ button) is right, and that the server's IP hasn't changed (reserve it in your router).
- **The board stutters.** Add `?debug` to the address in setup (e.g. `http://192.168.1.50:3000/?debug`) to show the frame rate. If the worst value while flipping is below about 30 FPS, lower the flip time in the control page's Settings tab. Please open an issue with your device model and the FPS you see.
- **The board doesn't come back after a power cut.** Start at boot needs the one-time permission described under "Start at boot" in the README; setup (≡) shows whether it is ready. Also check that "PIN Protect App Launches" is off in parental controls.
- **"Unable to Detect Your Remote" after a power cut.** Fire OS shows this over everything if no remote button has been pressed since it started. FlipSign is running underneath; press any button on the remote (or OK) to dismiss it.
- **It went back to Home after a few hours.** That is Fire OS's "Still watching?" check; turn it off under Settings → Preferences → Data Usage Monitoring.
- **No clack sound.** Turn on "Clacking sound" in the control page's Settings tab and check the TV volume.
