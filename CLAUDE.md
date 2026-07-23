# arogya

A personal health knowledge base for adult children remotely managing aging parents. Structured medical record (the "vault") combined with an AI synthesis layer (the "thinking partner inside") that reasons across the full record to surface patterns, current state, care gaps, and questions worth raising with doctors.

v1 ships with stub auth, single-patient, desktop-only. Every entity is structured and traceable; the AI agent family operates over that vault with strict citation discipline.

**North star (Phase 1.3 demo moment):** *"His dizziness episodes in the last month cluster on mornings after he skipped the BP medication prescribed by Dr. Sharma. The cardiologist also raised the dose on April 3rd..."* — the change-log schema, cross-doctor synthesis, and citation discipline all exist to make synthesis like this possible. When a tradeoff call is unclear, ask: does this make that demo moment more or less achievable?

---

## Session continuity

`docs/progress.md` — injected into your context automatically at every session start. Shows current Phase A status, last session summary, and next steps. **Run `/handoff` before ending any substantial session** to keep it current.

`docs/decisions.md` — append-only log of every significant decision: what was decided, alternatives considered, reasoning. Read it before making any call that touches prior decisions. Never edit past entries.

---

## The design doc is the source of truth

The full product, technical, and design spec lives at `docs/design.md` (3,283 lines, 10 phases). **Read the relevant section before starting any non-trivial task.** Don't infer from filename or partial context.

| When working on...                                   | Read these sections                                            |
|------------------------------------------------------|----------------------------------------------------------------|
| Anything UI-related                                  | Phase 6 (wireframes), Phase 7 (design system), Phase 3 (IA)    |
| Database schema, migrations, queries                 | Phase 4 (entities), Phase 9.2 (data layer)                     |
| AI agent code (any agent)                            | Phase 5 (capabilities), Phase 9.3 (integration), Phase 10.3 (prompts) |
| File uploads, extraction, source-file linking        | Phase 5.4 (extraction), Phase 9.4 (file handling), Phase 6.11 (confirmation UI) |
| Auth, environment, deployment, security              | Phase 9.5 (deployment), Phase 9.6 (cross-cutting), Phase 1.4 (scope) |
| Build sequencing decisions                           | Phase 10.2 (build sequencing)                                  |
| What's in v1 vs. v1.5 vs. v2                         | Phase 10.1 (scope and DoD), Tier 3 lists in Phase 6            |
| Brand voice, tone, microcopy                         | Phase 7.1 (foundations), Phase 10.3 (synthesis prompt)         |

Claims like "the wireframes specify..." or "Phase 5 establishes..." are facts — verify rather than inferring.

---

## Current build phase: Phase A — Foundation

Per Phase 10.2. Don't build UI surfaces, agent code, or anything downstream until A is complete. After A: Phase B (Agent Infrastructure).

Phase A checklist:

1. **Project init** — Next.js 14+ App Router, TypeScript strict, Tailwind, shadcn/ui, Drizzle, `lib/env.ts` Zod-validated
2. **DB schema** — all 14 tables per Phase 4 + 9.2, files in `db/schema/`, barrel-exported via `db/schema/index.ts`
3. **Initial migration** — generated via `drizzle-kit generate`, applied to `arogya-dev` Supabase
4. **Stub auth** — `lib/auth.ts` exports `getCurrentUser()` + `getCurrentPatient()` returning hardcoded values (Phase 9.6)
5. **Seed** — demo user (Avi) + patient (Ramesh), identity only, no medical data
6. **Query helpers** — per-entity files in `db/queries/`
7. **Supabase Storage** — `arogya` bucket, patient-namespaced paths per Phase 9.4

---

## Before starting any task

1. Find the phase that owns this task (use the table above) and read those sections end-to-end
2. Check git log / filesystem for prior work
3. For non-trivial tasks, surface the plan before implementing

---

## Architectural rules that span phases (tripwires)

These get violated easily when you only read one phase. They're load-bearing:

