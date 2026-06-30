# arogya — Session Context

> Loaded automatically at every session start. Update with `/handoff` before ending a session.
> Full decision log: `docs/decisions.md`. Completed-phase detail: git history + decisions.md.

---

## Current Phase: Phase E — AI-Driven Flows (active). E0b + E6 ✓ this session; E1–E5, E0a, E4, E7 remain.

### Phases A–D ✓ COMPLETE (committed)
- **A** Foundation (Next/TS/Tailwind/Drizzle/Supabase, 14-table schema, stub auth, seed). decisions.md 2026-05-11/12.
- **B** Agent infra — `vault-context.ts` (excludeBriefs default-true, includeInsights modes, surfaceContext, deterministic now) · 14 serializers + `format.ts` · `AgentError` · Zod `_shared/schemas.ts` (router/extraction/insight/onboarding outputs all locked) · synthesis (Opus, streaming, verbatim 10.3 prompt, brief-mode addendum) · router (Haiku, 3-bucket) · citation parser (`parse.ts`/`remark-plugin.ts` → `CitationPill`/`AiMessage`).
- **C** Medication vertical = reference impl (API path-less/auth-derived · RHF+Zod form · 6.4 list · 6.5 detail · inline-edit · `+Log a change` · by-slug citation pill).
- **D** All 13 surfaces + Health Wiki rail. State (Condition/Doctor/Allergy/Lifestyle/FamilyHistory) + Event (Visit/Lab/Symptom/Report/Journal/Vital) + Patient profile + Insights feed/detail + `wiki-rail.tsx`. Seed has §1.3 demo mini-vault + 5 insights. Shared infra: `lib/api/route-helpers.ts`, `db/queries/_shared.ts`, `lib/logger.ts`, `db/queries/entity-links.ts`.

### Phase E — AI-Driven Flows (§10.2 step E)
Last because they depend on everything before. Phase-A schema groundwork exists (`reports.status` enum, nullable `source_report_id` on 7 derivable entities, `extraction_sessions`). **Build order (§10.2, resequenced 2026-06-25):** E1 extraction+router → E2 upload → E3 confirm → E5 insight-gen → E0a dashboard → E0b chat → E4 onboarding → E6 auto-title → E7 brief. Tripwires: extraction NEVER auto-writes (human-in-loop, §5.4); insights dedup-only on priors, reason fresh (§5.6); insight gen debounced fire-and-forget, no queue (§9.3). Each agent prompt composed inline from its §10.3 spec.

**Spec inconsistency to resolve before E1/E3:** `extractionOutputSchema` (Phase B, follows §5.4) has `ambiguities: string[]`, but §6.11's confirmation UI (E3) needs structured `{field,question,options}`. Decide: extend the schema (recommended — unblocks E3) + doc-fix §5.4↔§10.3. Needs sign-off (output-schema change).

- [x] **E0b. Full-screen chat + `chat_sessions`/`chat_messages`** — ✓ THIS SESSION (committed). See Last Session.
- [x] **E6. Auto-titling** — ✓ THIS SESSION (folded into E0b). `lib/agents/auto-titling.ts` Haiku 4.5, fired in `after()`.
- [ ] **E0a. Dashboard (§6.1)** — chat-centerpiece + status strip + suggested actions + recent insights. Blocks E4 (onboarding exits here; activation banner is its only launcher, §6.3:1246). Banner *logic* is Phase F; shell is E.
- [ ] **E1. Extraction agent + router wiring (§5.4/5.5/9.3).** Wire the built router before `runSynthesis` (D3 carryover): question→synthesis, log→extraction, ambiguous→inline 2-button disambiguator. `lib/agents/extraction.ts` Sonnet 4.6 text+vision, three buckets, matching-dictionary (`includeInsights:"none"`), never-fabricate, empty-array on failure.
- [ ] **E2. File upload pipeline (§9.4).** `/api/files/sign` → browser→Supabase PUT → `/api/files/process` (Report status=`extracting` + `extraction_sessions` → `runExtraction` → ready/failed). `lib/storage.ts` (`getSignedUrl`/`uploadFile`/`deleteFile`); `FilePreview`. Report up-front so file survives failure.
- [ ] **E3. Confirmation surface (§6.11).** `/patient/[id]/extract/[sessionId]`; split-panel; ambiguity inline-resolve chips (block Confirm); new-vs-update toggle; per-card Confirm/Discard/Edit; `Confirm all · N`; commit writes `source_report_id` + status→`committed` + fires debounced insight-gen. NO floating Ask AI.
- [ ] **E5. Insight generator (§5.6/9.3).** `lib/agents/insight-generator.ts` Opus; 5 locked types; conservative severity; empty-output default; priors dedup-only. Fire-and-forget `/api/insights/generate`, 30s debounce. Triggers after entity creations + extraction-commit. Replaces seed insights, ZERO surface change. The §1.3 north-star generator.
- [ ] **E4. Onboarding (§5.8/6.3).** *Needs E0a.* `lib/agents/onboarding.ts` Sonnet, 8 phases, dual output, live-transparency NO confirm gate, escape chips, completion→offer health scan.
- [ ] **E7. Doctor brief (§5.7).** *Unblocked by E0b.* synthesis variant (`delta`/`handoff` addendum, clinical register); citations visible in chat / STRIPPED in PDF; `Download PDF` → PDF gen + footer. Lives in the chat session, no Brief entity.

