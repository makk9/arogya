# arogya — Session Context

> Loaded automatically at every session start. Update with `/handoff` before ending a session.
> Full decision log: `docs/decisions.md`

---

## Current Phase: Phase C COMPLETE — checkpoint 1 (brand accent) + Phase D next

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
- [x] 6. Floating Ask AI button + chat drawer — `components/chat/chat-drawer-provider.tsx` (patient-layout-hosted single persistent `useChat` thread) + `app/patient/[id]/layout.tsx` + `components/ui/sheet.tsx` (Base UI slide-over) + `AskAiButton`→client drawer trigger + `lib/chat/surface-context.ts` (pure builders) + `/api/chat` UIMessage→ModelMessage bridge (`convertToModelMessages`) + `@ai-sdk/react` dep. Non-modal + no backdrop + push layout (content reflows left, stays fully visible) + pinned (ignores outside-press; only Close/Escape dismiss). One thread across patient; `surfaceContext` rides each message body. Browser-verified (Playwright→system Chrome).
- [x] 7. Citation pill popover — `components/citation-pill.tsx` (now `"use client"`) + shadcn `popover` (Base UI) + `medicationQueries.bySlug` + `app/api/medications/by-slug/[slug]/route.ts` + `scripts/check-citation-pill-resolve.ts`. Med pills click→Popover (fetch-on-open, name/dose·freq/status, `View full →` closes popover, drawer stays open). Non-med + external pills stay inert (Phase D). Resolver matches `slugify(name)` (no stored slug). Smoke 6/6, endpoint verified live (5 paths), UI verified by user. /check fixes landed (error-retry, collision doc).

### Phase D — Replicate Pattern (after C)
Other state entities · All event entities · Patient profile · Insights feed (placeholder)

### Phase E — AI-Driven Flows (after D)
Extraction agent + upload pipeline + confirmation surface · Onboarding (agent + surface) · Insight generator · Auto-titling · Doctor brief

### Phase F — Polish

---

### Last Session
- 2026-05-31 — **Phase C item 7 shipped: citation pill popover — Phase C is now COMPLETE.** `§ med:<slug>` pills are clickable → Base UI Popover with entity preview (name · dose·freq · status) + `View full →` to the detail page. New: `medicationQueries.bySlug` (matches `slugify(name)` — meds have **no stored slug**), `GET /api/medications/by-slug/[slug]` (returns preview + `patientId`, since the drawer is global and pills can't assume the route), shadcn `components/ui/popover.tsx`, `scripts/check-citation-pill-resolve.ts`. `citation-pill.tsx` is now `"use client"`; non-med vault + external pills deliberately stay inert (their detail pages are Phase D).
- 2026-05-31 — **Interaction:** fetch-on-open-CLICK (not hover, not mount) — Base UI Popover, result cached via `requestedRef`; transient errors drop the guard so reopen retries. `View full →` closes the popover but **leaves the drawer open** — its push/squeeze + persist-across-nav design makes navigating-with-drawer-open the intended pattern, not overlay confusion. Palette stays stone-only (2026-05-20 reset); the pill's old "pick earth-tones at item 7" comment was superseded + removed.
- 2026-05-31 — **Verified three ways:** `tsc`+`eslint` clean; smoke 6/6 on edge-case names (apostrophe `Lo'Loestrin Fe`, parens `Lipitor (atorvastatin)`, caps, accent `Lévothyrox`); resolver curl'd live against the running server (200 incl. multi-word + discontinued, 404 miss, 400 invalid slug); UI click-through confirmed by user (pill→popover→detail page).
- 2026-05-31 — **/check run + 2 fixes applied:** (1) error state was permanently bricked (`requestedRef` never reset) — now retryable on reopen; (2) `bySlug` comment corrected — a `-N` collision-suffixed citation (`med:x-2`) resolves to null → shows "not in record" (misleading but v1.5-deferred; unique names in single-patient v1).
- **Confirmed (not a bug):** the floating Ask AI button is absent on the Add-medication form — correct per 6.4:1357 (structured-form surfaces are excluded).
- **Working tree status:** COMMITTED at `471f4b6` (Phase C.7 — Citation pill popover) on `main`. Phase C fully shipped; tree clean. Item 6 at `e9958a1`/`f6f6ad7`.

### Next Steps
1. **Phase C checkpoint 1 — brand-accent decision.** All Phase C surfaces now exist (list, detail, form, drawer, pills) to compare against 7.2 anti-patterns; lock the accent or stay stone (per 2026-05-20 reset).
2. **Start Phase D** — replicate the medication template across the other state entities + event entities + patient profile + insights-feed placeholder.
3. **Apply queued doc-fixes to design.md** (the §6.5 / §6.2 / §6.4 items in Open Questions) so the spec stops contradicting shipped reality.

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
