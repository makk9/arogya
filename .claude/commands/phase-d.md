Check Phase D completion status by inspecting the filesystem. Report each entity as ✅ done, 🔶 partial, or ❌ not started. Check actual files — don't assume.

Phase D is **Replicate the Pattern** — apply the proven Medication vertical (Phase C) across every remaining entity. Per design.md 10.2 it's parallel-friendly, but there's one sequencing rule: **Condition** should land first (proves the state template generalizes beyond Medication) and **Visit** first among events (the 6.6/6.7 event template is brand-new and unproven), then the rest parallelize.

Two distinct templates are in play — don't conflate them:
- **State entities** reuse the Medication template: form (6.12) + list page (6.4) + detail page (6.5) + change-log writes. Paired `*_changes` table except FamilyHistory.
- **Event entities** use a NEW template pair: timeline page (6.6) + event detail page (6.7). No change logs. Outcomes section replaces History. Time is the organizing axis, not status.

Phase D checklist:

**State entities** (6.4 list + 6.5 detail + 6.12 form + `*_changes` log):

1. **Condition** — `app/api/conditions/*`, `components/conditions/condition-form.tsx`, `app/patient/[id]/conditions/{page,[id]/page}.tsx`. Status enum ACTIVE/CONTROLLED/IN_REMISSION/RESOLVED/SUSPECTED drives list grouping. Linked medications + labs in detail's Linked context. `condition_changes` change log.

2. **Doctor** — `app/api/doctors/*`, form, list + detail pages. List grouped **by specialty** (not status). `doctor_changes` change log. Backlinks from meds/conditions/visits that reference this doctor.

3. **Allergy** — `app/api/allergies/*`, form, list + detail pages. Fewest fields. `allergy_changes` change log.

4. **Lifestyle** — **singleton per patient.** No list page — a single profile detail surface. `lifestyle_profiles` + `lifestyle_changes`.

5. **FamilyHistory** — `app/api/family-history/*`, form, list page. **NO change log** — entries are inline-edited directly. List grouped by relation type (PARENTS / SIBLINGS / GRANDPARENTS / OTHER).

**Event entities** (6.6 timeline + 6.7 event detail; no change logs):

6. **Visit** — richest event. `app/api/visits/*`, form, timeline + detail pages. Month-grouped timeline; glyph-prefixed result badges (`↑ ≡ +`). Detail has `NOTES FROM VISIT` body + Outcomes (what changed) + forward-linked context.

7. **LabReport + LabResults** — one report → many results. `MARKERS` table on detail is **read-only**; corrections via `+ Log a correction` (dashed-border), NOT inline edit. Flagged markers use `△` glyph + SLIGHTLY HIGH/LOW/CRITICAL pills.

8. **Symptom (Type + Episode)** — `symptom_types` + `symptom_episodes`. Timeline grouped **by symptom type**, not by month. Episode cards show severity pill + optional `●` linked-vital pill. Detail has parent-link to SymptomType.

9. **Report** — uploaded documents. Detail shows PDF/text preview + extracted-entity outcomes.

10. **JournalEntry** — personal writing. **No Outcomes section, no Notes section** (the body IS the note). Linked-entity `§` pills at bottom of cards. Title-less entries render `(untitled)`.

11. **VitalReading** — `app/api/vital-readings/*` + a create form ONLY. **No timeline page** — design.md 6.6 lists only 5 event rail items (Visits/Labs/Symptoms/Reports/Journal). Vitals surface as `●` linked pills on symptom episodes. Flag if a standalone Vitals list page was built — that's over-scope.

**Standalone surfaces:**

12. **Patient profile** — `app/patient/[id]/page.tsx` or profile route per 6.10. State-detail template variation.

13. **Insights feed + detail** — `app/patient/[id]/insights/{page,[id]/page}.tsx` per 6.8 + 6.9. **Placeholder data** — insight *generation* is Phase E. Two filter pills (All statuses ▾ + All categories ▾). Detail is read-only (no edit, no form).

For each entity found, also check:
- TypeScript strict — no `any`, no `@ts-ignore`, no `@ts-expect-error`
- Auth via `getCurrentPatient()` on all server components + API routes (never reading cookies directly)
- Multi-field forms use React Hook Form + Zod resolver; inline single-field edits use useState + onBlur (per CLAUDE.md)
- State mutations go through API routes, not direct DB calls from client components
- `import "server-only"` boundary respected
- **No hardcoded color literals** — every surface references semantic tokens (`primary`, `muted`, `accent`, etc.). The brand accent is still stone-only and deferred; color must stay tokenized so the accent stays a one-place swap. Flag any hardcoded hex/oklch in a component, especially green-register values (7.2 anti-pattern).
- Citation pills resolve — `§ condition:slug`, `§ doctor:slug`, etc. should now render live popovers (Phase C only wired `§ med:`). Flag pills that are still inert.
- Floating Ask AI button present on every list/timeline + detail page (absent on forms, per 6.4).

**Phase D milestone:** all wiki surfaces work for browsing and direct entity creation; chat synthesis cites and navigates across all entity types. Almost a complete app — onboarding, extraction, and AI-driven flows remain (Phase E).

After the checklist, give a single clear next action: which entity to build in this session (respecting the Condition-first / Visit-first sequencing if those aren't done yet).
