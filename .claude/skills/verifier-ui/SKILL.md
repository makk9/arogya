---
name: verifier-ui
description: Drive the arogya UI in headless Chromium (Playwright) to verify a feature end-to-end — clicking, typing, asserting on rendered DOM, screenshotting. Use when asked to verify/test a vertical's UI, re-run the UI walkthrough, or confirm a fix works in the browser. First used for the Doctor vertical (2026-06-10); clone that flow for new entities.
---

# UI verification for arogya

## Setup (~30s when Chromium is cached)

Chromium persists at `~/Library/Caches/ms-playwright/` (~92 MB, already
downloaded). The npm package lives in a temp dir so the project's
package.json stays untouched:

```bash
mkdir -p /tmp/arogya-verify && cd /tmp/arogya-verify
npm init -y && npm i playwright          # fast if cached
npx playwright install chromium          # no-op if browser cache present
```

Dev server: `npm run dev` from the repo root → `localhost:3000`. If DB
queries fail with `EMAXCONNSESSION`, kill stale `next dev` processes and
wait ~20s (Supabase session pooler, 15-client cap).

Patient id (stub auth): `75794434-0bb6-4dd0-b1c7-c26b39a13f03`.

## Driver pattern

One `verify.mjs` (ESM, `import { chromium } from "playwright"`), sequential
steps with a `step(mark, name, fn)` wrapper that logs ✅/❌/🔍 per step,
continues on failure, and screenshots failures. Reference implementation:
the Doctor-vertical run (see decisions.md 2026-06-09/10 sessions) covered
list grouping/filter, form validation + cancel-confirm + save-and-add-
another, detail inline-edit + log-change dialog + history render, cross-
entity links, and delete with set-null assertions via the API afterward.

Conventions:
- **Throwaway rows are `ZZZ`-prefixed**, created via the API (`fetch` from
  the script) when they're setup rather than the surface under test.
  Delete them all at the end; never mutate the user's real rows.
- Collect browser console errors via `page.on("console", …)` and report
  them — a silent console is itself a check (controlled-Select warnings,
  hydration mismatches).
- Screenshots → copy to `~/Desktop/arogya-verify-shots/` and `open` it
  (`/tmp` is invisible in Finder).
- Report in the /verify format: Steps with ✅/🔍, at least one 🔍 probe
  (empty submit, invalid email, bogus URL param, dirty-cancel), Findings.

## Selector gotchas (learned the hard way)

- **Base UI Selects**: trigger is a `combobox`/button; options render in a
  portal as `role="option"`. Click trigger → `getByRole("option", { name })`.
  Assert the *trigger text* to catch the raw-value-instead-of-label bug.
- **Inline-edit fields** appear only after clicking the `Edit` button;
  commit on blur — click another element (e.g. the "Current" heading),
  then `waitForTimeout(~1000)` before asserting, and click `Done`.
- **Dialogs** are AlertDialogs in portals; scope Save/Cancel by exact name.
- **RSC text assertions**: server components emit `<!-- -->` markers that
  split text nodes — assert on regex/partial text or strip tags first;
  `getByText("Cardiology · 2")` style assertions can miss.
- **Existing user data shifts counts** — derive expected group counts from
  `GET /api/<entity>` instead of hardcoding (a "failure" in the first run
  was a wrong hardcoded count, not a bug).