- **Synthesis always sees the full vault.** No RAG in v1 (Phase 5 foundational principles).
- **Briefs are excluded from vault context.** Enforced in `lib/agents/_shared/vault-context.ts` with a default-true exclusion flag, even though briefs aren't a v1 entity (Phase 5.7 + 9.3).
- **Prior insights in vault context are for deduplication only, never evidence.** The insight generator must reason fresh from raw data (Phase 5.6).
- **All auth flows through `getCurrentUser()` / `getCurrentPatient()`.** Never read `request.cookies` directly. The v1.5 swap is inside the helper bodies only (Phase 9.6).
- **Extraction never auto-writes.** Always human-in-the-loop confirmation screen (Phase 5.4).
- **State entities use change logs, not overwrites.** A dose change appends a `medication_changes` row; the medication's `current_*` fields update in place (Phase 3 + 4).
- **Backlinks are derived at render time, not stored.** Query "what references X," don't maintain a list (Phase 3).
- **Insight generation is event-driven, debounced, fire-and-forget.** No background polling, no job queue in v1 (Phase 5.6, 9.3).
- **Check Phase 10.1's "explicitly does NOT ship in v1" list before adding any feature.** Easy to over-build (search, multi-patient, saved briefs, RAG, etc.); the exclusion list is the fence.

---

## Working conventions

**Prefer prescriptive doc sections over inference.** Phases 4, 9.2, 9.3 are intentionally prescriptive (drift here is expensive). Follow exactly. Where the doc delegates ("agent picks the palette"), use sensible conventions.

**Call out deviations explicitly.** If the doc's spec doesn't work in practice, surface it. Either the code adapts to the doc, or the doc gets updated — never let them drift apart.

**Confirm before destructive operations.** Migrations that drop columns, file deletions, schema changes, force-pushes. Single-confirmation pattern: explain, ask, execute.

**Never commit without explicit approval.** Do not run `git commit` unless the user asked for it in the current exchange. Approval to commit one batch of work does not carry forward to later work in the same session — each commit needs its own ask. Finish the work, verify it, then offer to commit.

**Voice consistency matters.** All user-facing copy (UI strings, error messages, agent prompts, AI outputs) follows Phase 7.1. See voice quick reference below.

**Citation discipline is non-negotiable.** Synthesis hard rule 4 is load-bearing. Render as `§ entity-type:specific-id` (vault) or `↗ source-name` (external). Never strip for terseness.

---

## Quick reference — the 6 agents

| # | Agent             | Model  | Streaming | Where                                                        |
|---|-------------------|--------|-----------|--------------------------------------------------------------|
| 1 | Synthesis         | Opus   | yes       | Chat, full health scan, doctor brief, investigate, prep      |
| 2 | Extraction        | Sonnet | no        | Upload (vision) + quick-log text                             |
| 3 | Router            | Haiku  | no        | Every chat input (classifies log vs. question)               |
| 4 | Insight generator | Opus   | no        | Event-driven, debounced, fire-and-forget                     |
| 5 | Onboarding        | Sonnet | yes       | 8-phase interview, live-populating patient page              |
| 6 | Auto-titling      | Haiku  | no        | After first AI reply in a chat session                       |

Doctor brief is a synthesis-agent capability (`delta` or `handoff` mode), not a separate agent (Phase 5.7).

Use the latest Claude model generation when wiring API code; verify current model IDs against Anthropic's docs before pinning.

---

## Quick reference — the 14 tables

**State entities** (paired `*_changes` tables except where noted):
- `patients` (root; no change log)
- `doctors` + `doctor_changes`
- `conditions` + `condition_changes`
- `medications` + `medication_changes`
- `allergies` + `allergy_changes`
- `lifestyle_profiles` + `lifestyle_changes` (singleton per patient)
- `family_history` (no change log; entries are inline-edited)

**Event entities** (immutable timestamps; no change logs):
- `visits`
- `lab_reports` + `lab_results` (one report → many results)
- `vital_readings`
- `symptom_types` + `symptom_episodes` (one type → many episodes)
- `reports`
- `journal_entries`

**Derived:**
- `insights` (AI-generated; polymorphic refs via jsonb)

**Infrastructure:**
- `extraction_sessions` (connects upload → extraction output → confirmation; Phase 9.4)

Schema files in `db/schema/`, one per entity, barrel-exported. Every `patient_id` FK cascades from `patients`.

*Once `db/schema/` exists, prefer reading those files over this block; delete this section when it becomes redundant.*

