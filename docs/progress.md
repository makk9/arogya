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
- [~] Condition — **API ✓ · form ✓ · list ✓** (commits 1241090, f08a98e); detail + inline-edit/change-log + `§ condition:` pill remain. 5-bucket status grouping; card shows linked meds/labs counts
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
- 2026-06-02 — **Condition form shipped (6.12)** — commit `1241090`. `lib/schemas/forms/condition.ts` (`.omit().extend()` off the API schema) + `condition-options.ts` + `condition-form.tsx` + `new/page.tsx`. Linked-doctor fields (`diagnosedBy`/`managingDoctor`) + `icdCode` deferred from the form (same posture as the Med form deferring prescribingDoctor/purpose). Severity/category use a `NOT_SET` sentinel → coerced to undefined → server stores null.
- 2026-06-02 — **Condition list page shipped (6.4)** — commit `f08a98e`. `conditions/page.tsx` (parallel fetch conditions+doctors+meds+labs, 5-bucket status grouping, category filter) + card (category-pill + status-pill + linked meds/labs counts) + 5-section collapse island + filter + empty state + `CONDITIONS_LIST_SURFACE`. Form's Save now lands on a real page.
- **Base UI Select gotcha:** `<SelectValue>` renders the *raw value* unless the `<Select>` root gets an `items` map — this is **Base UI, not Radix**. Fixed in the condition form + filter. **Med form + med filter have the same latent bug** (trigger shows `tablet`/`all` raw) — NOT yet fixed.
- **/check clean** — applied D1 (form field order: Diagnosed-on before Category per 6.12) + E1 (derive subtitle word from `STATUS_OPTIONS`, dropped a dup map). Both folded into `f08a98e`. Deferred: E2 (extract shared `EntityList`/`Section` at Doctor = 3rd copy) + D2 (card "managed by Dr X" stays inert text until Doctor detail exists).
- **Gotcha:** 2 pre-existing conditions in arogya-dev (`A`, `Knee Pain`, both active) — not this session's; left untouched (plus the 4 pre-existing meds).
- **Working tree: clean** — both commits landed; `tsc`+`eslint` green.

### Next Steps
1. **Condition item 4-5 — detail page (6.5) + inline-edit + `+ Log a change`.** Clone the Med detail. status/severity/managing-doctor route through `/changes`; notes inline via PATCH. Linked context: meds via `medications.purpose`, labs via `lab_results.linked_condition`. Collapse History only when changes>5.
2. **Wire `§ condition:` pill** — add a `condition` case in `components/citation-pill.tsx` (today only `med`); `by-slug` route + `bySlug` query already exist.
3. **Then Doctor** (list grouped by specialty) — and extract the shared `<EntityList>` (E2) when its list lands.

### Open Questions / Blockers
- **Condition active→active re-confirm (v1.5):** the no-op status guard (409) also blocks a doctor re-confirming the *same* status with a fresh reason/date. Accepted for v1 (rare); decisions.md 2026-06-02.
- **Pending doc-fixes (next design.md edit):** (§6.5) permit Notes omission when empty + broaden "Edit toggles Current fields" to all non-clinical (clinical → +Log a change); (§6.2/§6.4) floating Ask AI = context-preserving push drawer (non-modal), NOT full-screen — three-column rail "Chat" + chat persistence remain Phase D (no chat-session table v1).
- **Chat-surface deferred:** (D2) §6.2 grounding header + per-message `grounded in →` footer — land with Phase D rail "Chat"; (D3) §6.2:1197 router-on-every-input not wired (drawer synthesis-only) — add before `runSynthesis` in **Phase E**; (E3) `surfaceContext` is client-asserted free text (prompt-injection surface, immaterial in single-user v1) — resolve server-side from an entity id when auth is real.
- **Item 7 limitations (v1.5):** (a) collision-suffixed citations (`med:x-2`) resolve to null → misleading "not in record"; (b) med popover preview omits **prescribing doctor** (the demo's cross-doctor field) — add when the Doctor picker/join lands.
- **Phase D carryovers + polish (non-blocking):** **Base UI Select `items` bug** — med form + med filter still show raw values (fix when next touching med surfaces); **E2** extract a shared data-driven `<EntityList>`/`Section` from `medications-list`+`conditions-list` when Doctor (3rd copy) lands; **D2** card entity refs ("managed by Dr X") become real links once Doctor detail exists. Older: enum-validation → `lib/schemas/url-filters.ts`; `useId()` panel IDs; drawer `32rem` magic-number → CSS var; `chat-drawer-provider` does 4 jobs. **Periwinkle dark-mode (v1.5)** no `.dark` toggle. **SDK:** `@ai-sdk/anthropic` 3.0.x missing top-level `cacheReadInputTokens`; smoke reads snake_case.

---
*Keep this file under 80 lines. Last Session and Next Steps replace on each `/handoff` — never append.*
