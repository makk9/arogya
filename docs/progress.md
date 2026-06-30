# arogya — Session Context

> Loaded automatically at every session start. Update with `/handoff` before ending a session.
> Full decision log: `docs/decisions.md`. Completed-phase detail: git history + decisions.md.

---

## Current Phase: Phase E — AI-Driven Flows (active). E1 + E2 ✓ this session (uncommitted); E0a, E3, E4, E5, E7 remain.

### Phases A–D ✓ COMPLETE (committed)
- **A** Foundation (Next/TS/Tailwind/Drizzle/Supabase, 14-table schema, stub auth, seed). decisions.md 2026-05-11/12.
- **B** Agent infra — `vault-context.ts` (excludeBriefs default-true, includeInsights modes, surfaceContext, deterministic now) · 14 serializers + `format.ts` · `AgentError` · Zod `_shared/schemas.ts` (router/extraction/insight/onboarding outputs all locked) · synthesis (Opus, streaming, verbatim 10.3 prompt, brief-mode addendum) · router (Haiku, 3-bucket) · citation parser (`parse.ts`/`remark-plugin.ts` → `CitationPill`/`AiMessage`).
- **C** Medication vertical = reference impl (API path-less/auth-derived · RHF+Zod form · 6.4 list · 6.5 detail · inline-edit · `+Log a change` · by-slug citation pill).
- **D** All 13 surfaces + Health Wiki rail. State (Condition/Doctor/Allergy/Lifestyle/FamilyHistory) + Event (Visit/Lab/Symptom/Report/Journal/Vital) + Patient profile + Insights feed/detail + `wiki-rail.tsx`. Seed has §1.3 demo mini-vault + 5 insights. Shared infra: `lib/api/route-helpers.ts`, `db/queries/_shared.ts`, `lib/logger.ts`, `db/queries/entity-links.ts`.

### Phase E — AI-Driven Flows (§10.2 step E)
Last because they depend on everything before. Phase-A schema groundwork exists (`reports.status` enum, nullable `source_report_id` on 7 derivable entities, `extraction_sessions`). **Build order (§10.2, resequenced 2026-06-25):** E1 extraction+router → E2 upload → E3 confirm → E5 insight-gen → E0a dashboard → E0b chat → E4 onboarding → E6 auto-title → E7 brief. Tripwires: extraction NEVER auto-writes (human-in-loop, §5.4); insights dedup-only on priors, reason fresh (§5.6); insight gen debounced fire-and-forget, no queue (§9.3). Each agent prompt composed inline from its §10.3 spec.

- [x] **E0b. Full-screen chat + `chat_sessions`/`chat_messages`** — ✓ prior session (committed).
- [x] **E6. Auto-titling** — ✓ prior session (folded into E0b). `lib/agents/auto-titling.ts` Haiku 4.5, fired in `after()`.
- [x] **E1. Extraction agent + schema lock** — ✓ THIS SESSION. `lib/agents/extraction.ts` (Sonnet 4.6, text+vision+**PDF**, 3-bucket, never-fabricate, empty-array fail) + `buildMatchingDictionary` (names+UUIDs, no change logs — NOT full vault; signed off). `ambiguities`→`{field,question,options}` (signed off, §5.4↔§10.3 doc-fixed). `parseStoredExtractionOutput` for read-back. **Router→chat wiring DEFERRED to E3** (its `log` branch needs the confirm surface as a destination). Test: `extraction:check`.
- [x] **E2. File upload pipeline (§9.4)** — ✓ THIS SESSION. `/api/files/{sign,process}`, `lib/files/pipeline.ts` `processUpload`, `lib/storage.ts` (signed-upload/download/path), `db/queries/extraction-session.ts`, `FilePreview`. Report `extracting` up-front → `committed` only at E3; fail/empty→`failed`. Path-scope trust boundary; 25MB cap; transactional outcome. Test: `file-pipeline:check`.
- [ ] **E0a. Dashboard (§6.1)** — chat-centerpiece + status strip + suggested actions + recent insights. Blocks E4 (onboarding exits here; activation banner is its only launcher, §6.3:1246). Banner *logic* is Phase F; shell is E.
- [ ] **E3. Confirmation surface (§6.11).** *Now unblocked (E1+E2 done).* `/patient/[id]/extract/[sessionId]` reads the session row (`parseStoredExtractionOutput`), derives FilePreview MIME via `mimeFromPath`; split-panel; ambiguity inline-resolve chips (block Confirm); new-vs-update toggle; per-card Confirm/Discard/Edit; `Confirm all · N`; commit writes `source_report_id` + report/session→`committed` + fires debounced insight-gen. NO floating Ask AI. **Also lands router→chat wiring + upload entry point.**
- [ ] **E5. Insight generator (§5.6/9.3).** `lib/agents/insight-generator.ts` Opus; 5 locked types; conservative severity; empty-output default; priors dedup-only. Fire-and-forget `/api/insights/generate`, 30s debounce. Triggers after entity creations + extraction-commit. Replaces seed insights, ZERO surface change. The §1.3 north-star generator.
- [ ] **E4. Onboarding (§5.8/6.3).** *Needs E0a.* `lib/agents/onboarding.ts` Sonnet, 8 phases, dual output, live-transparency NO confirm gate, escape chips, completion→offer health scan.
- [ ] **E7. Doctor brief (§5.7).** *Unblocked by E0b.* synthesis variant (`delta`/`handoff` addendum, clinical register); citations visible in chat / STRIPPED in PDF; `Download PDF` → PDF gen + footer. Lives in the chat session, no Brief entity.

