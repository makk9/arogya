# arogya — Session Context

> Loaded automatically at every session start. Update with `/handoff` before ending a session.
> Full decision log: `docs/decisions.md`. Completed-phase detail: git history + decisions.md.

---

## Current Phase: Phase E — AI-Driven Flows (active). E1 + E2 + E3 ✓ (E3 uncommitted, verify-ui pending); E0a, E4, E5, E7 remain.

### Phases A–D ✓ COMPLETE (committed)
- **A** Foundation (Next/TS/Tailwind/Drizzle/Supabase, 14-table schema, stub auth, seed). decisions.md 2026-05-11/12.
- **B** Agent infra — `vault-context.ts` (excludeBriefs default-true, includeInsights modes, surfaceContext, deterministic now) · 14 serializers + `format.ts` · `AgentError` · Zod `_shared/schemas.ts` (router/extraction/insight/onboarding outputs all locked) · synthesis (Opus, streaming, verbatim 10.3 prompt, brief-mode addendum) · router (Haiku, 3-bucket) · citation parser (`parse.ts`/`remark-plugin.ts` → `CitationPill`/`AiMessage`).
- **C** Medication vertical = reference impl (API path-less/auth-derived · RHF+Zod form · 6.4 list · 6.5 detail · inline-edit · `+Log a change` · by-slug citation pill).
- **D** All 13 surfaces + Health Wiki rail. State (Condition/Doctor/Allergy/Lifestyle/FamilyHistory) + Event (Visit/Lab/Symptom/Report/Journal/Vital) + Patient profile + Insights feed/detail + `wiki-rail.tsx`. Seed has §1.3 demo mini-vault + 5 insights. Shared infra: `lib/api/route-helpers.ts`, `db/queries/_shared.ts`, `lib/logger.ts`, `db/queries/entity-links.ts`.

### Phase E — AI-Driven Flows (§10.2 step E)
Last because they depend on everything before. Phase-A schema groundwork exists (`reports.status` enum, nullable `source_report_id` on 7 derivable entities, `extraction_sessions`). **Build order (§10.2, resequenced 2026-06-25):** E1 extraction+router → E2 upload → E3 confirm → E5 insight-gen → E0a dashboard → E0b chat → E4 onboarding → E6 auto-title → E7 brief. Tripwires: extraction NEVER auto-writes (human-in-loop, §5.4); insights dedup-only on priors, reason fresh (§5.6); insight gen debounced fire-and-forget, no queue (§9.3). Each agent prompt composed inline from its §10.3 spec.

