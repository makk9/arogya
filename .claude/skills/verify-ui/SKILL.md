---
name: verify-ui
description: Browser-verify an arogya vertical end-to-end — drive the real UI in headless Chromium (Playwright), assert on rendered DOM, screenshot, report. Use whenever asked to verify/test/walk through a vertical's UI or confirm a fix in the browser (e.g. "verify the Allergy UI"). ARGUMENTS = the entity/feature; if omitted, verify the most recently completed vertical per docs/progress.md.
---

# arogya UI verification

Verify the named entity/feature by driving `localhost:3000` in headless
Chromium — clicking and typing like a user, never just curling the API.
Report in the /verify format (Steps with ✅/❌/🔍, Findings, verdict).

## Setup (~30s when cached)

Chromium persists at `~/Library/Caches/ms-playwright/` (downloaded
2026-06-10). The npm package lives in a temp dir so project deps stay
untouched:

```bash
mkdir -p /tmp/arogya-verify && cd /tmp/arogya-verify
npm init -y && npm i playwright && npx playwright install chromium
```

Dev server: `npm run dev` from the repo root. If DB queries fail with
`EMAXCONNSESSION`: kill stale `next dev` processes, wait ~20s (Supabase
session pooler, 15-client cap). Patient id (stub auth):
`75794434-0bb6-4dd0-b1c7-c26b39a13f03`.

## Standard walkthrough per entity type

Before scripting, skim the entity's design.md sections (6.4/6.5/6.12 for
state entities; 6.6/6.7 for events) so assertions match the spec, not
assumptions.

**State entity** (Medication/Condition/Doctor/Allergy/…):
1. List: grouping + counts + subtitle, filter pill (narrows + sets URL
   param + survives refresh), empty/no-match states, card → detail nav.
2. Form: empty-submit shows inline errors (`aria-invalid`), dirty-cancel
   confirm dialog, `+ Save and add another` resets, Save redirects.
3. Detail: all §6.5 sections; Edit mode (right fields editable, change-
   logged fields locked with the hint), inline-edit commits on blur, bad
   input shows a field error; `+ Log a change` writes a History entry with
   strikethrough old → new + reason; select triggers show labels (never
   uuids/raw enum values).
4. Cross-entity: linked-context backlinks navigate; citation-pill popover
   resolves via by-slug; circled D/V glyphs; no "Dr Dr." doubling.
5. Delete via `…` menu: confirm copy, redirect, then assert FK behavior
   via the API (set-null refs / 409 delete_blocked).

**Event entity** (Visit/Lab/…): timeline grouping per §6.6, event detail
§6.7 (Outcomes, no History), plus form + cross-links as above.

Always probe (🔍) beyond the happy path: bogus URL params, invalid field
values, empty dialog submit, double-submit.

## Driver pattern

One sequential `verify.mjs` with a `step(mark, name, fn)` wrapper: logs
✅/❌/🔍 per step, continues on failure, screenshots failures. Setup data
that isn't the surface under test may be created via `fetch` to the API.

House rules:
- Throwaway rows are **`ZZZ`-prefixed**; delete them all at the end;
  never mutate the user's real rows.
- Capture `page.on("console", …)` errors/warnings and report them — a
  silent console is itself a check (controlled-Select, hydration).
- Copy screenshots to `~/Desktop/arogya-verify-shots/` and `open` it
  (`/tmp` is invisible in Finder).

## Selector gotchas (learned 2026-06-10, Doctor run)

- **Base UI Selects**: options render in a portal as `role="option"`;
  click the trigger, then `getByRole("option", { name })`. Assert the
  *trigger text* afterward to catch the raw-value-instead-of-label bug.
- **Inline-edit**: fields appear only after clicking `Edit`; commit is
  on blur — click elsewhere, `waitForTimeout(~1000)`, then `Done`.
- **RSC text**: server components emit `<!-- -->` markers that split text
  nodes — match on regex/partial text, not exact joined strings.
- **Existing user data shifts counts** — derive expected group counts
  from `GET /api/<entity>`, never hardcode (caused the one false ❌ in
  the first run).
