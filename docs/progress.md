# arogya — Session Context

> Loaded automatically at every session start. Update with `/handoff` before ending a session.
> Full decision log: `docs/decisions.md`

---

## Current Phase: Phase C item 3 done — item 4 next

### Phase A (complete)
- [x] 1-7. Foundation shipped (see decisions.md 2026-05-11/12 entries).

### Phase B — Agent Infrastructure
- [x] 1. Vault context builder — `lib/agents/_shared/vault-context.ts`. `excludeBriefs` default-true, `includeInsights` mode, `surfaceContext`, deterministic `now` param.
- [x] 2. Per-entity serializers — 14 files in `lib/agents/_shared/serializers/` + `format.ts` + barrel.
- [x] 3. Agent error types — `lib/agents/_shared/errors.ts`. `AgentError` with discriminated `code`.
- [x] 4. Zod output schemas — `lib/agents/_shared/schemas.ts`. All agent outputs per 10.3.
- [x] 5. Synthesis agent — `lib/agents/synthesis.ts` + `app/api/chat/route.ts`. Opus 4.7, streaming, verbatim prompt, cache hit verified (3150 tokens), three-modes-from-prompt.
- [x] 6. Router — `lib/agents/router.ts` + `scripts/check-router.ts`. Haiku 4.5, direct SDK, no vault context, 3-bucket confidence. Smoke green (6/6 cases, ~1s latency per call).
- [x] 7. Citation parser — `lib/citations/{parse,remark-plugin}.ts` + `components/{citation-pill,ai-message}.tsx` + `scripts/check-citation-parser.ts`. react-markdown + custom remark plugin → inert pills with `data-*` attrs for Phase C handoff. Smoke green (10/10 cases incl. round-trip against `citationFor()`).

### Phase C — First Vertical Slice (Medication)
- [x] 1. Medication API routes — `app/api/medications/{route,[id]/route,[id]/discontinue/route}.ts` + `lib/schemas/api/medication.ts`. Path-less routes (auth-derived patientId), PATCH refuses clinical fields with per-field details, transactional discontinue with timezone-aware date, `invalid_state_transition` (409) error code added. 13/13 smoke green; /check fixes landed (enum drift, timezone, exhaustiveness, auth ordering).
- [x] 2. Medication form — shadcn/ui init (base-nova, stone base), `components/medications/medication-form.tsx`, `lib/schemas/forms/medication.ts` derived from API schema via `.extend()`, interim list page at `app/patient/[id]/medications/page.tsx`. Stone-only palette (sage/emerald/seafoam all read green; accent deferred to checkpoint 1).
- [x] 3. Medications list page — state list template per 6.4. Server page in `app/patient/[id]/medications/page.tsx` (parallel fetch + in-memory denormalization), client islands for filters and section-collapse (`components/medications/{medication-filters,medications-list}.tsx`), RSC card + empty-state (`components/medications/{medication-card,medication-empty-state}.tsx`), inert floating Ask AI placeholder (`components/ask-ai-button.tsx`). Hybrid filter state (URL params for status/category, useState for collapse). PAUSED group added between ACTIVE/DISCONTINUED. /check fixes landed: empty-state copy trimmed (Phase E extraction promise removed), Ask AI `aria-disabled` + visual demotion, title-vs-subtitle asymmetry comment, `D `→`Dr ` doctor prefix.
- [ ] 4. Medication detail page — state entity detail template per 6.5
- [ ] 5. Inline editing + change-log entry creation
- [ ] 6. Floating Ask AI button on Medication pages
- [ ] 7. Citation pill rendering for `§ med:amlodipine` (builds on Phase B citation parser)

### Phase D — Replicate Pattern (after C)
Other state entities · All event entities · Patient profile · Insights feed (placeholder)

### Phase E — AI-Driven Flows (after D)
Extraction agent + upload pipeline + confirmation surface · Onboarding (agent + surface) · Insight generator · Auto-titling · Doctor brief

### Phase F — Polish

---