- [x] **E0b. Full-screen chat + `chat_sessions`/`chat_messages`** — ✓ prior session (committed).
- [x] **E6. Auto-titling** — ✓ prior session (folded into E0b). `lib/agents/auto-titling.ts` Haiku 4.5, fired in `after()`.
- [x] **E1. Extraction agent + router→chat wiring** — ✓ COMPLETE. Agent: `lib/agents/extraction.ts` (Sonnet, text+vision+**PDF**, 3-bucket, never-fabricate, empty-array fail) + `buildMatchingDictionary` (names+UUIDs, no change logs; signed off) + `parseStoredExtractionOutput`. `ambiguities`→`{field,question,options}` (signed off, §5.4↔§10.3 doc-fixed). **Router wiring (D3 closed):** `/api/chat/classify` (Haiku) runs on every typed full-screen-chat input → question→synthesis · log→`/api/chat/quick-log`→confirm · ambiguous→inline disambiguator; canned chips skip classify. `log` lands on a **STUB** `extract/[sessionId]` page (E3 replaces). **Drawer NOT wired** (follow-up). Tests: `extraction:check`, `quick-log:check`.
- [x] **E2. File upload pipeline (§9.4)** — ✓ THIS SESSION. `/api/files/{sign,process}`, `lib/files/pipeline.ts` `processUpload`, `lib/storage.ts` (signed-upload/download/path), `db/queries/extraction-session.ts`, `FilePreview`. Report `extracting` up-front → `committed` only at E3; fail/empty→`failed`. Path-scope trust boundary; 25MB cap; transactional outcome. Test: `file-pipeline:check`.
- [ ] **E0a. Dashboard (§6.1)** — chat-centerpiece + status strip + suggested actions + recent insights. Blocks E4 (onboarding exits here; activation banner is its only launcher, §6.3:1246). Banner *logic* is Phase F; shell is E.
- [x] **E3. Confirmation surface (§6.11)** — ✓ THIS SESSION (uncommitted; `verify-ui` pending). Replaced the stub with the real split-panel `components/extract/extraction-confirmation.tsx` (source left / cards right, group-by-type headers, ambiguity chips block Confirm, new-vs-update toggle + `confident`/`needs your call` pill, per-field inline edit, per-card Confirm/Discard/`Edit manually instead`, `Confirm all · N`→`· N blocked`, failure state + `replace file →`, NO floating Ask AI). **Commit engine `lib/extraction/commit.ts`** (server-only) — the ONLY extraction→vault write: CREATE for all 8 types (snake→typed, never-fabricate, enum-drop, composite BP/ref-range split, free-text doctor/purpose→notes, med category→allopathic / allergy category→other defaults); UPDATE for 4 state types via change-log/PATCH (event types always create, §5.4:791); `source_report_id` on the 7 carrying types. `POST /api/extract/[sessionId]/commit` (per-card + `Confirm all`, `finalize`→`markCommitted` flips session+report→`committed`; **E5 insight-gen seam**). "Edit manually" → `lib/extract/draft.ts` sessionStorage prefill (**consumed by all 8 /new forms**; verified via real edit-manually client-nav). **Deviations:** Confirm-all → patient profile (no E0a dashboard) + no toast (no lib); §6.2:1197 post-commit "inline Logged·continue" + §5.5 compound synthesis-forward still deferred. See decisions.md 2026-07-01.
- [ ] **E5. Insight generator (§5.6/9.3).** `lib/agents/insight-generator.ts` Opus; 5 locked types; conservative severity; empty-output default; priors dedup-only. Fire-and-forget `/api/insights/generate`, 30s debounce. Triggers after entity creations + extraction-commit. Replaces seed insights, ZERO surface change. The §1.3 north-star generator.
- [ ] **E4. Onboarding (§5.8/6.3).** *Needs E0a.* `lib/agents/onboarding.ts` Sonnet, 8 phases, dual output, live-transparency NO confirm gate, escape chips, completion→offer health scan.
- [ ] **E7. Doctor brief (§5.7).** *Unblocked by E0b.* synthesis variant (`delta`/`handoff` addendum, clinical register); citations visible in chat / STRIPPED in PDF; `Download PDF` → PDF gen + footer. Lives in the chat session, no Brief entity.

**Carryover audits queued (decisions.md):** broaden `outcomesForReport` to 7 `source_report_id` entities; journal/insight `linked_entities` AI-tagging; resolve `surfaceContext` server-side from entity id (E3 prompt-injection); vital chat-quick-log; symptom↔condition dedup; Report source-file upload/PDF/`status`; weight `history→`; CONTACT/primary-language cols; rail Dashboard/RECENT links (need E0a); rail-expansion enhancement (decided 2026-06-24, capped per-section preview, not built).

### Phase F — Polish

---

