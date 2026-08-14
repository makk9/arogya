"use client";

import {
  ALCOHOL_USE_OPTIONS,
  EXERCISE_INTENSITY_OPTIONS,
  STRESS_LEVEL_OPTIONS,
  TOBACCO_USE_OPTIONS,
  trendValueLabel,
} from "@/components/lifestyle/lifestyle-options";
import { LifestyleInlineField } from "@/components/lifestyle/lifestyle-inline-field";
import {
  LogChangeHint,
  LogChangeValue,
} from "@/components/log-change-affordance";
import { useMaybeLifestyleEdit } from "@/components/lifestyle/lifestyle-edit-context";
import { useMaybeLifestyleLogChange } from "@/components/lifestyle/lifestyle-log-change-context";
import type { LifestyleTrendFieldKey } from "@/components/lifestyle/lifestyle-options";
import type { LifestyleProfile } from "@/db/schema";

interface Props {
  /** Null until the singleton row is lazily created. */
  profile: LifestyleProfile | null;
}

/*
 * Current section per the §6.5:1403/1413 LifestyleProfile variation: narrative
 * blocks (Diet / Exercise / Sleep patterns as flowing prose) on top, then the
 * compact 4-column structured strip for stress / tobacco / alcohol / diet
 * restrictions. Two locked sketch patterns preserved:
 *  - stress renders with the inline context quote (`Moderate · "worries about
 *    son in US"`, §6.5:1415)
 *  - exerciseIntensity isn't in the locked strip, so it renders as a sub-line
 *    inside the Exercise narrative block (decisions.md 2026-06-10)
 *
 * Edit-mode rule (the singleton's create-form analog): an EMPTY trend field is
 * inline-editable (first population); a populated one is a click target that
 * opens the `+ Log a change` dialog preselected to that field — the user's
 * "click the information to change it" instinct routes to the change-log
 * write path instead of dead-ending (change logs, never overwrites).
 * Companion fields (dietRestrictions, stressContext) are always editable.
 */

const SECTION_HEAD =
  "mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground";
const FIELD_LABEL =
  "mb-1 font-mono text-[11px] font-medium uppercase tracking-wide text-muted-foreground";

function Empty() {
  return <span className="text-muted-foreground">—</span>;
}

