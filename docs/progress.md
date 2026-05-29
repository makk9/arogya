# arogya — Session Context

> Loaded automatically at every session start. Update with `/handoff` before ending a session.
> Full decision log: `docs/decisions.md`

---

## Current Phase: Phase C item 4 done — item 5 next

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
- 2026-05-28 — **Phase C item 4 shipped.** Detail page + 8 components + 1 query helper + 3 datetime helpers + dropdown-menu primitive. Typecheck + lint clean; HTTP 200 detail, 404 on malformed/missing/wrong-patient, 409 wired on discontinue. See item 4 checklist for full file inventory.
- 2026-05-28 — **Plan decisions D1-D6 for item 4 scope.** No Edit button until item 5; `…` menu = Discontinue only (omitted entirely when status=discontinued); Linked Context renders visit refs from `medication_changes.linkedVisitId` rows (inert pills until Phase D, section omitted when empty); shadcn `dropdown-menu` added now to amortize Phase D; no synthetic creation row in `medication_changes` (audit log records changes, not row-creation); 409 path replaces Discontinue with OK→router.refresh. See decisions.md 2026-05-28.
- 2026-05-28 — **`/check` → 6 fixes landed.** D1 (spec deviation): change-entry rail now stacks `formatRelative` over `formatAbsoluteDate` per §6.5:1411. E1: dialog fetch wrapped in try/catch (voice-compliant network-error banner). E2: dialog schema derives from `discontinueMedicationSchema.shape.reason` so the contract stays single-sourced. E3: replaced `staleAt: string | null | ""` with discriminated `DialogState`. E4: `formatRelative` docblock notes future-input contract. E5-E6: trimmed component header prose; shortened 409 banner copy.
- **Gotcha — History stays empty until item 5 lands change-log writes.** Item 4 only renders rows; only `discontinue` writes them today. Dose/frequency/prescribing_doctor change-entry branches and the dose-inline-note + Linked Context derivations all depend on item 5 (or Drizzle Studio writes) to be visible naturally.
- **Working tree status:** Uncommitted. Phase C item 4 code + /check polish ready to land in one commit. Last commit on branch: `e585a01` (C.3).

### Next Steps
1. **Commit Phase C item 4** — 12 new files + 2 modified. Suggested title: `Phase C.4 — Medication detail page + /check polish`.
2. **Phase C item 5 — Inline editing + change-log writes.** Edit button toggles in-place Current-section fields (non-clinical PATCH exists); `+ Log a change` in History writes a `medication_changes` row. New `POST /api/medications/[id]/changes` route + form needed. PAUSED gets a UI path here (status transition via the change-log writer).
3. **Phase C item 6 — Floating Ask AI surface context.** Wire `AskAiButton` to open chat with surface-context tag pre-loaded per §5.3. Applies to both list + detail pages.

### Open Questions / Blockers
- **Pending doc-fix to §6.5:** spec should permit Notes section omission when empty (matches Linked Context's LifestyleProfile precedent). Apply alongside the next non-trivial design.md edit.
- **Brand accent decision deferred to Phase C checkpoint 1** (post-items-3-4). See decisions.md 2026-05-20.
- **Item 3 polish backlog** (non-blocking; Phase D / polish): enum-validation extraction to `lib/schemas/url-filters.ts`, `useId()` for section panel IDs, spacer-hack comment, `1×` prefix clarification, filter-pill placement, empty-state copy restore once Phase E extraction ships.
- **API smoke doc follow-up:** capture Phase C items 1-2 curl sequences in `docs/api-smoke.md`.
- **Server-side error logging missing across all routes** (incl. `/api/chat`, `/discontinue`). Per 9.6:2845. Worth landing `lib/logger.ts` before item 5's write paths multiply failure modes.
- **SDK workaround:** `@ai-sdk/anthropic` 3.0.x missing `cacheReadInputTokens` at top level. Smoke script reads snake_case directly. Pending upstream fix.

---
*Keep this file under 80 lines. Last Session and Next Steps replace on each `/handoff` — never append.*