### Last Session
- 2026-06-29/30 — **E1 (agent + router→chat wiring) + E2 (upload pipeline) — built, verified, E1+E2-core COMMITTED (`d2910c1`); router-wiring commit pending.** Front half of extract→confirm→commit→insight loop. No new clinical schema.
- **E1 agent:** `runExtraction` (Sonnet; text/image/PDF; 3-bucket; never-fabricate; empty-array fail; AgentError+Zod). `buildMatchingDictionary` in canonical `vault-context.ts` (names+**UUIDs**, no change logs — deliberate deviation from checklist's "via buildVaultContext" since that emits slugs; signed off). `ambiguities`→`{field,question,options}` (signed off; §5.4+§10.3 doc-fixed).
- **E1 router wiring (D3 closed):** client classify-then-branch — `/api/chat/classify` (Haiku) on typed input → question→synthesis (existing stream untouched) · log→`/api/chat/quick-log` (`processQuickLog`, text→Report.content+session) → navigate to confirm · ambiguous→inline 2-button disambiguator. Canned chips skip classify. **Stub** `extract/[sessionId]` page is the `log`/upload destination (E3 replaces). Full-screen chat only; **drawer deferred**.
- **E2:** `/api/files/{sign,process}` over `processUpload`; `lib/storage.ts` (+signed-upload/download/path); `extraction-session` queries; `FilePreview`; `mimeFromPath`. Report `extracting`→`committed` at E3; empty/error→`failed`. Transactional `recordOutcome`. Synchronous extraction (no queue, §9.3).
- **E3 contracts:** no Reports mimeType column → `mimeFromPath(sourceFileUrl)`; jsonb is untyped → `parseStoredExtractionOutput`, never cast.
- **Verified:** `/check` → 0 blockers, 6 eng concerns all fixed. `tsc`/`eslint`/`next build` clean. `extraction:check` + `file-pipeline:check` (live PDF matched seeded med+doctor) + `quick-log:check` (compound input → Telma→Telmisartan update + BP vital) all green. **Browser pass (verify-ui) of the live chat classify→branch + disambiguator + stub page still pending.**

### Next Steps
1. **COMMIT the router-wiring slice** (uncommitted: `app/api/chat/{classify,quick-log}/`, `lib/chat/quick-log.ts`, `extract/[sessionId]/page.tsx`, `chat-conversation.tsx`, chat schemas, `check-quick-log.ts`).
2. **`verify-ui` the chat loop** — type a log ("BP 152/95 this morning") → confirm classify routes to the stub confirm page with the extraction; type a question → synthesis; type something ambiguous → disambiguator.
3. **E3 — confirmation surface (§6.11)** — replace the stub; commit-writes `source_report_id` + fires insight-gen. Then **E5** (retires seed insights), E0a→E4, E7.

- **Router wiring landed in full-screen chat only** — the Ask-AI **drawer** is still synthesis-only (deferred; logging from a non-navigating side-panel is its own UX call). Wire it in E3.
- **(E3) `surfaceContext`** is client-asserted free text (prompt-injection) — resolve server-side from an entity id when auth is real.
- **E2/quick-log residual (low priority):** an abandoned confirmation leaves an `extracting` report (source survives; same class as the E0b empty-session residual) — prune in a future sweep.
- **E3 must:** derive FilePreview MIME via `mimeFromPath`; re-validate the session jsonb via `parseStoredExtractionOutput`; add the §6.2:1197 post-commit inline-Logged-continue + §5.5 compound post-confirm synthesis-forward.
- **Log-path latency (defer to E3, UX not perf).** A chat `log` runs classify (Haiku) + extraction (Sonnet) synchronously before the confirm page appears (~a few s warm; the "massive" first-hit lag was mostly dev-mode route compilation — confirmed faster on 2nd log). Chat shows a "Reading that…" indicator (f173bc4). Proper fix belongs to E3's real confirm page: **navigate instantly → run extraction in the background → show an "Extracting…" state** (session already starts `pending`; page polls/streams to ready/failed). Building it into the throwaway stub isn't worth it.
- **Citation-pill (v1.5):** collision-suffixed slugs (`med:x-2`, same-day `visit:<date>-2`) resolve to null → misleading "not in record".
- **Pending design.md doc-fixes (next edit):** (§6.12:1842/§4:243) form date defaults browser-local; (§6.5) Notes-omit-when-empty + Edit covers all non-clinical fields; (§6.7:1534 vs §9.4:2571) Report Outcomes vs Linked-context placement/breadth — reconcile when extraction lands; (§6.8:1563) "WATCH" isn't a status. *(§6.2:1192 grounding-header removal already applied this session.)*
- **Allergy detail Linked context** absent until E5 produces med↔allergy interactions. **Phase D carryovers (non-blocking):** Medication inline-field Selects miss `items` (raw enum in edit); doctor pickers on Add forms deferred (refs settable post-create); list-card entity refs inert; periwinkle dark-mode (v1.5); `@ai-sdk/anthropic` 3.0.x missing top-level `cacheReadInputTokens`.

*Keep this file under 80 lines. Last Session and Next Steps replace on each `/handoff` — never append.*
