# arogya — Session Context

> Loaded automatically at every session start. Update with `/handoff` before ending a session.
> Full decision log: `docs/decisions.md`. Completed-phase detail: git history + decisions.md.

---

## Current Phase: Phase E — AI-Driven Flows (active). E1+E2+E3 ✓ COMMITTED (338ae67) + chat-log/prefill/extraction-context refinements. **6 code-review regressions FIXED (decisions.md 2026-07-14).** Next: lab/visit amendment → E5. E0a, E4, E7 remain.

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
- [x] **E3. Confirmation surface (§6.11)** — ✓ COMMITTED (`d263b10`+`338ae67`); `verify-ui` green (24/24). Replaced the stub with the real split-panel `components/extract/extraction-confirmation.tsx` (source left / cards right, group-by-type headers, ambiguity chips block Confirm, new-vs-update toggle + `confident`/`needs your call` pill, per-field inline edit, per-card Confirm/Discard/`Edit manually instead`, `Confirm all · N`→`· N blocked`, failure state + `replace file →`, NO floating Ask AI). **Commit engine `lib/extraction/commit.ts`** (server-only) — the ONLY extraction→vault write: CREATE for all 8 types (snake→typed, never-fabricate, enum-drop, composite BP/ref-range split, free-text doctor/purpose→notes, med category→allopathic / allergy category→other defaults); UPDATE for 4 state types via change-log/PATCH (event types always create, §5.4:791); `source_report_id` on the 7 carrying types. `POST /api/extract/[sessionId]/commit` (per-card + `Confirm all`, `finalize`→`markCommitted` flips session+report→`committed`; **E5 insight-gen seam**). "Edit manually" → `lib/extract/draft.ts` sessionStorage prefill (**consumed by all 8 /new forms**; verified via real edit-manually client-nav). **Deviations:** Confirm-all → patient profile (no E0a dashboard) + no toast (no lib); §6.2:1197 post-commit "inline Logged·continue" + §5.5 compound synthesis-forward still deferred. See decisions.md 2026-07-01.
- [ ] **E5. Insight generator (§5.6/9.3).** `lib/agents/insight-generator.ts` Opus; 5 locked types; conservative severity; empty-output default; priors dedup-only. Fire-and-forget `/api/insights/generate`, 30s debounce. Triggers after entity creations + extraction-commit. Replaces seed insights, ZERO surface change. The §1.3 north-star generator.
- [ ] **E4. Onboarding (§5.8/6.3).** *Needs E0a.* `lib/agents/onboarding.ts` Sonnet, 8 phases, dual output, live-transparency NO confirm gate, escape chips, completion→offer health scan.
- [ ] **E7. Doctor brief (§5.7).** *Unblocked by E0b.* synthesis variant (`delta`/`handoff` addendum, clinical register); citations visible in chat / STRIPPED in PDF; `Download PDF` → PDF gen + footer. Lives in the chat session, no Brief entity.

**Carryover audits queued (decisions.md):** broaden `outcomesForReport` to 7 `source_report_id` entities; journal/insight `linked_entities` AI-tagging; resolve `surfaceContext` server-side from entity id (E3 prompt-injection); vital chat-quick-log; symptom↔condition dedup; Report source-file upload/PDF/`status`; weight `history→`; CONTACT/primary-language cols; rail Dashboard/RECENT links (need E0a); rail-expansion enhancement (decided 2026-06-24, capped per-section preview, not built).

### Phase F — Polish

---

### Last Session (2026-07-01 → 07-14)
- **E3 built + committed** (`d263b10`), then a large refinement batch (`338ae67`): commit engine `lib/extraction/commit.ts` (8 types; discontinue-via-log through the discontinue path via a new agent `status` field); confirmation surface + `POST /api/extract/[sessionId]/commit`; verify-ui 24/24.
- **Logging now lives in the chat** (§6.2:1197): echo→persist→return-to-conversation + a "Logged ✓" assistant ack (`summarizeCommit`). Ask-AI **drawer** now logs AND persists to the CHATS list (shared session model) + a "New chat" button. Full-screen `chat-conversation` + drawer both route logs.
- **All 8 /new forms** consume "Edit manually" prefill (`lib/extract/draft.ts`, StrictMode-safe memo + `setTimeout(0)`).
- **Reports:** quick-log source stubs hidden from timeline + rail via shared `realReportsWhere` (`db/queries/report.ts`); orphan-cleanup script `scripts/cleanup-orphan-source-stubs.ts` (ran: vault tidy).
- **Extraction smarter:** `runExtraction({today})` + recent lab/visit context in `buildMatchingDictionary` → resolves relative dates, flags amend-existing instead of guessing years/duplicating. Kept single-shot (agentic DB-search = deliberate v2, esp. for synthesis/large vaults).
- **Misc:** force-push hook narrowed (`.claude/settings.json`; takes effect next session); duplicate AI-avatar fixed. **Uncommitted:** `summarizeCommit` lab msg → "Added a new lab report (date) — markers".
- **⚠ /code-review (high) found 10 findings; 6 CONFIRMED must-fix regressions from THIS session** — see Next Steps.

### Next Steps
1. ✅ **DONE — 6 code-review regressions fixed + committed** (decisions.md 2026-07-14; incl. the `summarizeCommit` lab-msg tweak). tsc/eslint clean; DB-level fixes probe-verified. Watch-items from the judgment calls: (5) failed/discarded logs now render as plain notes on the Reports timeline (entity-less stubs stay visible so notes aren't lost) — revisit if that clutters; (3) finalize-only commit path (`{cards:[],finalize:true}`) is new.
2. **Lab/visit amendment** — the real "add to the June 15 lab" fix: extraction already flags it; wire the §6.7 correction path into commit + confirmation UI so update-mode means something for events.
3. **E5 insight generator** (retires seed insights; §1.3 north-star) → then E0a→E4, E7.

- **Lower review items (PLAUSIBLE/cleanup):** event card with intent `uncertain` is un-committable (default event mode→create); date guardrail ignores an uploaded doc's own age (old scans → this year); `commit.ts:347/380` re-fetch full doctor/type list per card (hoist).
- **`surfaceContext`** still client-asserted free text (prompt-injection) — resolve server-side from an entity id when auth is real.
- **Log-path latency (deferred):** navigate-first → run extraction in background → "Extracting…" state is still the proper fix (session starts `pending`).
- **Pending design.md doc-fixes:** (§6.12/§4:243) form date defaults browser-local; (§6.5) Notes-omit-when-empty; (§6.7 vs §9.4) Report Outcomes vs Linked-context; (§6.8) "WATCH" isn't a status. **Phase D carryovers:** inline-field Selects miss `items`; list-card refs inert; periwinkle dark-mode (v1.5).

*Keep this file under 80 lines. Last Session and Next Steps replace on each `/handoff` — never append.*