**Carryover audits queued (decisions.md):** broaden `outcomesForReport` to 7 `source_report_id` entities; journal/insight `linked_entities` AI-tagging; resolve `surfaceContext` server-side from entity id (E3 prompt-injection); vital chat-quick-log; symptom↔condition dedup; Report source-file upload/PDF/`status`; weight `history→`; CONTACT/primary-language cols; rail Dashboard/RECENT links (need E0a); rail-expansion enhancement (decided 2026-06-24, capped per-section preview, not built).

### Phase F — Polish

---

### Last Session
- 2026-06-29 — **E1 extraction agent + E2 upload pipeline — built & verified (NOT yet committed).** Front half of the extract→confirm→commit→insight loop. No new clinical schema (Phase-A groundwork reused).
- **E1:** `lib/agents/extraction.ts` `runExtraction` (Sonnet 4.6; text + image + PDF document blocks; 3-bucket new-vs-update; never-fabricate; empty-array on unreadable; AgentError-wrapped, Zod-validated; patterned on `router.ts`). `buildMatchingDictionary` added to canonical `vault-context.ts` (names + **UUIDs**, no change logs — deliberate deviation from the checklist's "via buildVaultContext", because that emits slugs not UUIDs; signed off). `ambiguities` schema extended to `{field,question,options}` (signed off); §5.4 + §10.3 doc-fixed to agree.
- **E2:** two endpoints (`/api/files/sign` signed PUT, `/api/files/process`) over `lib/files/pipeline.ts#processUpload`; `lib/storage.ts` (+`createSignedUploadUrl`/`downloadFile`/`buildUploadPath`); `db/queries/extraction-session.ts` (+barrel); `components/reports/file-preview.tsx`; `lib/files/mime.ts`. Report `extracting` up-front, vault-invisible until E3 commit (→`committed`); empty/error→`failed`. Synchronous in-request extraction (no queue, §9.3).
- **Gotchas for E3:** Reports table has **no mimeType column** → derive via `mimeFromPath(sourceFileUrl)`. Stored `extraction_output_json` is untyped jsonb → E3 must call `parseStoredExtractionOutput`, never cast. Router→chat wiring (D3) + upload entry-point UI both land in E3 (the `log`/upload branches need the confirm surface as their destination).
- **Verified:** `/check` (spec + principal review) → 0 blockers, 2 documented spec deviations (FilePreview `1 of N` + plain `<img>`), 6 eng concerns ALL fixed (mimeType helper, single patient-id source, trust stored content-type, transactional `recordOutcome`, 25MB cap, jsonb re-validate; dropped dead `setStatus`). `tsc`/`eslint` clean. `extraction:check` + `file-pipeline:check` green — live PDF round-trip matched seeded med AND doctor by UUID.

### Next Steps
1. **COMMIT E1 + E2** (working tree is clean-but-uncommitted; new files under `lib/agents/extraction.ts`, `lib/files/`, `app/api/files/`, `db/queries/extraction-session.ts`, `components/reports/file-preview.tsx`, 2 check scripts).
2. **E3 — confirmation surface (§6.11)** — now unblocked; makes the whole upload→confirm→commit loop visible (first browser test of `FilePreview` + upload entry point) and lands router→chat wiring. Honor the two E3 gotchas above.
3. Then **E5 insight-gen** (retires seed insights, lands §1.3 north-star), then E0a→E4, E7 (needs PDF gen).

### Open Questions / Blockers
- **Router→chat wiring (D3, §6.2:1197)** not yet wired (drawer/chat still synthesis-only) — **lands in E3** alongside the confirm surface (the `log` branch needs it as a destination). `runRouter` exists; the branch is question→synthesis, log→extraction→confirm, ambiguous→inline disambiguator.
- **(E3) `surfaceContext`** is client-asserted free text (prompt-injection) — resolve server-side from an entity id when auth is real.
- **E2 residual (low priority):** an abandoned confirmation leaves an `extracting` report (file survives; same class as the E0b empty-session residual) — prune in a future sweep.
- **E3 must derive FilePreview MIME** via `mimeFromPath` (no Reports MIME column) and **re-validate** the session's jsonb via `parseStoredExtractionOutput`.
- **Citation-pill (v1.5):** collision-suffixed slugs (`med:x-2`, same-day `visit:<date>-2`) resolve to null → misleading "not in record".
- **Pending design.md doc-fixes (next edit):** (§6.12:1842/§4:243) form date defaults browser-local; (§6.5) Notes-omit-when-empty + Edit covers all non-clinical fields; (§6.7:1534 vs §9.4:2571) Report Outcomes vs Linked-context placement/breadth — reconcile when extraction lands; (§6.8:1563) "WATCH" isn't a status. *(§6.2:1192 grounding-header removal already applied this session.)*
- **Allergy detail Linked context** absent until E5 produces med↔allergy interactions. **Phase D carryovers (non-blocking):** Medication inline-field Selects miss `items` (raw enum in edit); doctor pickers on Add forms deferred (refs settable post-create); list-card entity refs inert; periwinkle dark-mode (v1.5); `@ai-sdk/anthropic` 3.0.x missing top-level `cacheReadInputTokens`.

*Keep this file under 80 lines. Last Session and Next Steps replace on each `/handoff` — never append.*
