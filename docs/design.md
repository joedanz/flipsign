# FlipSign — Design Spec

> Design notes from the initial build. Since then the display draws two blank margin rows above and below the 6×22 grid (`MARGIN_ROWS`) to fill a 16:9 screen, and the control page uses bottom tabs.

**Date:** 2026-10-14
**Status:** Approved in brainstorming, pending written-spec review

## 1. Goal

A Vestaboard-style split-flap display for a home TV. The board rotates through
useful screens (clock, weather, quotes) on its own, and can be overridden from a
phone at any time.

**Success looks like:** the TV shows a convincing 6×22 split-flap board with smooth
flips and clacking sound, it runs unattended for weeks, and sending a message from
a phone takes a few seconds.

**Audience:** personal/home use by one household. No accounts, no multi-tenancy.

## 2. Hardware and network (decided by spikes)

| Role | Device |
|---|---|
| Display | **Fire TV Stick 4K (2nd gen, model M3N6RA / AFTKM)** on the Samsung TV, running **Fully Kiosk Browser** |
| Server | **Mac mini** on the home network (not attached to the TV) |
| Remote control | Any phone/laptop on home Wi-Fi or Tailscale |

**Spike findings (2026-10-13/14):**
- Samsung Tizen built-in browser: poor animation performance and persistent browser chrome → rejected.
- Fire Stick 4K + Silk with a **DOM/CSS** renderer: only "instant" mode was smooth → rejected.
- Fire Stick 4K + Silk with a **single-canvas** renderer: **40 FPS worst case** with all 132 tiles flipping at full 1920×960 resolution; 60 FPS idle; ≤12 ms worst draw → **accepted**.
- Therefore the renderer **must** be canvas-based (see §5).

Security: no auth. The server is reachable only from the LAN and the Tailscale tailnet.

## 3. Architecture

**Smart server, thin display.** The server owns all logic and computes the exact
6×22 grid; the display only animates from its current grid to the next one.

```
phone (control page) ──HTTP JSON──▶ ┌──────────── Mac mini: Node 22+ + Hono ───────────┐
                                    │ api → store (data/state.json)                       │
                                    │        ↓                                           │
                                    │     scheduler ← screens (clock/weather/quote)      │
                                    │        ↓                 ↑                          │
                                    │   /events (SSE)     weather (Open-Meteo, cached)   │
                                    └────────┬───────────────────────────────────────────┘
                                             ▼
                        Fire Stick (Fully Kiosk) display page  +  control page live preview
```

### Stack
- Node 22+, TypeScript, **Hono** HTTP server (`@hono/node-server`).
- **Vite** builds the display and control pages to static files served by Hono.
- **Vitest** for tests.
- No database: a single JSON file.

### Repository layout
```
src/
  shared/board/     charset, Grid type, layout (wrap/center/{color} parsing) — used by server AND both pages
  server/
    screens/        clock.ts, weather.ts, quote.ts — pure: inputs → Grid
    weather/        Open-Meteo geocode + forecast, 15-min cache, fallback
    scheduler/      override vs rotation, expiry, clock minute ticks
    store/          load/save data/state.json (atomic temp-file + rename)
    api/            JSON routes + /events SSE
    index.ts
  display/          canvas renderer, SSE client, sound
  control/          phone control page
data/state.json     (gitignored runtime state)
deploy/             launchd plist, install script
docs/               this spec, Fire Stick setup guide
```

## 4. Board model and screens

### Grid
- 6 rows × 22 columns. A cell is one of:
  - space, `A–Z`, `0–9`, `! @ # $ ( ) - + & = ; : ' " % , . / ? °`
  - color tiles: `red orange yellow green blue violet white`
- Charset order (used for flip sequencing): space, A–Z, 1–9, 0, punctuation as above, then colors.
- Only cells that differ between grids flip.

### Text layout (shared module)
- Input is a string; `{red}`, `{orange}`, `{yellow}`, `{green}`, `{blue}`, `{violet}`, `{white}` tokens become color tiles. Unknown `{…}` tokens are removed.
- Uppercase everything; characters outside the charset are removed.
- Explicit newlines force a line break.
- Word-wrap to 22 columns; a single word longer than 22 is hard-split.
- Center each line horizontally; center the block vertically.
- If the result exceeds 6 lines the layout returns an **overflow error** listing what did not fit (used by the control page warning and by API validation — over-length messages/quotes are rejected, never truncated silently).

### Screens

| Screen | Content | Refresh |
|---|---|---|
| **Clock** | Day of week, date (e.g. `OCT 14`), time (e.g. `9:42 AM`); 12/24h per settings | Re-rendered every minute while showing |
| **Weather** | Current temp + condition (`68° SUNNY`), today high/low, 3-day outlook row, one color-tile accent by condition (sun=yellow, cloud=white, rain=blue, snow=white, storm=violet) | Data fetched every 15 min, cached |
| **Quote** | Wrapped quote; attribution as final line (`- AUTHOR`) | New quote each time the screen comes up (shuffle without repeats until list exhausted) |
| **Message** | User text (from rotation messages) | Static |

Quotes: user list plus a bundled starter set of ~50 that fit 6×22; the starter set can be disabled as a whole.

### Weather source
- **Open-Meteo** (no API key). Location set as city or ZIP in settings → Open-Meteo geocoding API → lat/lon stored in state.
- Units °F/°C per settings.
- Failure handling: show last cached reading; if older than 2 h, append an age marker (e.g. `AS OF 2H AGO`); if no cached reading ever, **skip** the weather screen in rotation.
- If location is not configured, the weather screen shows `SET LOCATION IN CONTROL PAGE` until it is.