---

## Brand voice quick reference (Phase 7.1)

**Mood:** calm, careful, capable → **trustworthy**.

**Tone:** warm, plain, direct. Like a competent family doctor talking to an educated patient.

**Pronouns:** AI says "I"; user is "you"; patient is named (or "your father / your mother") — never "the patient."

**Phrases to use:**
- "I'd want to flag..."
- "This is consistent with..."
- "Worth raising at the next visit."
- "There's not enough data here to..."
- "Consider..."

**Phrases never to use:**
- "As an AI..." (robotic disclaimer)
- "I'm sorry, I don't have access to..." (shifts blame)
- "Please consult your doctor." (meaningless boilerplate — it's the implicit context for everything)
- "Great question!" (sycophantic)
- "Let me think about that." (performative)
- Celebratory language ("Great job logging that!")

**Hard rules across all AI output:** never diagnose, never prescribe, never recommend treatment. Frame as questions to raise or patterns to be aware of.

---

## Code conventions

Per Phase 9.1 + 9.2 + 9.6:

- **TypeScript strict mode everywhere.** No `any`, no `@ts-ignore`, no `@ts-expect-error`.
- **Database:**
    - Tables: plural snake_case (`medications`, `medication_changes`)
    - Columns: snake_case (`patient_id`, `started_on`)
    - TS references: camelCase (Drizzle handles the mapping)
    - Type aliases: PascalCase (`Medication`, `NewMedication`)
- **File structure:**
    - `db/schema/` — one file per entity, barrel-exported
    - `db/queries/` — per-entity helpers
    - `db/migrations/` — Drizzle Kit generated
    - `lib/agents/` — one file per agent
    - `lib/agents/_shared/` — `vault-context.ts`, serializers, schemas, errors, prompt-fragments
    - `lib/auth.ts`, `lib/env.ts`, `lib/datetime.ts`, `lib/storage.ts`, `lib/logger.ts`
    - `app/api/` — Next.js API routes (RESTful where natural, RPC-style for actions)
    - `app/` — App Router pages
    - `components/ui/` — shadcn/ui primitives
    - `components/` — custom arogya components
- **Forms:** React Hook Form + Zod resolver for multi-field; useState + onBlur for inline single-field edits.
- **PHI-aware logging.** `lib/logger.ts` wraps console; refuses entity content, prompt content, AI output content, names, DOBs, addresses, phone numbers. Log error codes and metadata only.

---

## Things to ask about, never assume

- **Color values, typography, spacing scales.** Phase 7 delegates these — pick a palette aligned with 7.1 / 7.2, but surface the choice before applying it widely.
- **Agent prompt edits.** The synthesis prompt in 10.3 is load-bearing. Don't modify silently; surface proposed changes.
- **Schema changes after Phase A.** Schema is locked in Phase 4 + 9.2. Additions or modifications need explicit sign-off.
- **Anything labeled v1.5 or v2 in the doc.** Don't implement deferred features without confirmation, even if easy.
- **Destructive operations.** Migrations dropping columns, file deletions, force-pushes — confirm first.
- **Architectural deviations from Phase 9 patterns.** Surface rather than work around.

---

## Demo personas

Stub-auth seed identity only — no hardcoded medical data. Real medical data gets entered via onboarding.

- **User (account holder):** Avi Sharma — US-based, tracking his father remotely
- **Patient:** Ramesh Sharma — 77, M, Father, Pune, India

---

## Tooling

- **Package manager:** npm (locked per Phase 9.1)
- **Local dev:** `npm run dev` against `arogya-dev` Supabase
- **Schema work:** `npx drizzle-kit generate` (create migration), `npx drizzle-kit migrate` (apply), `npx drizzle-kit studio` (local inspection)
- **Type check:** `npx tsc --noEmit` (CI runs on every PR)
- **Lint:** `npx eslint .`
- **Database admin:** Supabase dashboard for migration review
- **Env:** `.env.local` (gitignored), `.env.example` (committed). Required vars per Phase 9.5: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `NEXT_PUBLIC_APP_URL`.

---

## When in doubt

Read the design doc section closest to the task. The doc answers most questions. If it doesn't, ask — don't guess.