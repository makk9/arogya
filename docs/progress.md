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
- 2026-06-11/15 — **Visit vertical COMPLETE — first event entity; 6.6/6.7 template PROVEN. Committed to main** (~17 new files: `lib/schemas/{api,forms}/visit.ts`, full `db/queries/visit.ts` [outcomes/linkedEpisodes], `app/api/visits/*` ×3, 13 `components/visits/*`, 3 pages; edits: citation-pill [visit config], surface-context, doctor/med linked-context [queued `Link` wrappers landed], med detail, datetime, doctor card/current, design.md, docs).
- **Key calls (decisions.md Visit entry + addenda):** no change log → full PATCH surface, generic `select` InlineField variant; form = full Phase 4 set (9 fields), NOT §6.12's draft; badges = styled spans inside whole-card anchors (§6.6 "clickable" → nested-anchor; detail Outcomes rows carry link-outs); Outcomes/Linked-context omitted when empty (write path is entity-side: med dialog's visit picker); slug = serializer ISO date (not §6.7 `[date]-[summary]`); breadcrumb = date slug; no temporal-window episode queries (synthesis's job); zero-doctors guard on /visits/new; status pill on non-completed cards.
- **Unlocks now live:** doctor last-visit derivation + 409 delete_blocked; med-change dialog's visit picker → Outcomes pipeline end-to-end (dose change renders on visit card badge + visit Outcomes row w/ quoted reason + med History — demo-moment substrate).
- **Two open calls RESOLVED + `/check` ran → 4 fixes** (decisions.md 2026-06-11): **duration → doc-fixed** (design.md §6.12:1852 + §6.7:1500 drop "Duration"; no Phase 4 column); **terra tint → keep `--accent`** (one-place swap). Check fixes: (1) 90-day subtitle window now browser-local not UTC; (2) `nextScheduled` via reduce-min, not sort-dependent `.at(-1)`; (3) most-recent tint derived from the FILTERED view; (4) outcome glyph field-aware — `↑` dose/freq, `↔` status/prescriber (was `↑ discontinued`). Plus the **"last visit 20h ago" bug** — `visit_date` is date-only but hit `formatRelative` (sub-day precision); new `formatRelativeDate()` (day-granularity) on doctor card + doctor-detail + visits subtitle.
- **Gotcha (logged in verify-ui skill):** post-verify cleanup blanket-deleted ALL visits → wiped a real Dr. Sharma visit (recreated at user request). Event rows can't carry a `ZZZ` name-prefix — **track created event IDs and delete only those; never blanket-delete an event table.** Verified `tsc`+`eslint` clean throughout; curl smoke + `/verify-ui` walkthrough green; visits table now holds one real Dr. Sharma visit (today).

### Next Steps
1. **Lab next** (clone the Visit tree; read-only MARKERS table + `+ Log a correction` is the template's last new mechanic), then Symptom/Report/Journal/VitalReading parallelize.
2. Then Patient profile (6.10) + Insights surfaces (6.8/6.9, placeholder data).

### Open Questions / Blockers
- **Condition active→active re-confirm (v1.5):** no-op status guard (409) also blocks re-confirming the *same* status with a fresh reason/date. Accepted for v1; decisions.md 2026-06-02.
- **Pending doc-fixes (next design.md edit):** (§6.12:1842 + §4:243) form date *defaults* are now browser-local (`todayLocal()`), not patient-tz — user decision 2026-06-10 (§9.6's "display in user's local tz" already agrees); (§6.5) permit Notes omission when empty + broaden "Edit toggles Current fields" to all non-clinical (clinical → +Log a change); (§6.2/§6.4) floating Ask AI = context-preserving push drawer (non-modal), NOT full-screen — rail "Chat" + chat persistence remain Phase D (no chat-session table v1).
- **Chat-surface deferred:** (D2) §6.2 grounding header + per-message `grounded in →` footer; (D3) §6.2:1197 router-on-every-input not wired (drawer synthesis-only) — add before `runSynthesis` in **Phase E**; (E3) `surfaceContext` is client-asserted free text (prompt-injection surface) — resolve server-side from an entity id when auth is real.
- **Citation-pill limitations (v1.5):** collision-suffixed citations (`med:x-2`/…/`visit:<date>-2` for same-day visits) resolve to null → misleading "not in record".
- **Allergy detail Linked context** intentionally absent until the Phase E insight generator produces med↔allergy interactions (§6.5:1402 has no stored edge behind it). Pending doc-fix candidates: §6.5:1402 "substance prominent" (substance is the H1) + a §6.4 note that the Allergies list isn't rail-reached + a §6.12 note on the missing Add-lifestyle form (first-population-via-PATCH fills the gap until onboarding) + §6.4:1336 FH CHILDREN bucket.
- **Phase D carryovers (non-blocking):** **Lifestyle v1.5:** real tags input for dietRestrictions (comma-split text for now); change-log dietRestrictions if tag transitions prove meaningful; profile delete/reset path (none — by design). Also: **doctor pickers on Add forms** (§6.12 rich autocomplete + `+ Create new` inline modal for med `prescribingDoctor`/`purpose` + condition `diagnosedBy`/`managingDoctor`) still deferred — every ref IS settable post-create (log-change dialogs / inline select); **list-card entity refs stay inert text** (cards are whole-card anchors; §6.4:1348 wants embedded links, §6.6:1488 wants clickable visit badges — same card-restructure pass); lab/report outcome rows + linked-episode rows link-less until those verticals land; med change-entry "Linked:" annotation inert (med Linked-context section carries the link); Older: enum-validation → `lib/schemas/url-filters.ts`; `useId()` panel IDs; drawer `32rem` magic-number; `chat-drawer-provider` does 4 jobs; **periwinkle dark-mode (v1.5)** no `.dark`; **SDK** `@ai-sdk/anthropic` 3.0.x missing top-level `cacheReadInputTokens`.

---
*Keep this file under 80 lines. Last Session and Next Steps replace on each `/handoff` — never append.*
