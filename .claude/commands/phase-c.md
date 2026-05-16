Check Phase C completion status by inspecting the filesystem. Report each item as ✅ done, 🔶 partial, or ❌ not started. Check actual files — don't assume.

Phase C is the First Vertical Slice — Medication entity end-to-end. Getting this right establishes the templates for all entities in Phase D.

Phase C checklist:

1. **Medication API routes** — `app/api/medications/route.ts` (list + create) and `app/api/medications/[id]/route.ts` (read, update, delete) and `app/api/medications/[id]/discontinue/route.ts` exist. Auth via `getCurrentPatient()`, Zod-validated request bodies, errors via `apiError()`. Uses query helpers from `db/queries/`.

2. **shadcn/ui init + Medication form** — shadcn/ui is initialized (`components/ui/` directory exists with at least button, input, form primitives). `components/medications/medication-form.tsx` (or similar) exists implementing the form template per design.md 6.12: Name, Dose, Frequency, Form, Started on, Prescribing doctor, Treats condition, Category, Notes. React Hook Form + Zod resolver.

3. **Medications list page** — `app/patient/[id]/medications/page.tsx` exists. State list template per design.md 6.4: section-grouped cards (ACTIVE expanded, DISCONTINUED collapsed), filter pills, `+ Add medication` action, empty state. Floating Ask AI button bottom-right.

4. **Medication detail page** — `app/patient/[id]/medications/[medicationId]/page.tsx` exists. State entity detail template per design.md 6.5: five sections in order (Header → Current → History → Linked context → Notes), constrained width (~720–800px), prominent dose+frequency card, change-log history with `+ Show all N changes`, `…` menu for Discontinue/Delete.

5. **Inline editing + change-log entry creation** — Edit button toggles in-place editing of Current section fields. `+ Log a change` affordance in History section opens a form that writes a `medication_changes` row. Both wired to API routes.

6. **Floating Ask AI button** — `components/ask-ai-button.tsx` (or similar) exists and is present on both the Medications list page and Medication detail page. Opens chat with the current page's surface context pre-loaded (`surfaceContext` tag passed to synthesis agent).

7. **Citation pill integration** — `§ med:slug` pills in AI chat responses (from Phase B citation parser) now render with a Popover showing entity preview and `View full →` link navigating to the Medication detail page. Reads `data-entity-type` / `data-slug` attrs from Phase B pill component. Wired to the medication read API route.

For each page/component found, also check:
- TypeScript strict — no `any`, no `@ts-ignore`
- Auth via `getCurrentPatient()` on all server components and API routes (never reading cookies directly)
- Forms use React Hook Form + Zod resolver (not useState per CLAUDE.md conventions)
- State mutations go through API routes, not direct DB calls from components
- `import "server-only"` boundary respected — no server imports in client components

**Phase C milestone:** hit the full stack end-to-end — add a medication via the form → see it on the list page → open detail page → edit a field → log a change → open chat → get a synthesis response that cites `§ med:slug` → click the pill → land on the detail page.

After the checklist, give a single clear next action: what to build in this session.
