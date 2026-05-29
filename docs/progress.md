# arogya — Session Context

> Loaded automatically at every session start. Update with `/handoff` before ending a session.
> Full decision log: `docs/decisions.md`

---

## Current Phase: Phase C item 5 done — item 6 next

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
- [x] 1. Medication API routes — `app/api/medications/{route,[id]/route,[id]/discontinue/route}.ts` + `lib/schemas/api/medication.ts`. Path-less routes (auth-derived patientId), PATCH refuses clinical fields with per-field details, transactional discontinue with timezone-aware date, `invalid_state_transition` (409) error code added.
- [x] 2. Medication form — shadcn/ui init (base-nova, stone base), `components/medications/medication-form.tsx`, `lib/schemas/forms/medication.ts` derived from API schema via `.extend()`. Stone-only palette (accent deferred to checkpoint 1).
- [x] 3. Medications list page — state list template per 6.4. Server page (parallel fetch + Map denormalization), client islands for filters + section-collapse, RSC card + empty-state, inert Ask AI placeholder. Hybrid filter state (URL params + useState). PAUSED group between ACTIVE/DISCONTINUED.
- [x] 4. Medication detail page — state entity detail template per 6.5. Server `app/patient/[id]/medications/[medicationId]/page.tsx` (5-way parallel fetch + Map denormalization + narrow lookups + server-prerendered entry arrays); 8 components (detail-header, current-section, history-section client island, change-entry, linked-context, notes-section, actions-menu, discontinue-dialog); `medicationChangeQueries.forMedication` (patient-scoped); 3 datetime helpers (`formatAbsoluteDate`, `formatRelative`, `formatRelativeAndAbsolute`); shadcn `dropdown-menu`. Locked refinements: collapse only when `changes > 5`; `…` menu omitted when status=discontinued; Notes omitted when empty; 409→OK→router.refresh. /check polish landed (D1, E1-E6).
- [x] 5. Inline editing + change-log entry creation — `POST /api/medications/[id]/changes` route + transactional `medicationChangeQueries.create` (mirrors discontinue's pattern, throws `MedicationDomainError` for `medication_discontinued`/`invalid_status_transition`/`linked_entity_invalid`); `createMedicationChangeSchema` (discriminated union) + `medicationChangeFormSchema`; 6 new components (`medication-detail-shell`, `medication-log-change-dialog`, `inline-field`, `medication-edit-context`, `medication-log-change-context`, `medication-options`); 3 modified sections converted to client (`detail-header`, `current-section`, `notes-section`); History section gets `+ Log a change` button; `changedAt` coerced to noon UTC. Smoke green (13 curl cases). /check polish landed (D2 layout, E2 empty row, E6 decisions log, E7 S22 split).
- [ ] 6. Floating Ask AI button on Medication pages
- [ ] 7. Citation pill rendering for `§ med:amlodipine` (builds on Phase B citation parser)

### Phase D — Replicate Pattern (after C)
Other state entities · All event entities · Patient profile · Insights feed (placeholder)

### Phase E — AI-Driven Flows (after D)
Extraction agent + upload pipeline + confirmation surface · Onboarding (agent + surface) · Insight generator · Auto-titling · Doctor brief

### Phase F — Polish

---

### Last Session
- 2026-05-29 — **Phase C item 5 shipped.** Inline editing + change-log entry creation end-to-end. 6 new components, 3 modified sections converted to client, 1 new API route, 1 new query helper, 3 new error kinds on `MedicationDomainError`. Smoke green (13 curl cases: dose / frequency / status / prescribing_doctor happy paths + 4 error paths + backdating + tiebreaker sort). Typecheck + lint clean.
- 2026-05-29 — **Two-affordance UX (Edit vs. + Log a change) ratified.** Live dogfood raised the unification question; rejected per the demo-moment reasoning — change-log rows need reason / changedAt / linkedVisitId that inline blur can't capture. Decisions.md 2026-05-29 records the choice + alternatives.
- 2026-05-29 — **Three forward UX punts queued.** (a) Reactive delete on history rows (typo recovery — only most-recent row per field deletable); (b) clickable clinical cards opening the dialog with field preselected; (c) paused → active resume (already locked v1.5). None block the demo moment.
- 2026-05-29 — **Infra fixes alongside item 5.** `db/index.ts` cap (`max: 3`) to fit Supabase session pooler's 15-client cap under Turbopack multi-worker dev; `medicationChangeQueries.{forPatient,forMedication}` get a `desc(createdAt)` tiebreaker so same-day rows sort by insert order; `/check` D2 fix anchors Edit + actions to the H1 row inside the header (not floating above breadcrumb), naturally resolves E2 empty-row visual bug.
- **Gotcha — `changedAt` coercion is noon UTC, not noon-in-patient-tz.** For a Pune patient that's 5:30 PM IST on the chosen calendar day — safe from day flips, but technically off by a few hours from clinical-day-noon. A `noonInTimezone(dateStr, tz)` helper is queued for the next `lib/datetime.ts` revisit.
- **Gotcha — `db/index.ts` `max: 3` applies in production too.** Vercel's serverless model makes 3 fine per invocation, but if production throughput tunes are needed later, switch DATABASE_URL to the transaction pooler (port 6543) or make `max` env-driven.
- **Working tree status:** Uncommitted. Item 5 ready to land. Suggested commit title: `Phase C.5 — Inline editing + change-log entry creation`. Last commit on branch: `2c22a2f` (C.4).

### Next Steps
1. **Commit Phase C item 5.** 7 new files (`medication-detail-shell`, `medication-log-change-dialog`, `inline-field`, `medication-edit-context`, `medication-log-change-context`, `medication-options`, `changes/route.ts`) + 11 modified + `scripts/smoke-medication-changes.ts` + `docs/test-scenarios/medication-inline-edit-and-change-log.md` + `.claude/commands/test-scenarios.md`.
2. **Phase C item 6 — Floating Ask AI surface context.** Wire `AskAiButton` (currently inert with `aria-disabled`) to open chat with surface-context tag pre-loaded per §5.3. Applies to both list + detail pages.
3. **Phase C item 7 — Citation pill popover.** Builds on Phase B citation parser. `§ med:slug` pills get a Popover showing entity preview + `View full →` link navigating to detail page. Reads `data-entity-type` / `data-slug` from the existing pill component. Wired to the medication read API.

### Open Questions / Blockers
- **Pending doc-fix to §6.5:** (a) spec should permit Notes section omission when empty (matches Linked Context's LifestyleProfile precedent); (b) §6.5:1419 currently says "Edit toggles in-place editing of Current-section fields" — should be broadened to "Edit toggles in-place editing of all non-clinical fields (Header name/brand/form/startedOn, Current section form/category, Notes); clinical fields route through + Log a change." Matches the §6.10 patient profile cross-section pattern. Apply both alongside the next non-trivial design.md edit.
- **Brand accent decision deferred to Phase C checkpoint 1** (post-items-3-4). See decisions.md 2026-05-20.
- **Item 3 polish backlog** (non-blocking; Phase D / polish): enum-validation extraction to `lib/schemas/url-filters.ts`, `useId()` for section panel IDs, spacer-hack comment, `1×` prefix clarification, filter-pill placement, empty-state copy restore once Phase E extraction ships.
- **API smoke doc follow-up:** capture Phase C items 1-2 curl sequences in `docs/api-smoke.md`.
- **Server-side error logging missing across all routes** (incl. `/api/chat`, `/discontinue`). Per 9.6:2845. Worth landing `lib/logger.ts` before item 5's write paths multiply failure modes.
- **SDK workaround:** `@ai-sdk/anthropic` 3.0.x missing `cacheReadInputTokens` at top level. Smoke script reads snake_case directly. Pending upstream fix.

---
*Keep this file under 80 lines. Last Session and Next Steps replace on each `/handoff` — never append.*
