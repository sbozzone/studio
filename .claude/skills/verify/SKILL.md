---
name: verify
description: Build, launch, and drive this Next.js app in headless Chromium to verify changes at the browser surface.
---

# Verifying changes in this repo

Next.js 15 app. Routes: `/` (dew point calculator), `/dinnertime` (DinnerTime planner).

## Unit tests

`npm test` runs vitest (`src/**/*.test.ts`). The outlook composer has a
Plainfield regression fixture and snapshot in `src/lib/__tests__/`.

## Build & launch

```bash
npm run build            # required — `npm run start` serves the last build
npm run start &          # serves on http://localhost:3000
```

`npm run dev` uses turbopack and also works for quick iteration.

## Drive with Playwright

No Playwright in project deps — use the global install with the pre-installed browser:

```js
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
```

## Gotchas

- The sandbox proxy 403-blocks `api.open-meteo.com` and `api.bigdatacloud.net`
  (used by the dew point app at `/`) — mock them with `page.route(...)` fulfilling the
  documented response shapes.
- Geolocation: grant via `newContext({ geolocation: {...}, permissions: ['geolocation'] })`.
  A context *without* the permission leaves the prompt unanswered forever
  (limbo), it does not auto-deny — emulate denial by overriding
  `navigator.geolocation.getCurrentPosition` in `addInitScript` to call the
  error callback with `{ code: 1 }`.
- Radix sliders: focus the `role=slider` thumb and use Home/End/arrow keys —
  more reliable than mouse drags.
- `pkill -f <pattern>` kills your own shell when the pattern appears in the
  command line you're running (exit 144). Use a self-excluding pattern:
  `pkill -f "next[-]server"`.
