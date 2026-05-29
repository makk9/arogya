Generate or update a test-scenarios doc for the work completed this session. Use after a feature lands and is ready for verification.

Output target: `docs/test-scenarios/<kebab-slug>.md` — one file per discrete feature, not per phase. The reference shape is `docs/test-scenarios/medication-inline-edit-and-change-log.md`; mirror its structure.

The file targets three audiences:
1. **Manual paging** — a human clicking through to verify before merge.
2. **Playwright e2e** — scenario IDs (`S1`, `S2`, …) become test names.
3. **Claude + Playwright MCP** — semantic steps a driving agent can follow without external context.

Do the following:

**1. Identify what was built**
- `$ARGUMENTS` may name the feature (e.g. `Phase C item 5`, `condition inline edit`). If absent, infer from git diff + recent commits + the latest entry in `docs/progress.md`.
- Run `git diff --stat HEAD` (uncommitted) and `git log --oneline -5` to see scope. List the implementation files (API routes, components, query helpers, schemas) that this doc must cover.
- Pick a kebab-slug filename that names the feature, not the phase. Phase D will replicate per entity — names like `condition-inline-edit-and-change-log.md` survive Phase D.

**2. Load the relevant spec**
Read the design doc sections that govern this work (use the phase mapping from CLAUDE.md). Cite them in the doc's Overview section so future readers can find authority for each scenario.

**3. Check whether the file already exists**
- If `docs/test-scenarios/<slug>.md` exists: read it, then update or add scenarios rather than overwrite. Renumber `S{n}` IDs carefully — existing IDs may already be referenced from Playwright tests or external docs; prefer appending new scenarios at the end over renumbering.
- If new: create the directory if missing and write the file fresh.

**4. Cover the right scenarios**
Each scenario must include:
- **ID** — `S{n}` (sequential, stable, never renumbered after first commit).
- **Title** — one short sentence naming the behavior.
- **Preconditions** — state of the system before steps (entity status, prior data, dialog state, etc.).
- **Steps** — numbered, action-oriented. Each step is something a human or driving agent can execute. Use real selectors / button labels / URL shapes — not abstract descriptions.
- **Expected** — the observable outcome. Visual, behavioral, or data-shaped.
- Optional **Failure indicators** — common ways the scenario can silently regress.
- Optional **Notes** — non-obvious behavior, cross-references.

Coverage to aim for:
- **Happy paths** for every primary user action.
- **Visibility-by-state** scenarios (what's shown / hidden in each entity status).
- **Input validation** (required fields, empty cases, malformed values).
- **Error paths** — server 4xx / 5xx behavior, network failure UX.
- **Race / staleness paths** if the feature has multi-tab implications (409 invalid-state-transition flows are common in this app).
- **Section / affordance omission rules** (e.g. notes omitted when empty, Linked Context omitted when empty per §6.5 LifestyleProfile precedent).
- **Ordering / sort behavior** if relevant (e.g. history rail with same-day entries).
- **Architectural tripwires** from CLAUDE.md that the feature must respect (change-log writes, citation rendering, auth flowing through `getCurrentPatient()`, etc.).

**5. Sections the file must include**
Mirror the canonical reference (`docs/test-scenarios/medication-inline-edit-and-change-log.md`):

- **Title + 1-sentence summary** naming the phase/item.
- **Spec / Implementation** pointers — design.md section refs + file paths.
- **Audience** — the three audiences above.
- **Prerequisites** — what must be set up before running scenarios (dev server, seed data, entity state shape).
- **Conventions** — ID format, placeholder syntax (`{patientId}`, `{medId}`), independence assumption.
- **Scenarios** — the numbered list.
- **Edge cases worth verifying when time permits** — lower-priority probes (long strings, empty patient, network failure, etc.). Keep separate from the numbered list.
- **Out of scope** — features deferred to later items / phases / v1.5 / v2. Cite the decisions.md entry or design.md section that locks the deferral, so readers don't waste cycles testing what isn't built.
- **Quick reset between runs** — curl / Drizzle Studio snippets so the next run starts from clean state.

**6. Style**
- Be concrete. Real button labels, real URL shapes, real field names. Future readers should not need design.md context to act on a scenario.
- One scenario per behavior. Don't bundle "Edit works AND Save commits AND error rendering all in one scenario" — split.
- No vague verbs like "verify the page works." State the observable outcome.
- Mark scenarios that require devtools / API forging as such (some assertions can't be made via UI alone).
- Reference the design doc section when a scenario tests a locked refinement (e.g. "locked refinement — see decisions.md 2026-05-28").

**7. After writing**
Report back with:
- Path to the file written / updated.
- Count of scenarios added (and total in file).
- Any spec-vs-implementation gaps surfaced during scenario writing — these often reveal behavior that was assumed but never specified. Flag them; don't quietly resolve.

Do not modify implementation files. This command produces documentation only.
