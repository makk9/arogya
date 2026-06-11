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
- 2026-06-09 (2) — **Doctor vertical COMPLETE** (committed `67c4f68`, 56 files) — API (`app/api/doctors/*`, `lib/schemas/{api,forms}/doctor.ts`, full `db/queries/doctor.ts`) + form + list grouped by **specialty** (case-insensitive, free text) + detail (avatar-in-card, masked phone per §6.5:1414, first-visit duration, derived last-visit, backlinks: meds prescribed / conditions managed / lab orders / visits) + `§ doctor:` pill. **Doctor-specific calls** (decisions.md 2026-06-09): change-logged = **specialty + clinic** only; new `ApiErrorCode delete_blocked` (409) for the `visits.doctor_id` restrict-FK; email omitted from form per 6.12 but on detail grid row 2 (deviation); `lib/doctor-display.ts` (`displayDoctorName` fixes the "Dr Dr." double-prefix repo-wide, `doctorInitials`, `maskPhone`).
- **Queued unlocks landed:** **E2** — shared `components/entity-list-sections.tsx` (sections-as-data; med/condition list components deleted, pages migrated). **D2** — condition/med detail doctor refs are live links; condition `diagnosedBy` inline-editable via new `select-doctor` variant (+ scope-check added to `conditionQueries.update`). **Pill fold** — `citation-pill.tsx` → one config-driven component (med/condition/doctor); med popover now shows **prescribing doctor** (by-slug joins it). **7.2 carryover closed** — med header emerald/amber → neutral tokens (repo has zero clinical color literals).
- **/check fixes:** delete scope-ordering (out-of-scope id → 404, never a 409 that leaks existence); `Object.hasOwn` replaces `key in GUIDANCE` in all 3 PATCH guards (prototype-chain keys).
- **Gotcha (recurring, now fixed):** Turbopack HMR re-instantiated `db/index.ts` per recompile and orphaned pooler connections → Supabase 15-client cap (`EMAXCONNSESSION`). Fix: `globalThis` client cache + `idle_timeout: 20`. If it recurs: kill stale `next dev`, wait ~20s.
- **Verified** full curl E2E on arogya-dev (create→group/render→PATCH allow/refuse→clinic change+History render→by-slug incl. honorific round-trip→med prescribedBy join→delete-blocked 409 w/ planted visit→delete 204→set-null on refs), ZZZ rows cleaned. `tsc`+`eslint` green.

### Next Steps
1. **Allergy** — smallest state vertical (fewest fields; `confirmed_by` doctor ref now linkable).
2. **Lifestyle / FamilyHistory** parallelize (Lifestyle singleton no-list; FamilyHistory no change-log, inline-edited, grouped by relation).
3. **Then Visit** — first event entity; NEW 6.6 timeline + 6.7 detail template (unproven). Un-stubs Doctor's derived last-visit + delete-blocked path.

### Open Questions / Blockers
- **Condition active→active re-confirm (v1.5):** no-op status guard (409) also blocks re-confirming the *same* status with a fresh reason/date. Accepted for v1; decisions.md 2026-06-02.
- **Pending doc-fixes (next design.md edit):** (§9.6:2803) form date *defaults* are now browser-local (`todayLocal()`), not patient-tz — user decision 2026-06-10; (§6.5) permit Notes omission when empty + broaden "Edit toggles Current fields" to all non-clinical (clinical → +Log a change); (§6.2/§6.4) floating Ask AI = context-preserving push drawer (non-modal), NOT full-screen — rail "Chat" + chat persistence remain Phase D (no chat-session table v1).
- **Chat-surface deferred:** (D2) §6.2 grounding header + per-message `grounded in →` footer; (D3) §6.2:1197 router-on-every-input not wired (drawer synthesis-only) — add before `runSynthesis` in **Phase E**; (E3) `surfaceContext` is client-asserted free text (prompt-injection surface) — resolve server-side from an entity id when auth is real.
- **Citation-pill limitations (v1.5):** collision-suffixed citations (`med:x-2`/`condition:x-2`/`doctor:x-2`) resolve to null → misleading "not in record".
- **Phase D carryovers (non-blocking):** **doctor pickers on Add forms** (§6.12 rich autocomplete + `+ Create new` inline modal for med `prescribingDoctor`/`purpose` + condition `diagnosedBy`/`managingDoctor`) still deferred — every ref IS settable post-create (log-change dialogs / inline select); **list-card entity refs stay inert text** (cards are whole-card anchors; §6.4:1348 wants embedded links — needs a card-restructure pass); Older: enum-validation → `lib/schemas/url-filters.ts`; `useId()` panel IDs; drawer `32rem` magic-number; `chat-drawer-provider` does 4 jobs; **periwinkle dark-mode (v1.5)** no `.dark`; **SDK** `@ai-sdk/anthropic` 3.0.x missing top-level `cacheReadInputTokens`.

---
*Keep this file under 80 lines. Last Session and Next Steps replace on each `/handoff` — never append.*
