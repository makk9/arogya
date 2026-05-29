# Medication — inline editing + change-log entry creation

Test scenarios for Phase C item 5. Covers the Edit-mode inline-edit flow on the Medication detail page (descriptive fields) and the `+ Log a change` dialog (clinical fields → `medication_changes` rows).

**Spec:** design.md §6.5 (state entity detail), §6.12 (form template), §9.6 (API + form conventions), §4 (Medication + medication_changes schema).
**Implementation:** `app/patient/[id]/medications/[medicationId]/page.tsx` + `components/medications/{medication-detail-shell,medication-log-change-dialog,inline-field,medication-detail-header,medication-current-section,medication-notes-section,medication-history-section}.tsx` + `app/api/medications/[id]/changes/route.ts`.

This document targets three audiences:

1. **Manual paging** — a human clicking through to verify before merge.
2. **Playwright e2e** — once the suite exists, each scenario becomes one test, IDs become test names.
3. **Claude + Playwright MCP** — semantic steps a driving agent can follow without external context.

API-layer coverage (route validation, transitions, error mapping) lives in `scripts/smoke-medication-changes.ts` (13 cases). This file focuses on UI behavior the smoke script can't observe.

---

## Prerequisites

- Dev server running locally: `npm run dev` → http://localhost:3000.
- Stub auth fixtures seeded (patient ID `75794434-0bb6-4dd0-b1c7-c26b39a13f03`, user ID `97feb076-9e1f-4a89-91b3-2d24b6231842`).
- At least three medications exist in three distinct states. If missing, create them via the Add Medication form (`/patient/{patientId}/medications/new`) and use the API or Drizzle Studio to set status:
  - One **active** med with at least one prior dose change in its history.
  - One **paused** med.
  - One **discontinued** med.
- Patient has zero or more doctors and zero or more visits on file. Some scenarios are stronger when at least 2 doctors and 1 visit exist (see S11, S12); the dialog gracefully degrades when they don't.

For tests that should never share state, prefer creating a throwaway med per scenario via the Add form rather than mutating shared seed data.

---

## Conventions used below

- **Scenario ID:** `S1`, `S2`, … Use as Playwright test names.
- **`{patientId}` / `{medId}`** — substitute the actual UUIDs.
- **Preconditions** assume the med's status unless overridden in steps.
- Each scenario is independent. "Expected" describes the final observable state.

---

## Scenarios

### S1. List page renders all three statuses

**Preconditions:** at least one med in each of `active`, `paused`, `discontinued` for the patient.

**Steps:**
1. Navigate to `/patient/{patientId}/medications`.

**Expected:** All three meds visible, grouped under their respective status sections (ACTIVE, PAUSED, DISCONTINUED). Each card is clickable.

**Failure indicators:** missing section, all meds in one bucket, 500 response.

---

### S2. Detail page loads for each status

**Steps:** For each of the three meds above, click the card and confirm the detail page loads with HTTP 200, the correct status pill, and the breadcrumb path.

**Expected:** Header renders name + brand (if set) + status pill. Current section shows dose + frequency. History section visible.

---

### S3. Edit button visibility by status

**Steps:**
1. Open detail page for an **active** med → Edit button visible top-right.
2. Open detail page for a **paused** med → Edit button visible.
3. Open detail page for a **discontinued** med → Edit button **absent**. `…` menu also absent.

**Expected:** Edit hidden only on discontinued (locked refinement — see decisions.md 2026-05-28).

---

### S4. Edit mode toggles editable fields

**Preconditions:** active or paused med.

**Steps:**
1. Click Edit. Button label changes to "Done."
2. Verify the H1 area now shows two text inputs (Name, Brand name) instead of the static heading.
3. Verify the Current section's `form` and `category` cells show Select dropdowns instead of plain values.
4. Verify the Notes section appears with a textarea (even if notes was empty before).
5. Verify the inline hint under the dose card reads "Use + Log a change in History to update dose, frequency, status, or prescribing doctor."
6. Click Done. All fields revert to display mode.

**Expected:** Edit/Done is a clean visual toggle; no fields commit on toggle.

---

### S5. Inline edit — text field (Name) commits on blur

**Preconditions:** med in Edit mode.

