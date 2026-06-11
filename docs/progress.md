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
- [x] Condition — **COMPLETE** (API · form · list · detail · inline-edit · +Log a change · Delete · live `§ condition:` pill). 2nd proof the state template generalizes. Detail shipped `0f34d25`.
- [x] Doctor — **COMPLETE** (API · form · list grouped by specialty · detail w/ backlinks · +Log a change [specialty/clinic] · Delete [409 when visits exist] · live `§ doctor:` pill). E2 + D2 unlocks landed with it (see Last Session).
- [x] Allergy — **COMPLETE** (API · form · list grouped by status · detail · +Log a change [status/severity] · Delete · live `§ allergy:` pill). 4th proof; thin-spec calls in decisions.md 2026-06-10 (NOT a rail item — list is §6.10 profile-reached; no Linked context until Phase E insights).
- [x] Lifestyle — **COMPLETE** (singleton: GET/PATCH-upsert `/api/lifestyle` + `/changes` · NO list/new/Add-form · §6.5:1403 narrative blocks + 4-col strip · 7 trend fields change-logged, first-population-via-PATCH then locked · live `§ lifestyle:profile` pill). **UNCOMMITTED — pending review.**
- [x] FamilyHistory — **COMPLETE** (API · form · list grouped by relation [CHILDREN bucket added] · detail [NO History; name-match Linked context; H1=condition] · all-fields inline edit · Delete · live `§ family-history:` pill). **UNCOMMITTED — pending review.** State-entity column DONE.

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
- 2026-06-10 (3) — **Lifestyle + FamilyHistory verticals COMPLETE — state-entity column done. ⚠️ UNCOMMITTED, pending user review** (~30 new files: `app/api/{lifestyle,family-history}/*`, full `db/queries/{lifestyle,family-history}.ts`, `lib/schemas/{api,forms}/*`, 11 `components/family-history/*` + 11 `components/lifestyle/*`, 4 pages, pill + surface-context edits). Both cloned off Allergy as template *variations*.
- **Key calls (decisions.md 2026-06-10 Lifestyle+FH entry):** §6.12 has NO Add-lifestyle form (spec gap) → **PATCH-upsert + first-population rule**: trend fields (7 §4:538 axes: 3 patterns + 4 enums) PATCH-able while null, locked after → `+ Log a change`; companions (dietRestrictions/stressContext/notes) always PATCH-able; first population logs NO change row; **no-op changes 409 on all 7 fields**; pattern dialog textareas prefill current text; no `…` menu (no delete story); intensity sub-line in Exercise block (strip locked at 4 cols). FH: H1=conditionName + relation pill; everything inline-editable (no change log → no History section, no refusal map; new `number` InlineField variant); CHILDREN bucket expanded (spec omits `child`); Linked context = render-time name match vs patient conditions, omitted when empty; bySlug reuses serializer's compound `familyHistorySlug()`.
- **Verified:** `tsc`+`eslint` clean; **30-case curl E2E** (FH 16 + Lifestyle 14: upsert/lock/idempotent/companions/no-op-409/post-change-lock/by-slug/year-as-age-400); **30-step `/verify-ui` walkthrough green** (one ❌ was a test-selector bug, re-probed green) + both empty states probed post-cleanup. Console silent. Test rows cleaned (FH via API, lifestyle via SQL — no delete API by design).
- **`/check` ran, user-reviewed; 3 fixes applied + re-verified** (FH linked-context ≥3-char match guard; FH form age ≤130 client refine; lifestyle lock error de-API-ified per 7.1). No blockers. **Found stale `ZZZ`/`ZZZ-smoke` conditions from EARLIER sessions in arogya-dev** (prior handoffs said cleaned) — left in place, awaiting user OK to delete.

### Next Steps
1. **USER REVIEW + commit** of the Lifestyle/FamilyHistory work (explicitly uncommitted on request).
2. **Then Visit** — first event entity; NEW 6.6 timeline + 6.7 detail template (unproven). Un-stubs Doctor's derived last-visit + delete-blocked path.
3. After Visit: Lab/Symptom/Report/Journal/VitalReading parallelize, then Patient profile (6.10 — gives the Allergies list + Lifestyle page their spec'd entry links) + Insights surfaces (6.8/6.9, placeholder data).

### Open Questions / Blockers
- **Condition active→active re-confirm (v1.5):** no-op status guard (409) also blocks re-confirming the *same* status with a fresh reason/date. Accepted for v1; decisions.md 2026-06-02.
- **Pending doc-fixes (next design.md edit):** (§6.12:1842 + §4:243) form date *defaults* are now browser-local (`todayLocal()`), not patient-tz — user decision 2026-06-10 (§9.6's "display in user's local tz" already agrees); (§6.5) permit Notes omission when empty + broaden "Edit toggles Current fields" to all non-clinical (clinical → +Log a change); (§6.2/§6.4) floating Ask AI = context-preserving push drawer (non-modal), NOT full-screen — rail "Chat" + chat persistence remain Phase D (no chat-session table v1).
- **Chat-surface deferred:** (D2) §6.2 grounding header + per-message `grounded in →` footer; (D3) §6.2:1197 router-on-every-input not wired (drawer synthesis-only) — add before `runSynthesis` in **Phase E**; (E3) `surfaceContext` is client-asserted free text (prompt-injection surface) — resolve server-side from an entity id when auth is real.
- **Citation-pill limitations (v1.5):** collision-suffixed citations (`med:x-2`/`condition:x-2`/`doctor:x-2`/`allergy:x-2`) resolve to null → misleading "not in record".
- **Allergy detail Linked context** intentionally absent until the Phase E insight generator produces med↔allergy interactions (§6.5:1402 has no stored edge behind it). Pending doc-fix candidates: §6.5:1402 "substance prominent" (substance is the H1) + a §6.4 note that the Allergies list isn't rail-reached + a §6.12 note on the missing Add-lifestyle form (first-population-via-PATCH fills the gap until onboarding) + §6.4:1336 FH CHILDREN bucket.
- **Phase D carryovers (non-blocking):** **Lifestyle v1.5:** real tags input for dietRestrictions (comma-split text for now); change-log dietRestrictions if tag transitions prove meaningful; profile delete/reset path (none — by design). Also: **doctor pickers on Add forms** (§6.12 rich autocomplete + `+ Create new` inline modal for med `prescribingDoctor`/`purpose` + condition `diagnosedBy`/`managingDoctor`) still deferred — every ref IS settable post-create (log-change dialogs / inline select); **list-card entity refs stay inert text** (cards are whole-card anchors; §6.4:1348 wants embedded links — needs a card-restructure pass); Older: enum-validation → `lib/schemas/url-filters.ts`; `useId()` panel IDs; drawer `32rem` magic-number; `chat-drawer-provider` does 4 jobs; **periwinkle dark-mode (v1.5)** no `.dark`; **SDK** `@ai-sdk/anthropic` 3.0.x missing top-level `cacheReadInputTokens`.

---
*Keep this file under 80 lines. Last Session and Next Steps replace on each `/handoff` — never append.*
