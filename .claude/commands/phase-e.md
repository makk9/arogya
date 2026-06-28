Check Phase E completion status by inspecting the filesystem. Report each item as ✅ done, 🔶 partial, or ❌ not started. Check actual files — don't assume.

Phase E is **AI-Driven Flows** — the six differentiating capabilities that make arogya specifically arogya. Per design.md 10.2 it's last because it depends on everything before. **The clinical schema groundwork already shipped in Phase A** — confirm it's still there before flagging gaps: `reports.status` enum (`db/schema/report.ts`), nullable `source_report_id` on the 7 derivable entities (`db/schema/{medication,condition,lab,vital,visit,symptom,journal}.ts`), and `db/schema/extraction-session.ts`. So Phase E is agents + pipeline + surfaces, **no new clinical schema**.

Load-bearing tripwires for this phase (flag any violation):
- **Extraction NEVER auto-writes** — always a human-in-the-loop confirmation screen before any DB write (5.4).
- **Insight generator: prior insights are dedup-only, never evidence** — must reason fresh from raw vault data (5.6 echo-chamber warning). Loaded via `buildVaultContext(..., { includeInsights: "deduplication-only" })`.
- **Insight gen is debounced, fire-and-forget** — no job queue, no background polling in v1 (5.6, 9.3).
- **Model IDs** (9.3): extraction Sonnet 4.6 · router Haiku 4.5 · insight-gen Opus 4.7 · onboarding Sonnet 4.6 · auto-titling Haiku 4.5 · doctor brief = synthesis Opus 4.7. Verify current IDs per CLAUDE.md.

**Surface prerequisites — check these first; they block downstream items:**

- **E0a. Dashboard (6.1)** — `app/patient/[id]/page.tsx` or a dashboard route: chat-centerpiece + status strip + suggested actions + recent insights feed. **Onboarding (E4) exits here and the activation banner is onboarding's only launcher (6.3).** Must exist before E4. Activation-banner *logic* is Phase F2; the shell is Phase E.
- **E0b. Full-screen chat + chat-session persistence (6.2/6.5)** — auto-titling (E6) and findable briefs (E7) need persisted, titled, reopenable sessions; today only the ephemeral push-drawer exists (`components/chat/*`, no chat-session table). **Requires a schema addition (`chat_sessions` [+ messages] table) → needs explicit sign-off per CLAUDE.md before building.** Flag if built without sign-off, or if D2 chat deferrals (grounding header + per-message `grounded in →`) are still open.

Phase E checklist — the 6 agents/capabilities:

1. **Extraction agent + router wiring** — `lib/agents/extraction.ts` (Sonnet 4.6, text + vision, JSON `extractions[]` with `intent`/`matched_entity_id`/`extracted_data`/`ambiguities`/`source_excerpt`, three buckets, matching dictionary via vault context with `includeInsights:"none"`, never-fabricate, empty-array on total failure). Zod schema in `lib/agents/_shared/schemas.ts`. **Router wiring (D3 carryover):** the Haiku router (already built, `lib/agents/router.ts`) must run on every chat input *before* `runSynthesis` — `question`→synthesis, `log`→extraction, `ambiguous`→inline 2-button disambiguator. Compound input = log first, forward to synthesis post-confirm (5.5).

2. **File upload pipeline (9.4)** — `app/api/files/sign/route.ts` (signed PUT URL + path) + `app/api/files/process/route.ts` (creates Report status=`extracting` + `extraction_sessions` row → `runExtraction` → session `ready_for_confirmation`/`failed`). `lib/storage.ts`: `getSignedUrl`/`uploadFile`/`deleteFile`. `arogya` bucket, patient-namespaced paths. `FilePreview` client component (image lightbox / PDF iframe + `1 of N`). Report created up-front so the file survives extraction failure.

3. **Extraction confirmation surface (6.11)** — `app/patient/[id]/extract/[sessionId]/page.tsx` (reads the session row). Split-panel (source left ~40% sticky / cards right ~60% scroll); ambiguity prompts at card top w/ inline-resolve chips (block `Confirm` until resolved, `(pending)` field state); new-vs-update toggle per card (flips preview); card-state pill (`confident`/`needs your call`); per-card Confirm/Discard/`Edit manually instead`→form (6.12); `Confirm all · N` (greys to `· N blocked`); compound group-by-type headers; failure state (dashed empty + "things that usually help" + `replace file →`). Commit writes entities with `source_report_id` + report status→`committed`, then fires debounced insight-gen. **NO floating Ask AI here.** Receives BOTH upload-path and quick-log-path extractions.

