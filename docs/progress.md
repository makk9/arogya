# arogya — Session Context

> Loaded automatically at every session start. Update with `/handoff` before ending a session.
> Full decision log: `docs/decisions.md`

---

## Current Phase: Phase C item 6 done — item 7 next

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
- [ ] 7. Citation pill rendering for `§ med:amlodipine` (builds on Phase B citation parser)

### Phase D — Replicate Pattern (after C)
Other state entities · All event entities · Patient profile · Insights feed (placeholder)

### Phase E — AI-Driven Flows (after D)
Extraction agent + upload pipeline + confirmation surface · Onboarding (agent + surface) · Insight generator · Auto-titling · Doctor brief

### Phase F — Polish

---

### Last Session
- 2026-05-30 — **Phase C item 6 shipped: floating Ask AI → chat drawer.** Started as a full-page `/chat` route (decided + built 05-29), then **reversed to a persistent right-side drawer** after dogfood feedback (keeps the record visible while asking; thread survives navigation). New: `ChatDrawerProvider` (layout-hosted `useChat`), `app/patient/[id]/layout.tsx`, `components/ui/sheet.tsx` (Base UI), `lib/chat/surface-context.ts` (pure builders). Changed: `AskAiButton`→client trigger, `/api/chat` UIMessage bridge (`convertToModelMessages`), chat schema→UIMessage shape. Dropped: `app/patient/[id]/chat/page.tsx` + `components/chat/chat-pane.tsx`. Added dep `@ai-sdk/react`.
- 2026-05-30 — **Drawer interaction model:** non-modal (`modal={false}`) + no backdrop (`SheetContent overlay={false}`) + **push layout** (content wrapper gets `sm:pr-[32rem]` when open, page reflows left) + **pinned** (`onOpenChange` ignores `outside-press`/`focus-out`; only Close button + Escape dismiss). One thread across the patient; `surfaceContext` rides each `sendMessage` body so framing tracks the current page.
- 2026-05-30 — **Browser-verified end-to-end** via Playwright driving **system Chrome** (installed to `/tmp`, never added to project deps): content recentered x336→x80 with no overlap, `sheet-overlay` count 0, drawer stays open after clicking the page, surface bias correct ("Tylenol… currently paused, 15mg twice daily"), `§ med:tylenol` pill renders, streaming OK. `tsc` + `eslint` clean.
- 2026-05-30 — **Clarified (not a bug): no free-text "purpose" field.** `medications.purpose` is an FK→`conditions`, surfaced in the UI as **TREATS**; renders `—` until the Condition entity ships in Phase D (picker deliberately held back, same as prescribing-doctor). A free-text purpose would be a schema change needing sign-off — declined (breaks med↔condition synthesis).
- **Decisions logged:** two entries — 05-29 (page approach) + 05-30 (drawer reversal, with the non-modal/no-blur/push refinements inside its reasoning).
- **Working tree status:** UNCOMMITTED. 9 modified + new `app/patient/[id]/layout.tsx`, `components/chat/`, `components/ui/sheet.tsx`, `lib/chat/`. Suggested commit title: `Phase C.6 — Floating Ask AI drawer + surface context`. Last commit on branch: `1fa458f` (C.5).

### Next Steps
1. **Commit Phase C item 6** (title above). Note `package.json`/`package-lock.json` gained `@ai-sdk/react`.
2. **Phase C item 7 — Citation pill popover** (last Phase C item). `§ med:slug` pills (carry `data-entity-type`/`data-slug` from Phase B) get a shadcn Popover: entity preview + `View full →` that navigates the page **behind the drawer** to the detail page. Needs slug→id resolution (meds have **no stored slug** — derived via `slugify()`/`SlugIndex`); wire to the medication read API. The drawer is the host.
3. **Phase C wrap → checkpoint 1 brand-accent decision** (post items-3-4-5-6, multiple surfaces now exist), then start Phase D.

### Open Questions / Blockers
- **Pending doc-fixes (apply alongside next design.md edit):** (§6.5) permit Notes omission when empty + broaden "Edit toggles Current-section fields" to all non-clinical fields (clinical route through + Log a change); (§6.2/§6.4) floating Ask AI opens a **context-preserving push drawer** (non-modal, no backdrop), NOT full-screen nav — three-column rail "Chat" surface + chat persistence-across-refresh remain Phase D (no chat-session table in v1).
- **Chat-surface behaviors deferred (from item 6 /check):** (D2) §6.2 grounding `header (grounded in: [entities] · N sources)` + per-message `grounded in →` footer not built — land with the Phase D rail "Chat" surface; (D3) §6.2:1197 router-on-every-input not wired (drawer is synthesis-only) — insert the router before `runSynthesis` on this surface in **Phase E** when extraction/logging exists; (E3) `surfaceContext` is now client-asserted free text injected into the prompt (prompt-injection surface, immaterial in single-user v1) — resolve it server-side from an entity id when auth becomes real.
- **Brand accent decision deferred to Phase C checkpoint 1** (post items 3-6 — surfaces now exist to compare). See decisions.md 2026-05-20.
- **Item 3 polish backlog** (non-blocking; Phase D / polish): enum-validation → `lib/schemas/url-filters.ts`, `useId()` for panel IDs, empty-state copy restore once Phase E extraction ships.
- **Server-side error logging missing across all routes** (incl. `/api/chat`, `/discontinue`). Per 9.6:2845. Land `lib/logger.ts` before write paths multiply.
- **Drawer polish (non-blocking, from /check):** (E2) drawer width is a magic number duplicated across two files — panel `sm:max-w-lg` + push `sm:pr-[32rem]` (both 32rem); unify via a CSS var (`--chat-drawer-w`) before Phase D copies the pattern. (E5) `chat-drawer-provider` does 4 jobs in one file — extract a presentational `ChatConversation` when the Phase D rail "Chat" surface needs the same rendering. Close-animation padding releases over the same 300ms (fine; tighten if a seam shows).
- **SDK workaround:** `@ai-sdk/anthropic` 3.0.x missing `cacheReadInputTokens` at top level. Smoke script reads snake_case directly. Pending upstream fix.

---
*Keep this file under 80 lines. Last Session and Next Steps replace on each `/handoff` — never append.*
