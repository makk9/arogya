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

State entities (6.4 + 6.5 + `*_changes`):
- [ ] Condition — status ACTIVE/CONTROLLED/IN_REMISSION/RESOLVED/SUSPECTED; linked meds + labs
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
- 2026-05-31 — **Phase C checkpoint 1 RESOLVED: brand accent = periwinkle** (muted blue-violet, oklch hue 277). A *recorded deviation* from §7.2 "not clinical-blue" — validated live across all 5 Phase C surfaces before committing; reads calm, not clinical. Token swap in `app/globals.css` (accent-bearing tokens only; warm-stone neutrals unchanged — pairing judged harmonious). Vault citation pills + chat user-bubble wired to the accent tint; external `↗` pills stay neutral stone; `View full →` link → `text-primary`. `--destructive` stays red. Dark mode derived, NOT yet visually validated (light-first). Full rationale: decisions.md 2026-05-31; §7.2 doc note applied. `tsc`+`eslint` clean.
- 2026-05-31 — **Phase C item 7 shipped: citation pill popover — Phase C is now COMPLETE.** `§ med:<slug>` pills are clickable → Base UI Popover with entity preview (name · dose·freq · status) + `View full →` to the detail page. New: `medicationQueries.bySlug` (matches `slugify(name)` — meds have **no stored slug**), `GET /api/medications/by-slug/[slug]` (returns preview + `patientId`, since the drawer is global and pills can't assume the route), shadcn `components/ui/popover.tsx`, `scripts/check-citation-pill-resolve.ts`. `citation-pill.tsx` is now `"use client"`; non-med vault + external pills deliberately stay inert (their detail pages are Phase D).
- 2026-05-31 — **Interaction:** fetch-on-open-CLICK (not hover, not mount) — Base UI Popover, result cached via `requestedRef`; transient errors drop the guard so reopen retries. `View full →` closes the popover but **leaves the drawer open** — its push/squeeze + persist-across-nav design makes navigating-with-drawer-open the intended pattern, not overlay confusion. Palette stays stone-only (2026-05-20 reset); the pill's old "pick earth-tones at item 7" comment was superseded + removed.
- 2026-05-31 — **Verified three ways:** `tsc`+`eslint` clean; smoke 6/6 on edge-case names (apostrophe `Lo'Loestrin Fe`, parens `Lipitor (atorvastatin)`, caps, accent `Lévothyrox`); resolver curl'd live against the running server (200 incl. multi-word + discontinued, 404 miss, 400 invalid slug); UI click-through confirmed by user (pill→popover→detail page).
- 2026-05-31 — **/check run + 2 fixes applied:** (1) error state was permanently bricked (`requestedRef` never reset) — now retryable on reopen; (2) `bySlug` comment corrected — a `-N` collision-suffixed citation (`med:x-2`) resolves to null → shows "not in record" (misleading but v1.5-deferred; unique names in single-patient v1).
- **Confirmed (not a bug):** the floating Ask AI button is absent on the Add-medication form — correct per 6.4:1357 (structured-form surfaces are excluded).
- **Working tree status:** COMMITTED at `471f4b6` (Phase C.7 — Citation pill popover) on `main`. Phase C fully shipped; tree clean. Item 6 at `e9958a1`/`f6f6ad7`.

### Next Steps
1. **Start Phase D** — replicate the medication template across the other state entities + event entities + patient profile + insights-feed placeholder. Build against the now-settled periwinkle palette. Begin with **Condition** (proves the state template generalizes).
2. **Apply queued doc-fixes to design.md** (the §6.5 / §6.2 / §6.4 items in Open Questions) so the spec stops contradicting shipped reality. (§7.2 no-blue note already applied this session.)
3. **Periwinkle dark-mode pass (deferred, v1.5).** No theme system is wired — nothing sets the `.dark` class, so the dark block never activates (dead code until a toggle exists; dark mode is out of v1 scope). Periwinkle dark values are derived, not validated; revisit only if/when a theme toggle lands.

### Open Questions / Blockers
- **Pending doc-fixes (apply alongside next design.md edit):** (§6.5) permit Notes omission when empty + broaden "Edit toggles Current-section fields" to all non-clinical fields (clinical route through + Log a change); (§6.2/§6.4) floating Ask AI opens a **context-preserving push drawer** (non-modal, no backdrop), NOT full-screen nav — three-column rail "Chat" surface + chat persistence-across-refresh remain Phase D (no chat-session table in v1).
- **Chat-surface behaviors deferred (from item 6 /check):** (D2) §6.2 grounding `header (grounded in: [entities] · N sources)` + per-message `grounded in →` footer not built — land with the Phase D rail "Chat" surface; (D3) §6.2:1197 router-on-every-input not wired (drawer is synthesis-only) — insert the router before `runSynthesis` on this surface in **Phase E** when extraction/logging exists; (E3) `surfaceContext` is now client-asserted free text injected into the prompt (prompt-injection surface, immaterial in single-user v1) — resolve it server-side from an entity id when auth becomes real.
- **Item 7 known limitations (both v1.5):** (a) collision-suffixed citations (`med:x-2`) don't resolve → misleading "not in record" — needs faithful slug disambiguation; (b) popover preview omits **prescribing doctor** — the demo's cross-doctor field — add once the Doctor picker/join lands in Phase D.
- **Item 3 polish backlog** (non-blocking; Phase D / polish): enum-validation → `lib/schemas/url-filters.ts`, `useId()` for panel IDs, empty-state copy restore once Phase E extraction ships.
- **Server-side error logging missing across all routes** (incl. `/api/chat`, `/discontinue`, new `/by-slug`). Per 9.6:2845. Land `lib/logger.ts` before write paths multiply.
- **Drawer polish (non-blocking, from /check):** (E2) drawer width is a magic number duplicated across two files — panel `sm:max-w-lg` + push `sm:pr-[32rem]` (both 32rem); unify via a CSS var (`--chat-drawer-w`) before Phase D copies the pattern. (E5) `chat-drawer-provider` does 4 jobs in one file — extract a presentational `ChatConversation` when the Phase D rail "Chat" surface needs the same rendering. Close-animation padding releases over the same 300ms (fine; tighten if a seam shows).
- **SDK workaround:** `@ai-sdk/anthropic` 3.0.x missing `cacheReadInputTokens` at top level. Smoke script reads snake_case directly. Pending upstream fix.

---
*Keep this file under 80 lines. Last Session and Next Steps replace on each `/handoff` — never append.*