### Last Session
- 2026-05-27 — **Phase C item 3 shipped.** Medications list page → full 6.4 template. Six files: server `app/patient/[id]/medications/page.tsx` (parallel meds+doctors+conditions fetch, in-memory Map denormalization, filter+group+count, three-branch render), client `medications-list.tsx` (section collapse via useState; sections with count 0 hide entirely), client `medication-filters.tsx` (URL params via router.replace + `scroll:false`), RSC `medication-card.tsx` (two-line layout, brand-name in parens, inert doctor/condition spans, TODO recent-change), RSC `medication-empty-state.tsx`, `ask-ai-button.tsx` (inert placeholder, `aria-disabled` + opacity-60).
- 2026-05-27 — **Plan decisions D1-D8.** Hybrid filter state (URL params for status/category, useState for collapse per 6.4 session-only). Card→detail link wired now (404 acceptable until item 4); doctor/condition spans inert until Phase D. PAUSED gets its own collapsed-by-default group between ACTIVE and DISCONTINUED. Recent-change indicator deferred. Specialists = distinct specialty values across active+paused doctors. Subtitle omits zero segments. `medication-card.tsx` extracted standalone to establish the per-entity card pattern Phase D replicates. See decisions.md 2026-05-27.
- 2026-05-27 — **`/check` → 4 fixes landed.** Empty-state copy trimmed (verbatim 6.4 advertised Phase E extraction; build sequencing inverted that). Ask AI `aria-disabled` + visual demotion (machine-readable inert signal without "coming soon" copy). Title-vs-subtitle count asymmetry documented inline. Doctor prefix `D `→`Dr `. Eight more concerns flagged for Phase D / polish pass (enum-validation extraction, `useId()` for section IDs, spacer-hack comment, `1×` spec clarification, filter-pill placement).
- **Gotcha — PAUSED/DISCONTINUED have no UI path yet.** Schema supports all three; DISCONTINUED only reachable via `POST /api/medications/[id]/discontinue` (curl until item 4 `…` menu); PAUSED has zero API path (PATCH refuses clinical fields per C.1). List page renders all three correctly when present, but visual verification of paused/discontinued needs curl + direct DB write. Active/Discontinued grouping + filter become user-visibly useful once item 4 ships the Discontinue UI.
- **Working tree status:** Uncommitted. Phase C item 3 code + /check fixes + this handoff ready to land in one commit. Typecheck + lint clean; user manually verified visual rendering. Last commit on branch: `b7dbbf1` (C.2).

### Next Steps
1. **Commit Phase C item 3** — six new/modified files. Suggested title: `Phase C.3 — Medications list page + /check fixes`.
2. **Phase C item 4 — Medication detail page** (state entity detail template per 6.5): five sections (Header → Current → History → Linked context → Notes), constrained ~720-800px width, prominent dose+frequency card, change-log history with `+ Show all N changes`, `…` menu (Discontinue/Delete). Discontinue hits existing endpoint — this is what makes the list page's ACTIVE/DISCONTINUED grouping useful in UI.
3. **Phase C item 5 — Inline editing + change-log writes.** Edit button toggles in-place Current section fields; `+ Log a change` writes a `medication_changes` row. PAUSED gets a UI path here. New API surface likely needed (`POST /api/medications/[id]/changes` or inline PATCH support for status).

### Open Questions / Blockers
- **Brand accent decision deferred to Phase C checkpoint 1** (post-items-3-4). See decisions.md 2026-05-20.
- **Item 3 polish backlog** (non-blocking; address during Phase D or polish): enum-validation extraction to `lib/schemas/url-filters.ts` (multiplies 5× in Phase D), `useId()` for section panel IDs, spacer-hack comment in page.tsx, design.md 6.4 `1×` prefix clarification, filter-pill placement (top-right inline vs own row), empty-state copy restore once Phase E extraction ships.
- **API smoke doc follow-up:** capture the Phase C item 1 + 2 curl sequences in `docs/api-smoke.md`.
- **Server-side error logging missing across all routes** (incl. `/api/chat`). Per 9.6:2845. Worth landing minimal `lib/logger.ts` before item 4 produces real failures.
- **SDK workaround:** `@ai-sdk/anthropic` 3.0.x missing `cacheReadInputTokens` at top level. Smoke script reads snake_case directly. Pending upstream fix.

---
*Keep this file under 80 lines. Last Session and Next Steps replace on each `/handoff` — never append.*