**Carryover audits queued (decisions.md):** broaden `outcomesForReport` to 7 `source_report_id` entities; journal/insight `linked_entities` AI-tagging; resolve `surfaceContext` server-side from entity id (E3 prompt-injection); vital chat-quick-log; symptom↔condition dedup; Report source-file upload/PDF/`status`; weight `history→`; CONTACT/primary-language cols; rail Dashboard/RECENT links (need E0a); rail-expansion enhancement (decided 2026-06-24, capped per-section preview, not built).

### Phase F — Polish

---

### Last Session
- 2026-06-28/29 — **E0b full-screen chat + session persistence + E6 auto-titling — COMPLETE, verified & COMMITTED.** New `chat_sessions`/`chat_messages` infra tables (signed off; migration `0003`, applied). Three-column surface (`components/chat/full-screen-chat|chat-conversation|chat-history-list|chat-grounding.tsx`), `db/queries/chat.ts`, session API (`/api/chat/sessions[/id]`), persistence wired into `/api/chat`. Rail "Chat" → `/patient/[id]/chat`.
- **Persistence design:** turn (user+assistant) + auto-title run in a Next-16 `after()` callback — off the response critical path; atomic (failed/empty generation persists nothing — no orphan rows). `getMessages` self-scopes via patient join + role-tiebreak ordering.
- **Drawer KEPT** for the floating per-entity Ask AI (ephemeral, page-scoped); only the rail Chat goes full-screen/persisted. Ratified split, declines an already-ratified deviation — not a new one (decisions.md 2026-06-28).
- **Grounding:** per-message `grounded in →` footer built (D2 closed); conversation-header grounding line intentionally **dropped** (duplicated footer, ate width) — design.md:1192 amended. Bottom-strip shortcuts (§6.2:1200) + post-first-reply contextual follow-ups (§6.2:1199, fixed set; reply-derived deferred) built.
- **Lab-result citations made clickable** (testing note): `§ lab-result:` had no pill config → now resolves to the parent lab report via `labResultQueries.byMarkerSlug` + `/api/lab-results/by-marker/[slug]`. `vital` stays intentionally inert. Empty-state copy now names the patient.
- **Verified:** `/check` spec + principal review → 4 spec deviations + 7 eng concerns all fixed; `chat-queries:check` green (+cross-patient scope); tsc/eslint/`next build` clean; **verify-ui 13✅·1❌(bad test regex, not app)·2🔍·console clean** — incl. live lab-result popover → `/labs/<reportId>` and auto-title landing in the sidebar.

### Next Steps
1. **E1 — Extraction agent + router wiring** (start the extract→confirm→commit→insight loop that lands the §1.3 north-star). **First** resolve the `ambiguities` schema shape (extend to `{field,question,options}`, needs sign-off — see spec-inconsistency note above).
2. Continue the loop: E2 upload → E3 confirm → E5 insight-gen (retires seed insights).
3. E0a dashboard before E4 onboarding. E7 brief now unblocked by E0b (needs PDF gen).

### Open Questions / Blockers
- **Extraction `ambiguities` schema** decision needed before E3 (structured `{field,question,options}`) — needs sign-off (output-schema change).
- **Chat-surface carryovers:** (D3) §6.2:1197 router-on-every-input not wired (drawer/chat are synthesis-only) — lands in **E1**; (E3) `surfaceContext` is client-asserted free text (prompt-injection) — resolve server-side from an entity id when auth is real.
- **E0b residual (low priority):** a fresh conversation whose *first* reply fails leaves an empty session row (eager-created on first send) in the list — prune in a future sweep.
- **Citation-pill (v1.5):** collision-suffixed slugs (`med:x-2`, same-day `visit:<date>-2`) resolve to null → misleading "not in record".
- **Pending design.md doc-fixes (next edit):** (§6.12:1842/§4:243) form date defaults browser-local; (§6.5) Notes-omit-when-empty + Edit covers all non-clinical fields; (§6.7:1534 vs §9.4:2571) Report Outcomes vs Linked-context placement/breadth — reconcile when extraction lands; (§6.8:1563) "WATCH" isn't a status. *(§6.2:1192 grounding-header removal already applied this session.)*
- **Allergy detail Linked context** absent until E5 produces med↔allergy interactions. **Phase D carryovers (non-blocking):** Medication inline-field Selects miss `items` (raw enum in edit); doctor pickers on Add forms deferred (refs settable post-create); list-card entity refs inert; periwinkle dark-mode (v1.5); `@ai-sdk/anthropic` 3.0.x missing top-level `cacheReadInputTokens`.

*Keep this file under 80 lines. Last Session and Next Steps replace on each `/handoff` — never append.*