**Steps:**
1. Click into the Name field.
2. Replace the value with `Edited Name Test`.
3. Tab out (or click elsewhere) to blur the field.

**Expected:** Brief disabled state, then page refreshes; the H1 (and breadcrumb's slug-segment if applicable) now reflects the new name.

**Failure indicators:** value reverts, no PATCH fires, page errors.

---

### S6. Inline edit — clearable text (Brand name) commits to null

**Preconditions:** med in Edit mode with a non-empty `brandName`.

**Steps:**
1. Clear the Brand name input.
2. Blur.

**Expected:** Page refreshes; in non-edit view, the `(brand)` parens next to the name disappear entirely.

---

### S7. Inline edit — required field rejects empty value

**Preconditions:** med in Edit mode.

**Steps:**
1. Clear the Name field entirely.
2. Blur.

**Expected:** Inline error `Name is required.` renders under the input. No PATCH fires (verify via network tab or by confirming no refresh). The local empty value remains visible until the user types something or navigates away.

---

### S8. Inline edit — Select (Form) commits on change

**Preconditions:** med in Edit mode.

**Steps:**
1. Open the Form Select.
2. Pick a different value (e.g. Capsule).

**Expected:** Page refreshes; the subtitle line under the H1 (when not in edit mode) reflects the new form. While in edit mode, the Select continues to show the new value.

---

### S9. Inline edit — Date (Started on) commits on blur

**Preconditions:** med in Edit mode.

**Steps:**
1. Pick a new date in the Started on field.
2. Blur.

**Expected:** Page refreshes; subtitle shows `started {new date}` when not editing.

---

### S10. Inline edit — Notes textarea adds notes to a previously empty notes field

**Preconditions:** med has empty `notes`, in Edit mode.

**Steps:**
1. Type a multi-line note into the Notes textarea.
2. Blur.

**Expected:** Page refreshes; Notes section continues to render with the new content (it is normally hidden when empty, but in edit mode it always renders; when you exit Edit, it stays because it now has content).

---

### S11. Inline edit — Clinical fields are not inline-editable

**Preconditions:** med in Edit mode.

**Steps:**
1. Try to click into the dose card.
2. Try to click into the frequency card.
3. Try to click into the prescribing-doctor cell.

**Expected:** None of the three becomes an input. The hint under the dose card directs the user to History.

(Future refinement under consideration: make the clinical cards click-to-open the log-change dialog. Not shipped yet.)

---

### S12. + Log a change button visibility by status

**Steps:**
1. **Active med** detail page → `+ Log a change` button visible in the History section heading row.
2. **Paused med** detail page → button visible.
3. **Discontinued med** detail page → button **absent**.

---

### S13. Log a change — field=dose happy path

**Preconditions:** active med with `currentDose` set (e.g. `10mg`).

**Steps:**
1. Click `+ Log a change`. Dialog opens.
2. Confirm defaults: field = Dose, newValue empty, Reason empty, Changed on = today (patient tz), Linked visit = None.
3. Enter `20mg` as newValue. Enter `labs improved` as reason. Leave Linked visit as None.
4. Click Save.

**Expected:**
- Dialog closes.
- Page refreshes.
- A new entry appears at the top of History showing `DOSE 10mg → 20mg` with the reason rendered as italicized quoted text below.
- The dose card in Current section now reads `20mg`, with `changed from 10mg on {today}` beneath it.

---

### S14. Log a change — field morphs newValue input

**Preconditions:** dialog open, field initially Dose.

**Steps:** Switch the field selector through each option and observe newValue's shape:
1. **Dose** → text input.
2. **Frequency** → text input.
3. **Status** → Select with single "Paused" option (pre-selected). Helper line below reads about using Discontinue for active → discontinued.
4. **Prescribing doctor** → Select of all patient doctors (current prescriber filtered out). If no other doctors on file, the Select shows a disabled "No other doctors on file" item.
5. Switch back to **Dose**. newValue resets to empty; any stale validation error clears.

**Expected:** Each switch resets newValue without stale state. Status pre-fills "paused"; doctors pre-populate from real DB data.

---

### S15. Log a change — field=status disabled when current status is not active

**Preconditions:** dialog open on a **paused** med.

**Steps:**
1. Open the field selector.

**Expected:** The Status option is disabled and labeled with `(already paused)` suffix. Other three options remain selectable.

---

### S16. Log a change — backdated entry

**Preconditions:** active med, dialog open.

**Steps:**
1. field = Frequency. newValue = `once nightly`.
2. Set Changed on to a date a week in the past.
3. Save.

**Expected:**
- Dialog closes, page refreshes.
- History entry appears with date rail showing `~7 days ago · {that date}`.
- Current section's frequency card now reads `once nightly`.

**Note on coercion:** the form sends date-only YYYY-MM-DD. The server coerces to noon UTC. For a Pune patient that lands at 5:30 PM IST on the chosen calendar day. Display helpers use `changedAt` directly so the rail label and date match.

---

### S17. Log a change — status active → paused

**Preconditions:** active med, dialog open.

**Steps:**
1. field = Status. newValue auto-fills to `paused`.
2. Save.

**Expected:**
- Status pill in header turns amber and reads `paused`.
- History shows `STATUS active → paused`.
- Edit button remains visible (paused is editable; only discontinued is fully read-only).
- `+ Log a change` button remains visible.
- Reopen the dialog and confirm Status option is now disabled per S15.

---

### S18. Log a change — prescribing_doctor with the current prescriber filtered out

**Preconditions:** med with `prescribingDoctor` set; patient has ≥ 2 doctors.

**Steps:**
1. Open dialog. field = Prescribing doctor.
2. Open the Select.

**Expected:** The currently-set prescriber is **not** in the options. Saving with any of the listed doctors writes a `prescribing_doctor` change row.

---

### S19. Log a change — validation error on empty newValue (text branch)

**Preconditions:** active med, dialog open.

**Steps:**
1. field = Dose. Leave newValue empty. Save.

**Expected:** Inline error `Required` renders under the newValue input. No POST is made. The dialog stays open.

---

### S20. Log a change — server returns 400 with per-field error

**Preconditions:** dialog open. Requires devtools to forge the request body (or a CLI proxy). Optional in manual paging; required in Playwright.

**Steps:**
1. Manually fire a POST to `/api/medications/{medId}/changes` with `{ field: "prescribing_doctor", newValue: "<random-uuid-not-in-patient-scope>" }`.

**Expected:** Response is 400 with `error.code = "validation_failed"` and `details.fieldErrors.newValue` carrying `Couldn't use that — doctor not found.`. When triggered through the UI form (e.g. via direct devtools manipulation of a Select), the error renders under the newValue input.

---

### S21. Log a change — 409 stale-discontinued

**Preconditions:** one active med, open in two browser tabs (A and B).

**Steps:**
1. Tab A: open `+ Log a change` dialog. Fill in a dose change. Do not save.
2. Tab B: open `…` menu → Discontinue. Complete the discontinue flow.
3. Tab A: click Save.

**Expected:**
- Dialog flips to a "stale" state showing `Already discontinued` as title and a description that includes the discontinue date if returned by the API.
- The form body is replaced by an OK button (no Cancel/Save).
- Clicking OK closes the dialog and refreshes; the page now reflects the discontinued status.

---

### S22a. Log a change — 409 stale-status when Tab A targets the status field

**Preconditions:** one active med, two tabs.

**Steps:**
1. Tab A: open dialog. field = Status (`paused` pre-selected). Do not save.
2. Tab B: open dialog. field = Status. Save — med becomes paused.
3. Tab A: click Save.

**Expected:**
- Dialog flips to `Status changed elsewhere` title with `Current status is "paused". Refresh to see the latest state.` description.
- Form body replaced by OK button.
- Clicking OK closes the dialog and refreshes; Tab A now reflects the paused state.

---

### S22b. Log a change — dose/frequency/prescribing_doctor on a now-paused med succeeds

**Preconditions:** one active med, two tabs.

**Steps:**
1. Tab A: open dialog. field = Frequency, newValue = `once nightly`. Do not save.
2. Tab B: open dialog. field = Status. Save — med becomes paused.
3. Tab A: click Save.

**Expected:**
- Tab A's submit succeeds (200). Dialog closes, page refreshes.
- The new frequency entry renders in History.
- Header pill shows `paused`.
- Confirms that paused meds remain mutable for dose / frequency / prescribing_doctor — only the status transition is blocked.

---

### S23. Discontinued med is fully read-only

**Preconditions:** discontinued med.

**Steps:** Open the detail page.

**Expected:** No Edit button, no `…` menu, no `+ Log a change` button. All fields render in display mode. Header shows the `discontinued` status pill (neutral stone palette).

---

### S24. History sort — same-day entries break ties by insertion order

**Preconditions:** active med with at least one prior dose change in history.

**Steps:**
1. Use `+ Log a change` to log a dose change with Changed on = today.
2. Use `+ Log a change` again immediately to log a frequency change with Changed on = today.

**Expected:** Both entries render with today's date. The second one (frequency) appears **above** the first (dose), reflecting actual write order. Without the `createdAt` tiebreaker, ordering would be non-deterministic since both rows tie on `changedAt = today at noon UTC`.

---

### S25. Notes section omission outside edit mode

**Preconditions:** med with empty `notes`.

**Steps:**
1. Load the detail page (not in edit mode).

**Expected:** No Notes section rendered. The page goes from History (or Linked Context) directly to nothing or the floating Ask AI button — no empty "Notes" heading.

Enter Edit mode → Notes section appears with an empty textarea ready for input.

---

### S26. Linked Context section omission

**Preconditions:** active med with **zero** change-log rows that reference a visit.

**Steps:** Open the detail page.

**Expected:** No Linked Context section rendered (locked refinement — mirrors LifestyleProfile's omit-when-empty pattern).

---

### S27. Linked Context section with linked visits

**Preconditions:** active med with at least one change-log row whose `linkedVisitId` references a visit owned by the patient.

**Steps:** Open the detail page.

**Expected:** Linked Context section renders with one line per unique linked visit, ordered by visit date descending. Visits are inert plain-text rows in Phase C (no `<Link>` until Phase D ships visit detail pages).

---

### S28. History collapse — only when > 5 changes

**Preconditions:** med with exactly 5 or fewer change-log rows; second med with > 5 rows.

**Steps:** Open each detail page.

**Expected:**
- ≤ 5: All rows render. No `+ Show all N changes ▾` button.
- &gt; 5: Top 5 render; `+ Show all N changes ▾` button visible below. Click expands; click again collapses.

---

## Edge cases worth verifying when time permits

- **Empty patient (no doctors, no visits, no other meds).** Log a change for a med whose patient has no other doctors and no visits. Prescribing-doctor Select shows disabled empty-state; Linked visit Select shows only "None."
- **Very long names / brand names / notes.** Confirm layout doesn't break the H1 line-wrap or the Notes section's whitespace handling.
- **Multi-day Edit session.** Enter Edit mode, leave the tab open, return next day. Verify Edit state is local-only (refresh exits edit mode).
- **Network failure during inline-edit PATCH.** Throttle network in devtools, blur an edited field. Confirm the inline error displays `Couldn't reach the server.` and the local draft is preserved.
- **Network failure during Log-change POST.** Same — confirm dialog banner reads `Couldn't reach the server. Try again.` and the form retains its values.

---

## Out of scope for Phase C (intentionally not tested here)

- **Editing `purpose` (Treats condition).** Requires Condition autocomplete — ships Phase D.
- **Resume from paused → active.** Locked as v1.5 per PATCH route comment in `app/api/medications/[id]/route.ts`.
- **Deleting a change-log row.** Recovery path for typos — punted to a later release per session 2026-05-29.
- **Clickable clinical cards to open the log-change dialog.** UX improvement under consideration — punted to a later release.
- **Citation pill popover navigation.** Phase C item 7.
- **Floating Ask AI button with surface context.** Phase C item 6.

---

## Quick reset between runs

To restore a med to a clean state:

```bash
# Get IDs
curl -s http://localhost:3000/api/medications | jq '.medications[] | {id, name, status}'

# Discontinue a test med (won't delete the change-log rows)
curl -X POST http://localhost:3000/api/medications/{medId}/discontinue \
  -H "Content-Type: application/json" \
  -d '{"reason":"test cleanup"}'

# Hard reset via Drizzle Studio
npm run db:studio
# Then drop the medication_changes rows for the med, and reset
# current_dose / current_frequency / status as needed.
```
