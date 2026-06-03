# arogya — Session Context

> Loaded automatically at every session start. Update with `/handoff` before ending a session.
> Full decision log: `docs/decisions.md`

---

## Current Phase: Phase D — Replicate Pattern (active) · checkpoint 1 (brand accent) ✓ periwinkle locked

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

### Phase C — First Vertical Slice (Medication) ✓ COMPLETE — reference impl for Phase D
- [x] 1. API routes — `app/api/medications/*` + `lib/schemas/api/medication.ts` (path-less, auth-derived patientId; PATCH refuses clinical fields; transactional `/discontinue` + `/changes`; `/by-slug/[slug]` resolver matches `slugify(name)`, no stored slug).
- [x] 2-3. Form (`components/medications/medication-form.tsx`, RHF+Zod, 6.12; `lib/schemas/forms/medication.ts` via `.extend()`) + list page (6.4: server fetch + Map denormalization, client islands for filters/section-collapse).
- [x] 4-5. Detail page (6.5: 5 sections, parallel fetch, 8+ components; collapse only when changes>5, `…` omitted when discontinued, Notes omitted when empty) + inline-edit (`inline-field`, useState/onBlur) + `+ Log a change` (transactional change-log write).
- [x] 6. Ask AI push-drawer — `components/chat/*` + `app/patient/[id]/layout.tsx`; single persistent `useChat` thread across patient, non-modal/no-backdrop/push layout, `surfaceContext` rides each message; `lib/chat/surface-context.ts`.
- [x] 7. Citation-pill popover — `§ med:<slug>` → fetch-on-open preview (name·dose·freq·status) → `View full →`. Non-med + external pills inert (their detail pages are Phase D).

