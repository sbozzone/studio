---
name: verify
description: Build, launch, and drive this Next.js app in headless Chromium to verify changes at the browser surface.
---

# Verifying changes in this repo

Next.js 15 app. Routes: `/` (DinnerTime planner), `/dew-point` (dew point calculator).

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
  (used by `/dew-point`) — mock them with `page.route(...)` fulfilling the
  documented response shapes.
- Geolocation: grant via `newContext({ geolocation: {...}, permissions: ['geolocation'] })`.
  A context *without* the permission leaves the prompt unanswered forever
  (limbo), it does not auto-deny — emulate denial by overriding
  `navigator.geolocation.getCurrentPosition` in `addInitScript` to call the
  error callback with `{ code: 1 }`.
- Radix sliders: focus the `role=slider` thumb and use Home/End/arrow keys —
  more reliable than mouse drags.
- Don't `pkill -f "next start"` from a command whose own text contains that
  string — it kills your shell. Use `pkill -f next-server`.
