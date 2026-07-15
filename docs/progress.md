# arogya — Session Context

> Loaded automatically at every session start. Update with `/handoff` before ending a session.
> Full decision log: `docs/decisions.md`. Completed-phase detail: git history + decisions.md.

---

## Current Phase: Phase E — AI-Driven Flows (active). E1+E2+E3 ✓ + entity amendment through the agent (`68bb880`) + 6 regression fixes (`b455f15`). **NEXT: full run-through test of E3 + agent capabilities, THEN E5 insight-gen.** E0a, E4, E7 remain.

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
- [x] **E3. Confirmation surface (§6.11)** — ✓ COMMITTED (`d263b10`+`338ae67`); `verify-ui` green (24/24). Replaced the stub with the real split-panel `components/extract/extraction-confirmation.tsx` (source left / cards right, group-by-type headers, ambiguity chips block Confirm, new-vs-update toggle + `confident`/`needs your call` pill, per-field inline edit, per-card Confirm/Discard/`Edit manually instead`, `Confirm all · N`→`· N blocked`, failure state + `replace file →`, NO floating Ask AI). **Commit engine `lib/extraction/commit.ts`** (server-only) — the ONLY extraction→vault write: CREATE for all 8 types (snake→typed, never-fabricate, enum-drop, composite BP/ref-range split, free-text doctor/purpose→notes, med category→allopathic / allergy category→other defaults); UPDATE for 4 state types via change-log/PATCH (event types always create, §5.4:791); `source_report_id` on the 7 carrying types. `POST /api/extract/[sessionId]/commit` (per-card + `Confirm all`, `finalize`→`markCommitted` flips session+report→`committed`; **E5 insight-gen seam**). "Edit manually" → `lib/extract/draft.ts` sessionStorage prefill (**consumed by all 8 /new forms**). **+ Amendment (`68bb880`, decisions.md 2026-07-14):** UPDATE now covers lab/visit/symptom (append/correct in place, §6.7); vitals immutable; deletions declined as an in-chat `notice` (no stub); readable lab-markers card + `old→new` diffs. **Deviations:** Confirm-all → patient profile (no E0a); toast + §6.2:1197 inline-Logged still deferred.
- [ ] **E5. Insight generator (§5.6/9.3).** `lib/agents/insight-generator.ts` Opus; 5 locked types; conservative severity; empty-output default; priors dedup-only. Fire-and-forget `/api/insights/generate`, 30s debounce. Triggers after entity creations + extraction-commit. Replaces seed insights, ZERO surface change. The §1.3 north-star generator.
- [ ] **E4. Onboarding (§5.8/6.3).** *Needs E0a.* `lib/agents/onboarding.ts` Sonnet, 8 phases, dual output, live-transparency NO confirm gate, escape chips, completion→offer health scan.
- [ ] **E7. Doctor brief (§5.7).** *Unblocked by E0b.* synthesis variant (`delta`/`handoff` addendum, clinical register); citations visible in chat / STRIPPED in PDF; `Download PDF` → PDF gen + footer. Lives in the chat session, no Brief entity.

**Carryover audits queued (decisions.md):** broaden `outcomesForReport` to 7 `source_report_id` entities; journal/insight `linked_entities` AI-tagging; resolve `surfaceContext` server-side from entity id (E3 prompt-injection); vital chat-quick-log; symptom↔condition dedup; Report source-file upload/PDF/`status`; weight `history→`; CONTACT/primary-language cols; rail Dashboard/RECENT links (need E0a); rail-expansion enhancement (decided 2026-06-24, capped per-section preview, not built).

### Phase F — Polish

---

### Last Session (2026-07-14 → 07-15)
- **6 code-review regressions FIXED + committed** (`b455f15`, decisions.md 2026-07-14): synthesis citations for chat-committed entities (stubs in slug-index, out of timeline); domain-error→per-card block (no batch 500); last-card-discard no longer strands (finalize-only `{cards:[],finalize:true}`); failed/discarded log cleanup + chat error/retry; entity-less stubs stay visible on timeline; med-form enum prefill (OTC/other). Probe + verify-ui green.
- **Entity amendment through the agent BUILT + committed** (`68bb880`): create+update parity for lab/visit/symptom (vitals immutable, §4:433); `updateLabReport` (append missing markers + correct existing in place, preserve-unrestated-fields), `updateVisit` (correct date/doctor/reason/summary + append notes), `updateSymptomEpisode` (severity + notes). `commit.ts` `UPDATABLE_TYPES = STATE ∪ AMENDABLE_EVENT`.
- **Deletions declined as an in-chat reply** — new optional `notice` on the extraction output schema; `processQuickLog` returns `{kind:"declined"|"confirm"}`, creates **no** stub Report; quick-log route writes the advisory as an assistant turn, chat shows it inline (state changes like "stopped taking X" are still updates).
- **Confirmation legibility:** lab update card renders a readable Markers view (names target report; `1.9→1.5·correcting`; `4.2·new marker`) not a JSON blob; visit/symptom overwrite fields show `old→new` (page builds `labSnapshots`/`fieldSnapshots`; notes append, excluded).
- **Prompt + dictionary:** extraction prompt amendment rule + "Deletions and removals" section; `buildMatchingDictionary` now lists recent symptom episodes; **§5.4 doc-fix** (amendment carve-out) landed in design.md.
- **TWO `/check` passes** (spec + principal-eng): blocker (lab correction could null a value) fixed via preserve-value refactor; no-op guards, exact-match note dedup, decline-no-stub, `old→new` for visit/symptom, list-refresh on decline. All probe/browser-verified; tsc/eslint clean.

### Next Steps
1. **RUN-THROUGH TEST of E3 + all current agent capabilities BEFORE E5** (user ask). End-to-end in the real UI + live probes: quick-log/upload extraction → confirmation → commit; router classify (question/log/ambiguous); **amendment** (lab correct+append, visit/symptom field corrections, `old→new` cards); **delete-advisory** (in-chat decline); discontinue-via-log; edit-manually prefill (8 forms); citation resolution. Confirm it's all solid before building further. `verify-ui` + the `*:check` scripts are the tools.
2. **E5 insight generator** (§5.6/9.3; retires seed insights; the §1.3 north-star). Opus, 5 locked types, conservative severity, empty-output default, priors dedup-only. Fire-and-forget `/api/insights/generate`, 30s debounce; the extraction-commit-finalize **seam already exists** in the commit route. Triggers after entity creations + commit.
3. Then **E0a dashboard** → E4 onboarding, E7 brief.

- **Amendment follow-ups (low):** note-append cards don't show "adds-to existing" context; mixed-case `notice` (log + a decline) shown on confirmation banner but not persisted to chat; `updateVisit`/`createVisit`/`createSymptomEpisode` re-fetch full doctor/type list per card (hoist).
- **`surfaceContext`** still client-asserted free text (prompt-injection) — resolve server-side from an entity id when auth is real.
- **Log-path latency (deferred):** navigate-first → extract in background → "Extracting…" state (session starts `pending`).
- **Pending design.md doc-fixes:** (§6.12/§4:243) form date defaults browser-local; (§6.5) Notes-omit-when-empty; (§6.8) "WATCH" isn't a status. **Phase D carryovers:** inline-field Selects miss `items`; list-card refs inert; periwinkle dark-mode (v1.5).

*Keep this file under 80 lines. Last Session and Next Steps replace on each `/handoff` — never append.*
