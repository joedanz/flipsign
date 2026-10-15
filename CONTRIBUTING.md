# Contributing

Thanks for helping out! Bug reports, fixes and small features are all welcome.

## Setup

```bash
nvm use            # Node 22+ (see .nvmrc)
npm install
npm test           # unit + API tests (Vitest)
npm run typecheck
npm start          # http://localhost:3000 (display at /, control at /control/)
```

For the Fire TV app, see [firetv/README.md](firetv/README.md) (JDK 17 + Android SDK; `cd firetv && ./gradlew assembleDebug lint`).

For front-end work, `npm run dev:web` serves the pages with hot reload, alongside `npm run dev:server`.

## Pull requests

- Add or update a test for any behavior change. Write the test first and watch it fail.
- Keep `npm run typecheck`, `npm test` and `npm run build` green, and `./gradlew assembleDebug lint` in `firetv/` if you touched the app; CI runs them all.
- Keep changes focused. Match the style of the surrounding code.
- UI changes: include a screenshot, and check the control page at phone width.

## Ideas that would be especially welcome

- Run-at-boot scripts for Linux (systemd) and Windows. Only macOS launchd is provided today.
- More screens (calendar, transit, sports scores).
- Authentication (an optional PIN) for people who want to expose the control page more widely.