export function LifestyleCurrentSection({ profile }: Props) {
  const editCtx = useMaybeLifestyleEdit();
  const editing = editCtx?.editing ?? false;
  const logChange = useMaybeLifestyleLogChange();

  // An EMPTY trend field mounts its InlineField (first population) — which
  // self-manages display vs editor, so the dash is a click-to-edit target at
  // rest and an editor in edit mode. Populated trend fields never mount it;
  // they route through `+ Log a change`.
  const trendEditable = (value: string | null) => !value;

  // Populated trend values open the Log-a-change dialog scoped to themselves.
  const logChangeFor = (
    field: LifestyleTrendFieldKey,
    value: string | null,
  ): (() => void) | null =>
    value && logChange ? () => logChange.open(field) : null;

  const restrictions = profile?.dietRestrictions ?? [];

  return (
    <section className="mb-8">
      <h2 className={SECTION_HEAD}>Current</h2>

      <div className="flex flex-col gap-3">
        <NarrativeBlock
          label="diet pattern"
          fieldKey="dietPattern"
          value={profile?.dietPattern ?? null}
          editable={trendEditable(profile?.dietPattern ?? null)}
          onLogChange={logChangeFor("dietPattern", profile?.dietPattern ?? null)}
          placeholder="Vegetarian, mostly home-cooked. Recently cut sugar."
        />
        <NarrativeBlock
          label="exercise pattern"
          fieldKey="exercisePattern"
          value={profile?.exercisePattern ?? null}
          editable={trendEditable(profile?.exercisePattern ?? null)}
          onLogChange={logChangeFor(
            "exercisePattern",
            profile?.exercisePattern ?? null,
          )}
          placeholder="30-min walk most mornings. Yoga twice a week."
          subRow={
            <div className="mt-2">
              <div className={FIELD_LABEL}>intensity</div>
              {trendEditable(profile?.exerciseIntensity ?? null) ? (
                <LifestyleInlineField
                  fieldKey="exerciseIntensity"
                  value={null}
                  variant="select"
                  clearable={false}
                  ariaLabel="Exercise intensity"
                  options={EXERCISE_INTENSITY_OPTIONS}
                  displayValue={<Empty />}
                />
              ) : (
                <span className="text-sm">
                  {profile?.exerciseIntensity ? (
                    <LogChangeValue
                      ariaLabel="Log a change to exercise intensity"
                      onLogChange={logChangeFor(
                        "exerciseIntensity",
                        profile.exerciseIntensity,
                      )}
                    >
                      {trendValueLabel(
                        "exerciseIntensity",
                        profile.exerciseIntensity,
                      )}
                    </LogChangeValue>
                  ) : (
                    <Empty />
                  )}
                </span>
              )}
            </div>
          }
        />
        <NarrativeBlock
          label="sleep pattern"
          fieldKey="sleepPattern"
          value={profile?.sleepPattern ?? null}
          editable={trendEditable(profile?.sleepPattern ?? null)}
          onLogChange={logChangeFor(
            "sleepPattern",
            profile?.sleepPattern ?? null,
          )}
          placeholder="Sleeps 10pm–6am, naps after lunch."
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 rounded-lg bg-muted/40 px-4 py-3 md:grid-cols-4">
        <div>
          <div className={FIELD_LABEL}>stress</div>
          {trendEditable(profile?.stressLevel ?? null) ? (
            <LifestyleInlineField
              fieldKey="stressLevel"
              value={null}
              variant="select"
              clearable={false}
              ariaLabel="Stress level"
              options={STRESS_LEVEL_OPTIONS}
              displayValue={<Empty />}
            />
          ) : (
            <div className="text-sm">
              {profile?.stressLevel ? (
                <LogChangeValue
                  ariaLabel="Log a change to stress level"
                  onLogChange={logChangeFor("stressLevel", profile.stressLevel)}
                >
                  {trendValueLabel("stressLevel", profile.stressLevel)}
                </LogChangeValue>
              ) : (
                <Empty />
              )}
            </div>
          )}
          {/* Inline context quote (§6.5:1415) — companion field, plain
              PATCH. Mounted whenever populated (the quote is a click-to-edit
              target) or in edit mode (so it can be first-populated). */}
          {editing || profile?.stressContext ? (
            <LifestyleInlineField
              fieldKey="stressContext"
              value={profile?.stressContext ?? null}
              variant="text"
              clearable
              ariaLabel="Stress context"
              placeholder="worries about son in US"
              className="mt-1"
              displayValue={
                profile?.stressContext ? (
                  <div className="mt-0.5 text-xs italic text-muted-foreground">
                    &ldquo;{profile.stressContext}&rdquo;
                  </div>
                ) : null
              }
            />
          ) : null}
        </div>
        <div>
          <div className={FIELD_LABEL}>tobacco</div>
          {trendEditable(profile?.tobaccoUse ?? null) ? (
            <LifestyleInlineField
              fieldKey="tobaccoUse"
              value={null}
              variant="select"
              clearable={false}
              ariaLabel="Tobacco use"
              options={TOBACCO_USE_OPTIONS}
              displayValue={<Empty />}
            />
          ) : (
            <div className="text-sm">
              {profile?.tobaccoUse ? (
                <LogChangeValue
                  ariaLabel="Log a change to tobacco use"
                  onLogChange={logChangeFor("tobaccoUse", profile.tobaccoUse)}
                >
                  {trendValueLabel("tobaccoUse", profile.tobaccoUse)}
                </LogChangeValue>
              ) : (
                <Empty />
              )}
            </div>
          )}
        </div>
        <div>
          <div className={FIELD_LABEL}>alcohol</div>
          {trendEditable(profile?.alcoholUse ?? null) ? (
            <LifestyleInlineField
              fieldKey="alcoholUse"
              value={null}
              variant="select"
              clearable={false}
              ariaLabel="Alcohol use"
              options={ALCOHOL_USE_OPTIONS}
              displayValue={<Empty />}
            />
          ) : (
            <div className="text-sm">
              {profile?.alcoholUse ? (
                <LogChangeValue
                  ariaLabel="Log a change to alcohol use"
                  onLogChange={logChangeFor("alcoholUse", profile.alcoholUse)}
                >
                  {trendValueLabel("alcoholUse", profile.alcoholUse)}
                </LogChangeValue>
              ) : (
                <Empty />
              )}
            </div>
          )}
        </div>
        <div>
          <div className={FIELD_LABEL}>diet restrictions</div>
          <LifestyleInlineField
            fieldKey="dietRestrictions"
            value={restrictions.length > 0 ? restrictions.join(", ") : null}
            variant="tags"
            clearable
            ariaLabel="Diet restrictions"
            placeholder="vegetarian, low-sodium"
            displayValue={
              <span className="text-sm">
                {restrictions.length > 0 ? restrictions.join(" · ") : <Empty />}
              </span>
            }
          />
        </div>
      </div>
    </section>
  );
}

// One narrative block: mono label, prose body (§6.5:1413's hybrid layout).
// A populated body is a click target for `+ Log a change` scoped to its field;
// the ghost hint sits on the label row so the card doesn't grow on hover.
function NarrativeBlock({
  label,
  fieldKey,
  value,
  editable,
  onLogChange,
  placeholder,
  subRow,
}: {
  label: string;
  fieldKey: "dietPattern" | "exercisePattern" | "sleepPattern";
  value: string | null;
  editable: boolean;
  onLogChange: (() => void) | null;
  placeholder: string;
  subRow?: React.ReactNode;
}) {
  return (
    <div className="relative rounded-lg border border-border bg-card p-4">
      <div className={FIELD_LABEL}>{label}</div>
      {editable ? (
        <LifestyleInlineField
          fieldKey={fieldKey}
          value={value}
          variant="textarea"
          clearable={false}
          ariaLabel={label}
          placeholder={placeholder}
          // Editable ⇔ empty: at rest the dash is the click-to-edit target
          // for first population; in edit mode the textarea renders directly.
          displayValue={
            <p className="whitespace-pre-wrap text-sm leading-relaxed">
              <Empty />
            </p>
          }
        />
      ) : value && onLogChange ? (
        <button
          type="button"
          onClick={onLogChange}
          aria-label={`Log a change to ${label}`}
          className="group -mx-1.5 -my-1 block w-full rounded-md px-1.5 py-1 text-left transition-colors hover:bg-muted/50 focus-visible:bg-muted/50"
        >
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{value}</p>
          <LogChangeHint />
        </button>
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {value ?? <Empty />}
        </p>
      )}
      {subRow}
    </div>
  );
}
