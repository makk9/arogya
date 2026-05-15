# arogya — Session Context

> Loaded automatically at every session start. Update with `/handoff` before ending a session.
> Full decision log: `docs/decisions.md`

---

## Current Phase: B in progress — items 1-5 complete, 6-7 remaining

### Phase A (complete)
- [x] 1-7. Foundation shipped (see decisions.md 2026-05-11/12 entries).

### Phase B — Agent Infrastructure
- [x] 1. Vault context builder — `lib/agents/_shared/vault-context.ts`. `excludeBriefs` default-true, `includeInsights` mode, `surfaceContext`, deterministic `now` param.
- [x] 2. Per-entity serializers — 14 files in `lib/agents/_shared/serializers/` + `format.ts` + barrel.
- [x] 3. Agent error types — `lib/agents/_shared/errors.ts`. `AgentError` with discriminated `code`.
- [x] 4. Zod output schemas — `lib/agents/_shared/schemas.ts`. All agent outputs per 10.3.
- [x] 5. Synthesis agent — `lib/agents/synthesis.ts` + `app/api/chat/route.ts`. Opus 4.7, streaming, verbatim prompt, cache hit verified (3150 tokens), three-modes-from-prompt.
- [ ] 6. Router — `lib/agents/router.ts`. Haiku 4.5, non-streaming, no vault context, 3-bucket confidence.
- [ ] 7. Citation parser — `components/ai-message.tsx`. Markdown post-processor for `§` and `↗` rendering.

### Phase C — First Vertical Slice (Medication, next after B)
- [ ] 1. Medication API routes — list, create, read, update, delete, `/discontinue`
- [ ] 2. Medication form — shadcn/ui init happens here (first component); form template per 6.12
- [ ] 3. Medications list page — state list template per 6.4
- [ ] 4. Medication detail page — state entity detail template per 6.5
- [ ] 5. Inline editing + change-log entry creation
- [ ] 6. Floating Ask AI button on Medication pages
- [ ] 7. Citation pill rendering for `§ med:amlodipine` (builds on Phase B citation parser)

### Phase D — Replicate Pattern (after C)
Other state entities · All event entities · Patient profile · Insights feed (placeholder)

### Phase E — AI-Driven Flows (after D)
Extraction agent + upload pipeline + confirmation surface · Onboarding (agent + surface) · Insight generator · Auto-titling · Doctor brief

### Phase F — Polish

---

### Last Session
- 2026-05-14 — Phase B item 5 shipped. Synthesis agent end-to-end with cache hit verified. API conventions established (`lib/api/error.ts`, `lib/schemas/api/`, auth via `getCurrentPatient()`). `/check` pass: 4 fixes landed.
- **Phase B scope corrected (2026-05-15):** design doc Phase B is items 1-7 only (Router + Citation parser remain). Insight generator, Extraction, Onboarding, Auto-titling → Phase E (depend on real entity data + UI surfaces from C/D). progress.md updated to reflect correct sequence.

### Next Steps
1. **Phase B item 6 — Router.** `lib/agents/router.ts`, Haiku 4.5, non-streaming, no vault context. Returns `routerOutputSchema`-validated JSON (3-bucket confidence). Direct Anthropic SDK call. Small — good warm-up session.
2. **Phase B item 7 — Citation parser.** `components/ai-message.tsx`, markdown post-processor for `§ entity-type:slug` pills and `↗ source-name` external links. Popover on click. Gates Phase C item 7.
3. **Phase C begins** — `shadcn/ui` init first, then Medication API routes.

### Open Questions / Blockers
- **TODO before Phase C:** push `import "server-only"` to `@/lib/env` when first client component imports from `@/lib/*`. TODO comment in `vault-context.ts`.
- **Doc-fixes pending (non-blocking):** design.md 10.3:3214 (confidence enum), 3064 (relationship phrasing), 9.3:2395 (stale model ID).
- **SDK workaround:** `@ai-sdk/anthropic` 3.0.x missing `cacheReadInputTokens` at top level. Smoke script reads snake_case directly. Pending upstream fix.

---
*Keep this file under 80 lines. Last Session and Next Steps replace on each `/handoff` — never append.*