## 5. Scheduler and messages

### Priority
1. **Active override message** (until-cleared, or timed and not expired) → show it.
2. Otherwise → **rotation**.

When an override is cleared or expires, rotation resumes from where it left off.

### Message durations (all offered on send)
- `15 min`, `1 hr` (default), `4 hrs` → timed override with absolute `expiresAt`.
- `Until cleared` → override with no expiry.
- `Add to rotation` → not an override; appended to the rotation list as a message screen until deleted.

Sending a new override replaces any existing override.

### Rotation
- Default order: Clock → Weather → Quote → rotation messages (in added order).
- Each entry can be enabled/disabled and reordered; rotation messages can be deleted.
- Seconds-per-screen setting, default **60**.
- Screens that are unavailable (weather with no data ever) are skipped. If nothing is available, show Clock.

### Persistence
`data/state.json` holds settings, quotes, rotation list, active override (with `expiresAt`), cached weather + geocode. Written atomically (temp file + rename). A missing file starts from defaults; an unparseable file is renamed to `state.json.bak` and defaults are used. Overrides survive server restart with original expiry.

## 6. Display (Fire Stick page)

- URL `http://<mini>:3000/` — Fully Kiosk start URL.
- Full-screen board only; no UI chrome. `?debug` shows FPS/draw-time overlay.
- **Canvas renderer** (from spike #2):
  - One `<canvas>`, `alpha:false`, sized to viewport × devicePixelRatio.
  - Glyph atlas: every charset entry pre-rendered once (top half/bottom half) into an offscreen canvas; rebuilt on resize.
  - Flip animation: falling top flap / rising bottom flap drawn by vertical scaling by `cos(angle)` with a darkening overlay; hinge line per tile.
  - Single `requestAnimationFrame` loop; only flipping tiles are redrawn. Idle board draws nothing.
  - Tiles step forward through the charset to their target; staggered start (left-to-right sweep with small random jitter).
- **Look:** Vestaboard Flagship — near-black board, charcoal tiles, white characters, tile aspect ~1:1.3, board ~95% of screen width.
- **Sound:** WebAudio-generated clack (no assets), throttled; on by default, toggled via settings. Fully Kiosk autoplay setting documented in setup guide.
- **Flip speed** setting (default 70 ms/step) and sound on/off arrive live via SSE.
- **Connection:** SSE `/events`; current grid sent on connect. On disconnect, keep last grid and retry every few seconds (EventSource reconnect); no on-screen error outside debug mode.
- Must run on the Fire Stick's Chromium 152 (Silk/Android WebView); no reliance on features newer than that.

## 7. Control page (phone)

- URL `http://<mini>:3000/control`; mobile-first; installable to home screen (web manifest).
- Sections:
  1. **Live preview** of the board (same renderer, static/instant mode) + status line (`Rotation: Weather · next in 0:42` / `Message · expires 3:15 PM`).
  2. **Compose:** textarea, live 6×22 preview, overflow warning, color-tile insert buttons, duration choice (15 min / 1 hr / 4 hrs / Until cleared / Add to rotation), Send.
  3. **Now showing:** Clear button when an override is active.
  4. **Rotation:** list with enable toggles, up/down reorder, delete for messages; seconds-per-screen.
  5. **Quotes:** add/remove own quotes; starter-set toggle. Over-length quotes rejected with the overflow message.
  6. **Settings:** location, °F/°C, 12/24h, sound on/off, flip speed.
- Subscribes to `/events` for live state.

### API (JSON)
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/state` | Settings, rotation, quotes, override, current grid + status |
| POST | `/api/message` | `{ text, duration: "15m"\|"1h"\|"4h"\|"forever"\|"rotation" }`; 422 on overflow |
| DELETE | `/api/override` | Clear active override |
| PUT | `/api/rotation` | Replace rotation order/enabled list |
| DELETE | `/api/rotation/:id` | Remove a rotation message |
| POST / DELETE | `/api/quotes`, `/api/quotes/:id` | Manage user quotes |
| PUT | `/api/settings` | Partial settings update; location change triggers geocode (422 if not found) |
| GET | `/events` | SSE: `grid` events (cells + flip settings) and `state` events |

All inputs validated (zod); invalid input → 400/422 with a human-readable message shown on the control page.

## 8. Deployment

- `npm run build` → `dist/`; `npm start` runs the server on `0.0.0.0:3000`.
- launchd agent `~/Library/LaunchAgents/local.flipsign.plist`: `RunAtLoad`, `KeepAlive`; logs to `~/Library/Logs/flipsign/`. `deploy/install.sh` installs/reloads it.
- `docs/firestick-setup.md`: install Downloader → Fully Kiosk; set start URL, keep screen on, start on boot, autoplay audio, hide system bars.

## 9. Testing

- **Unit (Vitest):** layout (wrap, center, hard-split, newlines, color tokens, overflow, charset filtering); each screen with fixed inputs; scheduler priority/expiry/resume with a fake clock; weather cache + fallback + skip; store atomic write and load of missing/corrupt file (falls back to defaults, keeps a `.bak`).
- **API:** route tests against an in-memory store via Hono's `app.request`.
- **Browser verification:** desktop Chrome — send from control page, display flips to it; clear returns to rotation.
- **Device acceptance:** Fire Stick + Fully Kiosk shows board full-screen, flips smoothly, plays sound, recovers after server restart and after stick reboot.

## 10. Out of scope (v1)

Calendar, quiet hours/night mode, multiple layouts per screen, authentication/PIN, cloud hosting, multiple boards with different content, Vestaboard API compatibility.
