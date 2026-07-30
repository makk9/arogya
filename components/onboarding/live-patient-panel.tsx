"use client";

import { InlinePatchField } from "@/components/onboarding/inline-patch-field";
import type { OnboardingSnapshot, SnapshotRow } from "@/lib/onboarding/snapshot";

/**
 * The live-populating patient page (§6.3 right side). Cards appear as the
 * interview captures them — a fresh card flashes the accent for ~1s
 * (transition-colors tint), section counts update live, and primary fields are
 * inline-editable in place of a confirmation gate.
 */

interface LivePatientPanelProps {
  patientId: string;
  snapshot: OnboardingSnapshot;
  highlights: ReadonlySet<string>;
  live: boolean;
}

interface SectionSpec {
  key: keyof Pick<
    OnboardingSnapshot,
    | "conditions"
    | "medications"
    | "doctors"
    | "allergies"
    | "familyHistory"
    | "journal"
  >;
  label: string;
  // PATCH target for the row's primary field; null = edit on the entity page.
  patch: { url: (id: string) => string; field: string } | null;
}

const SECTIONS: SectionSpec[] = [
  {
    key: "conditions",
    label: "CONDITIONS",
    patch: { url: (id) => `/api/conditions/${id}`, field: "name" },
  },
  {
    key: "medications",
    label: "MEDICATIONS",
    patch: { url: (id) => `/api/medications/${id}`, field: "name" },
  },
  {
    key: "doctors",
    label: "CARE TEAM",
    patch: { url: (id) => `/api/doctors/${id}`, field: "name" },
  },
  {
    key: "allergies",
    label: "ALLERGIES",
    patch: { url: (id) => `/api/allergies/${id}`, field: "substance" },
  },
  {
    key: "familyHistory",
    label: "FAMILY HISTORY",
    patch: { url: (id) => `/api/family-history/${id}`, field: "conditionName" },
  },
  { key: "journal", label: "NOTES", patch: null },
];

function EntityCard({
  row,
  fresh,
  patch,
}: {
  row: SnapshotRow;
  fresh: boolean;
  patch: SectionSpec["patch"];
}) {
  return (
    <div
      className={`rounded-lg border border-border px-3 py-2 transition-colors duration-1000 ${
        fresh ? "bg-accent" : "bg-transparent"
      }`}
    >
      {patch ? (
        <InlinePatchField
          // Keyed on the value: an agent-side update (a correction emission)
          // must remount the field, or the stale local draft wins.
          key={`${row.id}:${row.title}`}
          url={patch.url(row.id)}
          field={patch.field}
          value={row.title}
          ariaLabel={`Edit ${row.title}`}
          className="text-sm font-medium text-foreground"
        />
      ) : (
        <p className="text-sm font-medium text-foreground">{row.title}</p>
      )}
      {row.subtitle ? (
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {row.subtitle}
        </p>
      ) : null}
    </div>
  );
}

export function LivePatientPanel({
  patientId,
  snapshot,
  highlights,
  live,
}: LivePatientPanelProps) {
  const { patient } = snapshot;
  const identityBits = [
    patient.dateOfBirth ? `b. ${patient.dateOfBirth}` : null,
    patient.sex !== "unspecified" ? patient.sex : null,
    [patient.city, patient.country].filter(Boolean).join(", ") || null,
  ].filter(Boolean);

  return (
    <div className="flex h-full flex-col overflow-y-auto px-6 py-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <InlinePatchField
            key={patient.name}
            url="/api/patient"
            field="name"
            value={patient.name}
            ariaLabel="Edit patient name"
            className="font-heading text-xl font-semibold text-foreground"
          />
          {identityBits.length > 0 ? (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {identityBits.join(" · ")}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1 pt-1">
          {live ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                aria-hidden
                className="h-2 w-2 rounded-full bg-primary animate-pulse"
              />
              live · building
            </span>
          ) : null}
          <span className="text-xs text-muted-foreground">
            click any field to edit
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {SECTIONS.map((section) => {
          const rows = snapshot[section.key];
          return (
            <section key={section.key}>
              <h2 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground">
                {section.label}
                {rows.length > 0 ? ` · ${rows.length}` : ""}
              </h2>
              {rows.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                  Nothing here yet — it fills in as you talk.
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {rows.map((row) => (
                    <EntityCard
                      key={row.id}
                      row={row}
                      fresh={highlights.has(row.id)}
                      patch={section.patch}
                    />
                  ))}
                </div>
              )}
            </section>
          );
        })}

        <section>
          <h2 className="mb-2 text-xs font-medium tracking-wide text-muted-foreground">
            LIFESTYLE
          </h2>
          {snapshot.lifestyle.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
              Nothing here yet — it fills in as you talk.
            </p>
          ) : (
            <div className="rounded-lg border border-border px-3 py-2">
              {snapshot.lifestyle.map((f) => (
                <p key={f.label} className="text-sm text-foreground">
                  <span className="text-muted-foreground">{f.label}: </span>
                  {f.value}
                </p>
              ))}
              <a
                href={`/patient/${patientId}/lifestyle`}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                edit on the lifestyle page →
              </a>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
