# arogya — Session Context

> Loaded automatically at every session start. Update with `/handoff` before ending a session.
> Full decision log: `docs/decisions.md`

---

## Current Phase: Phase C item 2 done — item 3 next

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
- [x] 2. Medication form — shadcn/ui init (base-nova, stone base), `components/medications/medication-form.tsx`, `lib/schemas/forms/medication.ts` derived from API schema via `.extend()`, interim list page at `app/patient/[id]/medications/page.tsx`. Stone-only palette (sage/emerald/seafoam all read green; accent deferred to checkpoint 1).
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
- 2026-05-17 — **Phase C item 2 shipped.** shadcn/ui init (base-nova preset, stone base, Base UI primitives — `field`/`select`/`alert-dialog`/etc.; legacy RHF-coupled `form` primitive replaced by lower-level `Field` family). MedicationForm (RHF + Zod), 4 plan-mode decisions: skip linked-entity fields (Q2); include `brandName` paired with Name (Q3); interim minimal list page (Q4); sage accent (later reversed). API error shape pre-smoked (`details.{formErrors,fieldErrors}` confirmed). `import "server-only"` pushed to `lib/env.ts`; tsx scripts use `--conditions react-server` for the no-op shim.
- 2026-05-17 — **`/check` review → 9 fixes landed.** W1+E2: form schema → `lib/schemas/forms/medication.ts`, derived from `createMedicationSchema` via `.extend()`. W2: field labels uppercase-mono, helpers normal-case (inverted from initial impl). W3: breadcrumb leading `/` + truncation comment. E1: submit factory flattened into two named handlers sharing `postMedication()`. E3: `setError` whitelisted against `formKeys`, unknowns route to banner. E4: declarative POST body using `JSON.stringify`-drops-undefined. E5: `lib/datetime.ts` extracted with `todayInTimezone(tz)`; both call sites (new-page, discontinue) updated. E6: unused sidebar/chart palette tokens stripped (incl. saturated blue 7.2 anti-pattern). E7: `shadcn` CLI → devDependencies. Required `.next/` clear + dev restart after npm reshuffle for module resolution.
- 2026-05-20 — **Palette reset → stone-only.** First-pass implementation used emerald-700; recommended sage `oklch(0.5 0.055 155)` also read too green; dusty seafoam (third option) would have hit the same wall. All three triggered 7.2 anti-patterns ("not wellness-green," "no green for positive feedback"). `--primary` reset to stone-700, accent decision deferred to Phase C checkpoint 1 (after items 3-4) when multiple surfaces exist to compare candidates. Cancel button → `variant="link"` (text-link, not ghost-button). design.md 6.12:1821 + decisions.md 2026-05-20 capture the deferral + allowed candidates (muted terracotta / dusty rose / warm brown / aged linen / non-green eucalyptus) + the meta-lesson.
- **Working tree status:** Phase C item 2 + all /check fixes + palette reset are uncommitted. Smoke green (typecheck, lint, vault-context:check, citation-parser:check, end-to-end curl). No commits since `90e8f4e` (Phase C item 1).

### Next Steps
1. **Commit current working tree** — Phase C item 2 + /check fixes + palette reset. Three logical commits possible (item 2 impl, /check fixes, palette reset) but a single squashed commit is also fine.
2. **Phase C item 3 — Medications list page** (state list template per 6.4): section-grouped cards (ACTIVE expanded, DISCONTINUED collapsed), filter pills, floating Ask AI button. Expand the interim `app/patient/[id]/medications/page.tsx` (don't replace).
3. **Phase C item 4 — Medication detail page** (state entity detail template per 6.5): five sections, ~720-800px width, `…` menu (Discontinue/Delete). Click-through from the list page rows lands here.

### Open Questions / Blockers
- **Brand accent decision deferred to Phase C checkpoint 1** (post-items-3-4). See decisions.md 2026-05-20 for allowed candidates + the explicit green-register disallow.
- **API smoke doc follow-up:** capture the Phase C item 1 + 2 curl sequences in `docs/api-smoke.md`; still deferred.
- **Server-side error logging missing across all routes** (incl. pre-existing `/api/chat`). Per 9.6:2845. Worth landing minimal `lib/logger.ts` (PHI-aware, error-code + metadata only) before item 4 produces real failures.
- **SDK workaround:** `@ai-sdk/anthropic` 3.0.x missing `cacheReadInputTokens` at top level. Smoke script reads snake_case directly. Pending upstream fix.

---
*Keep this file under 80 lines. Last Session and Next Steps replace on each `/handoff` — never append.*
