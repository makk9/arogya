# arogya — Session Context

> Loaded automatically at every session start. Update with `/handoff` before ending a session.
> Full decision log: `docs/decisions.md`

---

## Current Phase: Phase C item 1 done — item 2 next

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
- [x] 1. Medication API routes — `app/api/medications/{route,[id]/route,[id]/discontinue/route}.ts` + `lib/schemas/api/medication.ts`. Path-less routes (auth-derived patientId), PATCH refuses clinical fields with per-field details, transactional discontinue with timezone-aware date, `invalid_state_transition` (409) error code added. 13/13 smoke green; /check fixes landed (enum drift, timezone, exhaustiveness, auth ordering).
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
- 2026-05-16 — **Phase B item 7 (Citation parser) shipped.** react-markdown + custom remark plugin + inert pills + tokenizer unit tests. Phase B complete.
- 2026-05-16 — **Phase C item 1 (Medication API routes) shipped.** Six routes (list/create/read/update/delete + discontinue). Three conventions locked: (a) path-less routes — `patientId` auth-derived, never path; (b) PATCH refuses clinical-event fields with per-field `details` guidance keyed by field name (saved to memory: error-response-teaching-surface); (c) `invalid_state_transition` (409) error code for state-machine violations (memory: state-transition-error-codes). Transactional discontinue writes a `medication_changes` row + mutates the parent atomically; date computed in the patient's IANA timezone via `Intl.DateTimeFormat`. `getCurrentPatient()` now returns `timezone`.
- 2026-05-16 — `/check` review found 4 fixes (E1 enum drift → Zod enums derive from `pgEnum.enumValues`; E2 timezone-aware discontinuedOn; E3 exhaustiveness on `MedicationDomainError.kind`; E4 auth-first ordering across PATCH/DELETE/discontinue). All four landed.
- 2026-05-16 — **Doc-fix pass:** design.md 6.12:1842 (add `*` to Dose/Frequency/Category); design.md 9.6:2761-2783 (path-less route examples + `invalid_state_transition` in error enum, `unknown` not `any`); CLAUDE.md stale "Aarav" note removed.

### Next Steps
1. **Phase C item 2 — Medication form + shadcn/ui init.** First component triggers shadcn/ui setup. Form template per design.md 6.12 (Name * · Dose * · Frequency * · Form · Started on · Prescribing doctor · Treats condition · Category * · Notes). React Hook Form + Zod resolver. POST `/api/medications`.
2. **Phase C item 3 — Medications list page** (state list template per 6.4): section-grouped cards (ACTIVE expanded, DISCONTINUED collapsed), filter pills, `+ Add medication`, floating Ask AI button.
3. **Phase C item 4 — Medication detail page** (state entity detail template per 6.5): five sections, ~720-800px width, `…` menu (Discontinue/Delete).

### Open Questions / Blockers
- **TODO before item 2:** push `import "server-only"` to `@/lib/env` when first client component imports from `@/lib/*`. TODO comment in `vault-context.ts`.
- **API smoke doc follow-up:** capture the Phase C item 1 curl sequence in `docs/api-smoke.md` (~10 min cleanup); deferred per plan.
- **Server-side error logging missing across all routes** (incl. pre-existing `/api/chat`). Per 9.6:2845. Worth landing minimal `lib/logger.ts` (PHI-aware, error-code + metadata only) before item 4 produces real failures.
- **SDK workaround:** `@ai-sdk/anthropic` 3.0.x missing `cacheReadInputTokens` at top level. Smoke script reads snake_case directly. Pending upstream fix.

---
*Keep this file under 80 lines. Last Session and Next Steps replace on each `/handoff` — never append.*
