# arogya — Session Context

> Loaded automatically at every session start. Update with `/handoff` before ending a session.
> Full decision log: `docs/decisions.md`

---

## Current Phase: B in progress — items 1-4 complete, items 5-10 (agents) pending

### Phase A Checklist (complete)
- [x] 1-7. Foundation shipped (see prior handoff in decisions.md 2026-05-11/12 entries).

### Phase B Checklist
- [x] 1. Vault context builder — `lib/agents/_shared/vault-context.ts` per 9.3. Default-true `excludeBriefs` flag, `includeInsights` mode, optional `surfaceContext`, third `now: Date = new Date()` param for per-request determinism.
- [x] 2. Per-entity serializers — 14 files in `lib/agents/_shared/serializers/` + `format.ts` util + barrel. Pure functions, two exports per file (`serializeXxx` + `xxxSlug`). Slug index threaded from vault-context.
- [x] 3. Agent error types — `lib/agents/_shared/errors.ts`. `AgentError` with discriminated `code` per 9.3:2452-2459.
- [x] 4. Zod output schemas — `lib/agents/_shared/schemas.ts`. Router, extraction, insight gen, onboarding outputs per 10.3.
- [ ] 5. Synthesis agent (Opus 4.7, streaming) — chat / full health scan / doctor brief.
- [ ] 6. Insight generator (Opus 4.7, non-streaming, debounced fire-and-forget).
- [ ] 7. Router (Haiku 4.5, non-streaming, no vault context).
- [ ] 8. Extraction (Sonnet 4.6, non-streaming, vision + text).
- [ ] 9. Onboarding interview (Sonnet 4.6, streaming, 8-phase).
- [ ] 10. Auto-titling (Haiku 4.5, non-streaming).

### Last Session
- 2026-05-13 — shipped Phase B items 1-4. 6 query helpers added (5 change-log `forPatient` + `labResults.forPatient`), co-located with parent entity files. 14 serializer files + `format.ts` (slugify, sortStable, citationFor, computeAge) + barrel. `vault-context.ts` orchestrator does parallel loads, slug-index build with `-2/-3` dedup in id-ASC order, filters reports to `status ∈ (ready, committed)` and insights to `status ≠ dismissed`, joins non-empty sections with `\n\n`, appends `<surface_context>` tag when provided.
- `scripts/check-vault-context.ts` smoke runner asserts non-empty output, starts with `# Patient`, contains seed name, ISO DOB, computed age, byte-identical between two runs with same `now`, plus brief-exclusion regression assertion (`excludeBriefs: true === false` in v1, load-bearing when Brief lands in v1.5 per 10.1:2948). All passing. `npm run vault-context:check`. `tsc --noEmit` clean. `eslint` clean.
- **/check review surfaced 3 follow-ups, all landed.** Router confidence enum corrected to `"high" | "medium" | "low"` per 5.5:833-837 canonical (10.3:3214 is an oversimplification — doc fix to 10.3 pending). `server-only` placement deferred to Phase B cleanup with explicit TODO at top of `vault-context.ts` — push the guard down to `@/lib/env` when the first client component starts importing from `@/lib/*`. Brief-exclusion regression assertion added to smoke script.
- **Determinism contract:** `now: Date = new Date()` is the third param to `buildVaultContext`; per-request, not across time. No `Date.now()` / `new Date()` / `Math.random()` in serializers; re-sort with `id` ASC tiebreaker; omit empty sections + `updated_at` / `createdAt` from output. Enables Anthropic prompt caching downstream.
- **Citation slugs locked at `§ entity-type:slug`** (markdown pill). Phase 5.3's XML-tag example is stale; ignored. Collisions get `-2/-3` suffixes deterministically; semantic disambiguation (e.g. `med:amlodipine-5mg`) is v1.5 polish.
- **Brief-exclusion flag** is wired with default-true; no v1 data path; comment marks v1.5 entry point. Now regression-protected by smoke assertion.

### Next Steps
1. **Phase B item 5 — synthesis agent.** Install SDKs first (`@anthropic-ai/sdk`, `ai`, `@ai-sdk/anthropic`) per two-SDK split decision. Build `lib/agents/synthesis.ts` with the full system prompt from Phase 10.3:3055-3185 verbatim, model `claude-opus-4-7`, streaming via Vercel AI SDK's `streamText`. Wire `/api/chat` route. Pass `surfaceContext` from the chat surface. Resolve the patient-relationship gap (10.3:3064 prompts for "your father / your mother" — schema has no relationship field; fallback to `patient.name` in the prompt instructions).
2. **Phase B item 6 — insight generator.** `lib/agents/insight-generator.ts`, `claude-opus-4-7`, non-streaming, debounced fire-and-forget per 9.3:2466-2497. Uses `buildVaultContext(patientId, { includeInsights: "deduplication-only" })`. First place where `prompt-fragments.ts` (shared hard rules between synthesis and insight gen) actually pays off — extract then, not preemptive.
3. **Phase B item 7 — router agent.** `lib/agents/router.ts`, `claude-haiku-4-5`, non-streaming, no vault context, returns `routerOutputSchema`-validated JSON (now 3-bucket confidence). Smallest agent; useful warm-up before extraction/onboarding land.

### Open Questions / Blockers
- **TODO before Phase C:** push `import "server-only"` down to `@/lib/env` for a uniform credential boundary. Triggered when first client component imports from `@/lib/*`. TODO comment placed at top of `lib/agents/_shared/vault-context.ts`.
- **Doc-fix pending (not blocking):** `docs/design.md` 10.3:3214 should be updated to match 5.5's three-bucket confidence enum. Cleanup pass on the doc, separate from code work.

---
*Keep this file under 80 lines. Last Session and Next Steps replace on each `/handoff` — never append.*