### Phase D — Replicate Pattern (active)
Reuse Phase C's Medication template. **State entities** → 6.4 list + 6.5 detail + 6.12 form + `*_changes` log (Medication is the reference impl). **Event entities** → NEW templates 6.6 timeline + 6.7 event detail (no change log; Outcomes replaces History; Lab markers read-only). Sequencing: do **Condition** first (proves the state template generalizes beyond Medication), then **Visit** first among events (proves the new event template), then the rest parallelize.
**Per-entity build order** (clone Medication files, don't re-derive): schema (`lib/schemas/api/*`) + `db/queries/*` → API routes (curl-smoke green) → form → list page → detail page → inline-edit + change-log. That's Phase C items 1→5. **Items 6-7 are now infra, NOT per-entity work:** the Ask AI drawer is global; citation pills just need a `bySlug` query + `/api/<entity>/by-slug/[slug]` route + a case in the pill resolver. **Shared infra exists (use it, don't re-clone):** `lib/api/route-helpers.ts` (`coerceChangedAt`/`parseJsonBody`/`validateUuidParam`/`fieldErrorsFromReason`), `db/queries/_shared.ts` (`*InScope` FK scope-checks), `lib/logger.ts` (log every server_error catch).

State entities (6.4 + 6.5 + `*_changes`):
- [~] Condition — **API layer ✓** (schema + 4 routes + queries + `conditions-api:check` 31/31); form/list/detail pages remain. status ACTIVE/CONTROLLED/IN_REMISSION/RESOLVED/SUSPECTED; linked meds + labs
- [ ] Doctor — list grouped by specialty (not status)
- [ ] Allergy — straightforward; fewest fields
- [ ] Lifestyle — singleton (no list page; single profile detail)
- [ ] FamilyHistory — NO change log; inline-edited; grouped by relation type

Event entities (6.6 + 6.7; no change logs):
- [ ] Visit — richest; glyph result badges; month-grouped timeline
- [ ] LabReport + LabResults — read-only MARKERS table + `+ Log a correction`
- [ ] Symptom (Type + Episode) — timeline grouped by type, not month
- [ ] Report — PDF preview; extracted-entity outcomes
- [ ] JournalEntry — no Outcomes/Notes sections
- [ ] VitalReading — routes + form only; NO timeline page (surfaces as `●` pills on episodes)

Standalone surfaces:
- [ ] Patient profile — 6.10 (state-detail variation)
- [ ] Insights feed + detail — 6.8 + 6.9; placeholder data (generation is Phase E)

### Phase E — AI-Driven Flows (after D)
Extraction agent + upload pipeline + confirmation surface · Onboarding (agent + surface) · Insight generator · Auto-titling · Doctor brief

### Phase F — Polish

---

### Last Session
- 2026-06-02 — **Phase D Condition API layer shipped** (first Phase D entity). `lib/schemas/api/condition.ts` + 4 routes (`app/api/conditions/{route,[id],[id]/changes,by-slug/[slug]}`) + grown `db/queries/condition.ts` (full helpers + `ConditionDomainError`). Two ratified divergences from the Med template: **notes inline via PATCH** (not change-logged — §6.5 omits it); **all status transitions via /changes, no `/resolve`** (5-state model, no terminal columns). `condition_changes` has **no linked_visit_id** → `linkedVisitId` dropped throughout. Smoke `npm run conditions-api:check` (self-seeds + cleans up), 31/31. decisions.md 2026-06-02.
- 2026-06-02 — **/check → all 7 engineering concerns fixed before moving on.** Landed **3 shared modules**, now the Phase-D baseline: `lib/logger.ts` (PHI-aware, type-signature guardrail — **resolves the long-open logging blocker**), `lib/api/route-helpers.ts` (`coerceChangedAt`/`parseJsonBody`/`validateUuidParam`/`fieldErrorsFromReason`), `db/queries/_shared.ts` (`*InScope` FK scope-checks). All condition **and** medication routes refactored onto them.
- 2026-06-02 — **#4 create scope-check (both entities):** create now validates FK targets in scope → mapped **400** (not FK-violation 500) + no cross-patient refs. **#2:** linked-entity errors unified on reason CODES (`doctor_not_found`/`no_op`/`condition_not_found`/`visit_not_found`) — med retrofitted from free-text. **#5:** Condition kind `invalid_status_transition`→`status_unchanged`. Med routes re-verified by curl battery — no regression; logger confirmed silent on 4xx, fires only on 500s.
- **Gotcha:** 4 pre-existing meds in arogya-dev (`Avi Makkena`/`Tylenol`/`Avi`/`Amlodipine`, May 19–31, Phase C test data) — NOT this session's; left untouched.
- **Working tree: UNCOMMITTED.** All Condition API + 3 shared modules + med-refactor + check script + docs. `tsc`+`eslint` clean.

### Next Steps
1. **Commit this session's work** (Condition API + shared infra + med refactor) — tree is uncommitted.
2. **Finish the Condition vertical** — form + list (5-bucket status grouping) + detail (linked meds via `medications.purpose`, labs via `lab_results.linked_condition`) + inline-edit/change-log = Phase C items 2-5 clone. Then wire `§ condition:` in the pill resolver (`by-slug` route already built).
3. **Then Doctor** (state entity; list grouped by specialty) on the now-shared route/query/logger infra.

### Open Questions / Blockers
- **Condition active→active re-confirm (v1.5):** the no-op status guard (409) also blocks a doctor re-confirming the *same* status with a fresh reason/date. Accepted for v1 (rare); decisions.md 2026-06-02.
- **Pending doc-fixes (next design.md edit):** (§6.5) permit Notes omission when empty + broaden "Edit toggles Current fields" to all non-clinical (clinical → +Log a change); (§6.2/§6.4) floating Ask AI = context-preserving push drawer (non-modal), NOT full-screen — three-column rail "Chat" + chat persistence remain Phase D (no chat-session table v1).
- **Chat-surface deferred:** (D2) §6.2 grounding header + per-message `grounded in →` footer — land with Phase D rail "Chat"; (D3) §6.2:1197 router-on-every-input not wired (drawer synthesis-only) — add before `runSynthesis` in **Phase E**; (E3) `surfaceContext` is client-asserted free text (prompt-injection surface, immaterial in single-user v1) — resolve server-side from an entity id when auth is real.
- **Item 7 limitations (v1.5):** (a) collision-suffixed citations (`med:x-2`) resolve to null → misleading "not in record"; (b) med popover preview omits **prescribing doctor** (the demo's cross-doctor field) — add when the Doctor picker/join lands.
- **Polish backlog (non-blocking):** enum-validation → `lib/schemas/url-filters.ts`; `useId()` for panel IDs; empty-state copy once Phase E ships; drawer width `32rem` magic-number in 2 files → CSS var; `chat-drawer-provider` does 4 jobs (extract `ChatConversation` for rail "Chat"). **Periwinkle dark-mode (v1.5):** derived, no `.dark` toggle wired. **SDK:** `@ai-sdk/anthropic` 3.0.x missing top-level `cacheReadInputTokens`; smoke reads snake_case.

---
*Keep this file under 80 lines. Last Session and Next Steps replace on each `/handoff` — never append.*
