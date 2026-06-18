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
- [x] Lifestyle — **COMPLETE** (singleton: GET/PATCH-upsert `/api/lifestyle` + `/changes` · NO list/new/Add-form · §6.5:1403 narrative blocks + 4-col strip · 7 trend fields change-logged, first-population-via-PATCH then locked · live `§ lifestyle:profile` pill). Shipped `d1058ab`.
- [x] FamilyHistory — **COMPLETE** (API · form · list grouped by relation [CHILDREN bucket added] · detail [NO History; name-match Linked context; H1=condition] · all-fields inline edit · Delete · live `§ family-history:` pill). Shipped `d1058ab`. **State-entity column DONE.**

Event entities (6.6 + 6.7; no change logs):
- [x] Visit — **COMPLETE** (API · Log-visit form [9 fields, zero-doctors guard] · §6.6 month-grouped timeline [date-anchored cards · dotted separator · most-recent tint · ↑/≡/+ outcome badges · doctor filter · show-earlier at month boundary] · §6.7 detail [NOTES FROM VISIT w/ markdown bold · Outcomes from `linked_visit_id` backlinks · FK-linked-episode Linked context · full inline edit, no refusal map] · Delete w/ outcome-detach copy · live `§ visit:` pill). Event template PROVEN. **Committed to main.**
- [x] LabReport + LabResults — **COMPLETE** (API [nested create txn · `/results/[resultId]` correction PATCH] · Log-lab-report form w/ `useFieldArray` markers sub-form · §6.6 month-grouped timeline [marker-preview cards, flagged-first; `All report types ▾` filter; no most-recent tint] · §6.7 detail [Summary · read-only MARKERS table + `+ Log a correction` dialog · `⚠ N flagged` Outcomes → scroll-to-markers · monitored-conditions + previous-panels Linked context · report-level inline edit] · `△` SLIGHTLY HIGH/LOW/CRITICAL pills (critical→`destructive` red, high/low→new `--warning` amber) · Delete cascades markers · live `§ lab-report:` pill). First one→many split. **Committed to main.**
- [x] Symptom (Type + Episode) — **COMPLETE** (API [`/api/symptom-types/*` + `/api/symptom-episodes/*`; episode POST creates type inline in one txn] · Log-symptom form [`+ Create new` type · datetime-local · duration/severity/description/triggers/relief · single linked-vital select] · §6.6 **type-grouped** timeline [collapsible groups, active expanded; severity pills; `●` linked-vital pills; most-recent tint; per-group show-earlier] · §6.7 episode detail [EPISODE NOTES · "Captured at this episode" linked vitals · parent-link chip + nearby-episode Linked context · datetime/number inline-edit] · **NEW SymptomType state-detail page** `/symptoms/types/[id]` [status/condition/notes edit · episode stream] · live `§ symptom:` + `§ symptom-episode:` pills · **post-hoc vital link/unlink in episode Edit** · **'+ Log episode' from a type locks the symptom + returns there**). Inverted one→many. **Committed.**
- [x] Report — **COMPLETE** (API [`?reportType=` filter param matches Lab API] · `Log report` form [text-only; linked visit+doctor selects] · §6.6 month-grouped timeline w/ `All types ▾` enum filter [no tint, no badges] · §6.7 detail [`REPORT CONTENT` markdown body · Outcomes = meds/conditions via `source_report_id`, omit-when-empty · Linked context = linked visit · "from {doctor}" subtitle · full inline edit, scope-checked linked FKs] · Delete [outcomes detach via set-null] · live `§ report:` pill). **Source-file upload + PDF preview + `status` lifecycle DEFERRED to Phase E** (user-scoped); Outcomes data lands when extraction writes `source_report_id`. **Committed.**
- [x] JournalEntry — **COMPLETE** (API · `New entry` form [title opt · date · content · **mood** added] · §6.6 month timeline [no filter, no tint, "written by you", title-less cards show content preview] · §6.7 detail [`ENTRY` markdown · **NO Outcomes / NO Notes** · Linked context = `LINKED ENTITIES` resolved pills + `OTHER ENTRIES THIS MONTH` siblings · `(untitled)` fallback · full inline edit] · Delete · live `§ journal:` pill). `linked_entities` resolver built (covers all detail-page types; `vital`/unknown dropped) — **empty until Phase E AI-tagging**, proven via DB seed. **Event-template family DONE (5/5).** **Uncommitted — pending review.**
- [x] VitalReading — **COMPLETE** (create-only: `/api/vital-readings` POST/GET/DELETE + Log-reading form at `/vitals/new`; NO timeline/detail page; surfaces as `●` pills on episodes; `§ vital:` inert; entry point = Phase E; **DELETE scrubs the id from episodes' `linked_vital_ids`** so no dangling refs). Committed w/ Symptom.

Standalone surfaces:
- [ ] Patient profile — 6.10 (state-detail variation)
- [ ] Insights feed + detail — 6.8 + 6.9; placeholder data (generation is Phase E)

### Phase E — AI-Driven Flows (after D)
Extraction agent + upload pipeline + confirmation surface · Onboarding (agent + surface) · Insight generator · Auto-titling · Doctor brief

### Phase F — Polish

---

### Last Session
- 2026-06-17 — **Report vertical (committed) + JournalEntry vertical (uncommitted, pending review).** Both cloned the event template; **event-template family now complete (Visit · Labs · Symptom · Report · Journal, +Vitals create-only).**
- **Report:** API (`?reportType=` filter, Lab parity) · text-only `Log report` form · month timeline · detail (`REPORT CONTENT` · Outcomes via `source_report_id` omit-when-empty · linked-visit context · "from {doctor}") · `§ report:` pill. Source-file/PDF/`status` DEFERRED to Phase E. `/check` clean; flagged §6.7:1534-vs-§9.4:2571 contradiction (report-derived entities: Outcomes/meds+conditions vs Linked-context/all-7) → broaden `outcomesForReport` in Phase E. **Committed.**
- **Journal:** API · `New entry` form (mood added beyond §6.12) · month timeline (no filter/tint, "written by you", title-less previews) · detail (`ENTRY` markdown · NO Outcomes/Notes · `LINKED ENTITIES` + `OTHER ENTRIES THIS MONTH` · `(untitled)`) · `§ journal:` pill (12th config). **New piece:** `resolveLinkedEntities` (jsonb `{type,id}` → navigable pills, all detail-page types; `vital`/unknown dropped) — empty until Phase E AI-tagging, **proven via DB seed**. Pills inert on card (whole-card anchor), navigable on detail.
- **Flagged (decisions.md):** Journal slug is date-based (`journal:<date>`, serializer round-trip) not §6.7:1555's title-based — doc-fix candidate; mood beyond §6.12; linked-entity card pills inert (card-restructure carryover).
- **Verified:** both `tsc`/`eslint`/`citation-parser` clean; API curl smoke correct on real DB; `/verify-ui` Report 12✅·3🔍, Journal 14✅·2🔍, 0❌; consoles clean; all `ZZZ` swept.

### Next Steps
1. **Patient profile** (6.10, state-detail variation) + **Insights feed/detail** (6.8/6.9, placeholder data) — the two remaining standalone surfaces; they parallelize and **close Phase D**.
2. Commit the Journal vertical (event-template family complete) once reviewed.
3. Phase-E audits queued in decisions.md: vital chat-quick-log path; symptom↔condition dedup; broaden `outcomesForReport` to all 7 derived entities (§9.4); the journal `linked_entities` tagging path (onboarding/extraction/synthesis).

### Open Questions / Blockers
- **Condition active→active re-confirm (v1.5):** no-op status guard (409) also blocks re-confirming the *same* status with a fresh reason/date. Accepted for v1; decisions.md 2026-06-02.
- **Pending doc-fixes (next design.md edit):** (§6.12:1842 + §4:243) form date *defaults* are now browser-local (`todayLocal()`), not patient-tz — user decision 2026-06-10 (§9.6's "display in user's local tz" already agrees); (§6.5) permit Notes omission when empty + broaden "Edit toggles Current fields" to all non-clinical (clinical → +Log a change); (§6.2/§6.4) floating Ask AI = context-preserving push drawer (non-modal), NOT full-screen — rail "Chat" + chat persistence remain Phase D (no chat-session table v1); **(§6.7:1534 vs §9.4:2571/2573) Report-detail derived entities: §6.7 says Outcomes (meds+conditions), §9.4 says Linked context (all 7 `source_report_id` entities) — reconcile placement + breadth when extraction lands (decisions.md 2026-06-17 follow-up)**.
- **Chat-surface deferred:** (D2) §6.2 grounding header + per-message `grounded in →` footer; (D3) §6.2:1197 router-on-every-input not wired (drawer synthesis-only) — add before `runSynthesis` in **Phase E**; (E3) `surfaceContext` is client-asserted free text (prompt-injection surface) — resolve server-side from an entity id when auth is real.
- **Citation-pill limitations (v1.5):** collision-suffixed citations (`med:x-2`/…/`visit:<date>-2` for same-day visits) resolve to null → misleading "not in record".
- **Allergy detail Linked context** intentionally absent until the Phase E insight generator produces med↔allergy interactions (§6.5:1402 has no stored edge behind it). Pending doc-fix candidates: §6.5:1402 "substance prominent" (substance is the H1) + a §6.4 note that the Allergies list isn't rail-reached + a §6.12 note on the missing Add-lifestyle form (first-population-via-PATCH fills the gap until onboarding) + §6.4:1336 FH CHILDREN bucket.
- **Phase D carryovers (non-blocking):** **Lifestyle v1.5:** real tags input for dietRestrictions (comma-split text for now); change-log dietRestrictions if tag transitions prove meaningful; profile delete/reset path (none — by design). Also: **doctor pickers on Add forms** (§6.12 rich autocomplete + `+ Create new` inline modal for med `prescribingDoctor`/`purpose` + condition `diagnosedBy`/`managingDoctor`) still deferred — every ref IS settable post-create (log-change dialogs / inline select); **list-card entity refs stay inert text** (cards are whole-card anchors; §6.4:1348 wants embedded links, §6.6:1488 wants clickable visit badges — same card-restructure pass); lab outcome rows + linked-episode rows link-less (report outcome rows now link out — `View medication/condition →`); med change-entry "Linked:" annotation inert (med Linked-context section carries the link); Older: enum-validation → `lib/schemas/url-filters.ts`; `useId()` panel IDs; drawer `32rem` magic-number; `chat-drawer-provider` does 4 jobs; **periwinkle dark-mode (v1.5)** no `.dark`; **SDK** `@ai-sdk/anthropic` 3.0.x missing top-level `cacheReadInputTokens`.

*Keep this file under 80 lines. Last Session and Next Steps replace on each `/handoff` — never append.*
