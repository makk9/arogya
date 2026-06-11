"use client";

import {
  ALCOHOL_USE_OPTIONS,
  EXERCISE_INTENSITY_OPTIONS,
  STRESS_LEVEL_OPTIONS,
  TOBACCO_USE_OPTIONS,
  trendValueLabel,
} from "@/components/lifestyle/lifestyle-options";
import { LifestyleInlineField } from "@/components/lifestyle/lifestyle-inline-field";
import { useMaybeLifestyleEdit } from "@/components/lifestyle/lifestyle-edit-context";
import { useMaybeLifestyleLogChange } from "@/components/lifestyle/lifestyle-log-change-context";
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
 * inline-editable (first population); a populated one stays read-only with the
 * hint routing to `+ Log a change`. Companion fields (dietRestrictions,
 * stressContext) are always editable.
 */

const SECTION_HEAD =
  "mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground";
const FIELD_LABEL =
  "mb-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground";

function Empty() {
  return <span className="text-muted-foreground">—</span>;
}

export function LifestyleCurrentSection({ profile }: Props) {
  const editCtx = useMaybeLifestyleEdit();
  const editing = editCtx?.editing ?? false;
  const logChange = useMaybeLifestyleLogChange();

  // A trend field renders its inline editor only while empty.
  const trendEditable = (value: string | null) => editing && !value;
  const anyTrendLocked =
    editing &&
    [
      profile?.dietPattern,
      profile?.exercisePattern,
      profile?.sleepPattern,
      profile?.exerciseIntensity,
      profile?.stressLevel,
      profile?.tobaccoUse,
      profile?.alcoholUse,
    ].some((v) => v != null);

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
          placeholder="Vegetarian, mostly home-cooked. Recently cut sugar."
        />
        <NarrativeBlock
          label="exercise pattern"
          fieldKey="exercisePattern"
          value={profile?.exercisePattern ?? null}
          editable={trendEditable(profile?.exercisePattern ?? null)}
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
                    trendValueLabel(
                      "exerciseIntensity",
                      profile.exerciseIntensity,
                    )
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
          placeholder="Sleeps 10pm–6am, naps after lunch."
        />
      </div>

      {anyTrendLocked && logChange ? (
        <button
          type="button"
          onClick={logChange.open}
          className="mt-2 text-left text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Use &quot;+ Log a change&quot; in History to update fields that
          already have a value — that keeps the trend story.
        </button>
      ) : null}

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
                trendValueLabel("stressLevel", profile.stressLevel)
              ) : (
                <Empty />
              )}
            </div>
          )}
          {/* Inline context quote (§6.5:1415) — companion field, always
              editable in edit mode. */}
          {editing ? (
            <LifestyleInlineField
              fieldKey="stressContext"
              value={profile?.stressContext ?? null}
              variant="text"
              clearable
              ariaLabel="Stress context"
              placeholder="worries about son in US"
              className="mt-1"
              displayValue={null}
            />
          ) : profile?.stressContext ? (
            <div className="mt-0.5 text-xs italic text-muted-foreground">
              &ldquo;{profile.stressContext}&rdquo;
            </div>
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
                trendValueLabel("tobaccoUse", profile.tobaccoUse)
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
                trendValueLabel("alcoholUse", profile.alcoholUse)
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
function NarrativeBlock({
  label,
  fieldKey,
  value,
  editable,
  placeholder,
  subRow,
}: {
  label: string;
  fieldKey: "dietPattern" | "exercisePattern" | "sleepPattern";
  value: string | null;
  editable: boolean;
  placeholder: string;
  subRow?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className={FIELD_LABEL}>{label}</div>
      {editable ? (
        <LifestyleInlineField
          fieldKey={fieldKey}
          value={value}
          variant="textarea"
          clearable={false}
          ariaLabel={label}
          placeholder={placeholder}
          displayValue={null}
        />
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {value ?? <Empty />}
        </p>
      )}
      {subRow}
    </div>
  );
}