4. **Onboarding interview (agent 5.8 + surface 6.3)** — *depends on E0a.* `lib/agents/onboarding.ts` (Sonnet 4.6, 8 phases in order, dual output per turn: streamed reply + structured-extraction JSON). **Live-transparency, NO confirmation gate** — patient page populates right-side in real time, cards inline-editable, ambiguities resolved in conversation. Interruptible/resumable per phase, no completeness gate, escape chips (`I don't know`/`Upload instead`/`Skip for now`). Phase-1 identity updates the header live. Completion → offer first full health scan (routes to full-screen chat) else dashboard. Surface = chat left + live patient page right, `✦` AI marker, visuals match 6.2.

5. **Insight generator (agent 5.6 + endpoint 9.3)** — `lib/agents/insight-generator.ts` (Opus 4.7; 5 locked types: correlation→`pattern`, threshold→`trend`/`improvement`, interaction, gap, risk; conservative severity, empty-output default; prior 90-day insights dedup-only). Fire-and-forget `app/api/insights/generate/route.ts` with 30s debounce (`getRecentInsightRun`), no await on caller. Triggers wired after significant entity creations incl. extraction-commit + form saves. **Replaces the seeded demo insights — ZERO surface change** (feed 6.8 + detail 6.9 shipped in Phase D). This is the 1.3 north-star demo-moment generator.

6. **Auto-titling (6.2/9.3)** — *depends on E0b.* Haiku 4.5 call after the first AI response in a session; input = first user msg + first AI reply; output 3-6 word title → `chat_sessions.title`. Non-streaming direct SDK.

7. **Doctor brief capability (5.7)** — **NOT a separate agent** — a synthesis-agent variant in `lib/agents/synthesis.ts` (add `delta`/`handoff` brief-mode addendum, clinical register). Delta vs handoff output structures; 1-2 inline clarifying Qs; specialty-selective filtering; citations VISIBLE in chat reply / STRIPPED in PDF. `Download PDF` action → PDF gen (citation-strip + clean clinical black-on-white + "Generated from N data points…" footer). No saved Brief entity (lives in the chat session — needs E0b). Flag if it was built as a standalone agent or surface — that's over-scope.

For each item found, also check:
- TypeScript strict — no `any`, no `@ts-ignore`, no `@ts-expect-error`.
- Auth via `getCurrentPatient()` / `getCurrentUser()` on every server component + API route (never reading cookies directly).
- Agents go through `buildVaultContext` (the canonical serializer) — extraction with `includeInsights:"none"`, insight-gen with `"deduplication-only"`. Flag direct DB reads that bypass it.
- Agent calls wrapped in typed `AgentError` (`lib/agents/_shared/errors.ts`); surfaces degrade gracefully, never crash.
- Structured outputs (extraction, insight-gen, onboarding, router) Zod-validated against `_shared/schemas.ts`; failed parse → safe fallback.
- **PHI-aware logging** — `lib/logger.ts` only; no entity/prompt/AI-output content, names, DOBs in logs (this is the phase where that's easiest to violate).
- `surfaceContext` resolved server-side from an entity id, not client-asserted free text (E3 prompt-injection surface).
- No hardcoded color literals — semantic tokens only (periwinkle accent is locked; pills carry the accent tint, external `↗` stay neutral stone).
- New-schema additions (chat sessions) confirmed signed-off, not silently added.

**Phase E milestone:** all 6 agents work and all 13 surfaces are integrated — onboarding populates a real vault, uploads extract → confirm → commit with source links, insights generate for real (seed data retired), briefs export to PDF, chat sessions auto-title. After this, only Phase F polish remains.

After the checklist, give a single clear next action: which Phase E item to build this session, respecting the dependencies (E0a before E4; E0b before E6/E7; extraction E1 before its confirmation surface E3; insight generator E5 is most useful once real entity data exists from E1–E4).
