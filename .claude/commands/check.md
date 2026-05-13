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
- TypeScript strict compliance (no `any`, no `@ts-ignore`)
- Naming conventions: tables plural snake_case, columns snake_case, TS types PascalCase
- No orphaned files or dead code

**5. North star check**
One question only: does this work make the demo moment more or less achievable?
> "A personal health knowledge base for managing health. Structured medical record (the "vault") combined with an AI synthesis layer (the "thinking partner inside") that reasons across the full record to surface patterns, current state, care gaps, and questions worth raising with doctors.
> His dizziness episodes in the last month cluster on mornings after he skipped the BP medication prescribed by Dr. Sharma. The cardiologist also raised the dose on April 3rd."

**6. Report**
- ✅ Compliant items (brief)
- ⚠️ Deviations from spec (specific, with fix instructions)
- ❌ Blockers — must fix before proceeding

Be precise. Cite the design doc section for every deviation. Do not give a passing grade to anything that contradicts the spec.
