Run a spec compliance review on recently completed work. Use this at two checkpoints only:
1. After all schema tables are written, before running `drizzle-kit migrate`
2. At the end of a Phase, before starting the next

Do the following:

**1. Identify what to review**
Check git diff and recent files to understand what was built this session.

**2. Load the relevant spec**
Read the design doc sections that govern this work (use the phase mapping from CLAUDE.md). Do not skip this step.

**3. Check spec compliance**
For each file or component reviewed, verify:
- Does it match the design doc exactly? Call out any deviations, even small ones
- Are all required fields, types, constraints, and relationships present?
- Does it follow the architectural rules in CLAUDE.md (tripwires section)?
- Is anything from the Phase 10.1 "does NOT ship in v1" list accidentally included?

**4. Check code quality**
- TypeScript strict compliance (no `any`, no `@ts-ignore`, no `@ts-expect-error`)
- Naming conventions: tables plural snake_case, columns snake_case, TS types PascalCase
- No orphaned files or dead code

**5. Principal-engineer review**
Read the changed code as if you were the most senior engineer on the team doing a thorough PR review. Be opinionated. Specifically interrogate:

- **Design & approach.** Is this the right solution to the problem, or just *a* solution? Is there a simpler shape — fewer moving parts, fewer files, fewer concepts — that achieves the same outcome? Has the author solved a hypothetical future problem instead of the actual one in front of them?
- **Abstraction & boundaries.** Is anything abstracted prematurely (one caller, speculative reuse)? Conversely, is anything copy-pasted that clearly wants to be shared? Are module boundaries coherent — does each file have a single, nameable responsibility? Are concerns leaking across layers (e.g., DB types in UI, agent logic in routes)?
- **Data flow & state.** Where does each piece of data originate, where is it transformed, where is it consumed? Are invariants enforced at the right boundary (schema, type, runtime check)? Is state duplicated anywhere it shouldn't be? Are there race conditions, ordering assumptions, or hidden temporal coupling?
- **Error handling.** Are errors handled at the boundary that owns the decision (don't swallow in libs, don't leak in UI)? Are failure modes named (`AgentError.code` discriminants, not stringly-typed)? Is anything silently caught? Are user-facing error messages voice-compliant (Phase 7.1)?
- **Correctness edge cases.** Null/empty/undefined inputs. Empty arrays, single-element arrays. Concurrent calls. Stale data. Time-zone and date-boundary behavior. Off-by-one. What happens on the second call, the hundredth call, the call after a failure?
- **Security & PHI discipline.** Any user input reaching the DB un-validated (Zod at boundaries)? Any PHI in logs, error messages, telemetry, or thrown exceptions? Any auth bypass — paths that don't flow through `getCurrentPatient()`? Any `patient_id` scoping missing on queries that could leak across patients (even though v1 is single-patient, the guard rails matter)?
- **Performance & resource use.** N+1 queries. Loading the whole vault when a slice would do (outside synthesis, which is intentionally full). Unbounded loops, unbounded retries, unbounded token use. Sync work that should be async; async work that should be awaited.
- **Testability & observability.** Could you write a test for this without rewriting it first? Pure functions where possible, side effects pushed to edges? Are decisions logged enough that a failure is debuggable from logs alone?
- **Naming & readability.** Does every identifier earn its name? Would a new engineer understand this file in 60 seconds? Any comments explaining *what* instead of *why*? Any clever code where boring code would do?
- **Consistency with the codebase.** Does this follow existing patterns in `lib/agents/_shared/`, `db/queries/`, `app/api/`? Or did the author invent a parallel convention? Drift is a slow tax — call it out.
- **Reversibility & blast radius.** If this is wrong, how hard is it to back out? Migrations, schema changes, prompt edits, and API contracts are sticky — apply extra scrutiny.

For each issue found, state: what it is, why it matters, and the specific fix. No vague "consider refactoring" — name the change.

**6. North star check**
One question only: does this work make the demo moment more or less achievable?
> "A personal health knowledge base for managing health. Structured medical record (the "vault") combined with an AI synthesis layer (the "thinking partner inside") that reasons across the full record to surface patterns, current state, care gaps, and questions worth raising with doctors.
> His dizziness episodes in the last month cluster on mornings after he skipped the BP medication prescribed by Dr. Sharma. The cardiologist also raised the dose on April 3rd."

**7. Report**
- ✅ Compliant items (brief)
- ⚠️ Deviations from spec (specific, with fix instructions, cite design doc section)
- 🛠️ Engineering concerns (principal-review findings — design, abstraction, correctness, security, performance, readability — each with the specific fix)
- ❌ Blockers — must fix before proceeding

Be precise. Cite the design doc section for every spec deviation. Do not give a passing grade to anything that contradicts the spec or that a principal engineer would block in review. If the work is genuinely clean across both axes, say so — but only after you've looked hard enough to have earned that conclusion.
