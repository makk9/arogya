import Link from "next/link";
import { notFound } from "next/navigation";

import { AskAiButton } from "@/components/ask-ai-button";
import { Breadcrumb } from "@/components/breadcrumb";
import { DoctorCard } from "@/components/doctors/doctor-card";
import { DoctorEmptyState } from "@/components/doctors/doctor-empty-state";
import { DoctorFilters } from "@/components/doctors/doctor-filters";
import { EntityListSections } from "@/components/entity-list-sections";
import { buttonVariants } from "@/components/ui/button";
import type { Doctor } from "@/db/schema";
import { doctorQueries } from "@/db/queries/doctor";
import { medicationQueries } from "@/db/queries/medication";
import { getCurrentPatient } from "@/lib/auth";

function pickFirst(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function DoctorsListPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { id } = await params;
  const patient = await getCurrentPatient();
  if (id !== patient.patientId) notFound();

  const sp = await searchParams;
  // Specialty is free text (no enum) — the filter value is a lowercased
  // specialty; anything not present in the data falls through to "no match".
  const specialtyFilter = pickFirst(sp.specialty)?.toLowerCase() ?? null;

  const [allDoctors, medications, lastVisitMap] = await Promise.all([
    doctorQueries.forPatient(patient.patientId),
    medicationQueries.forPatient(patient.patientId),
    doctorQueries.lastVisitByDoctor(patient.patientId),
  ]);

  // Meds-prescribed counts per doctor (6.4 doctor card line 2, right side).
  const medCountByDoctor = new Map<string, number>();
  for (const m of medications) {
    if (!m.prescribingDoctor) continue;
    medCountByDoctor.set(
      m.prescribingDoctor,
      (medCountByDoctor.get(m.prescribingDoctor) ?? 0) + 1,
    );
  }

  // Group by specialty per 6.4:1335 — alphabetical group order, all expanded.
  // Free-text specialties group case-insensitively ("cardiology" and
  // "Cardiology" are one group); the first-seen casing is the display label.
  // Doctors within a group are already name-ordered by the query. The key is
  // the section slug itself, so "General medicine" / "General-medicine" land in
  // one group rather than two sections colliding on the same slug (React key +
  // panel id).
  const groups = new Map<string, { label: string; doctors: Doctor[] }>();
  for (const d of allDoctors) {
    const key = d.specialty.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const group = groups.get(key);
    if (group) group.doctors.push(d);
    else groups.set(key, { label: d.specialty, doctors: [d] });
  }
  const allSpecialties = [...groups.values()]
    .map((g) => g.label)
    .sort((a, b) => a.localeCompare(b));

  const visibleGroups = [...groups.entries()]
    .filter(
      ([key]) =>
        !specialtyFilter ||
        key === specialtyFilter.replace(/[^a-z0-9]+/g, "-"),
    )
    .sort(([a], [b]) => a.localeCompare(b));

  const totalCount = allDoctors.length;
  const filteredCount = visibleGroups.reduce(
    (n, [, g]) => n + g.doctors.length,
    0,
  );

  // Subtitle: the specialty spread (title already carries the doctor count).
  // Reflects the post-filter view, same asymmetry as Medications/Conditions.
  const specialtyCount = visibleGroups.length;
  const subtitle =
    specialtyCount > 0
      ? `${specialtyCount} ${specialtyCount === 1 ? "specialty" : "specialties"}`
      : null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Breadcrumb patientId={id} trail={[{ label: "doctors" }]} />

      <div className="mb-2 flex items-start justify-between gap-4">
        <h1 className="font-heading text-2xl font-semibold leading-tight">
          <span className="border-b-2 border-destructive pb-1">Doctors</span>
          {totalCount > 0 ? (
            <span className="ml-2 text-muted-foreground">· {totalCount}</span>
          ) : null}
        </h1>
        <Link href={`/patient/${id}/doctors/new`} className={buttonVariants()}>
          + Add doctor
        </Link>
      </div>

      {subtitle ? (
        <p className="mb-6 text-sm text-muted-foreground">{subtitle}</p>
      ) : (
        <div className="mb-6" />
      )}

      {totalCount > 0 ? (
        <div className="mb-6 flex justify-end">
          <DoctorFilters specialties={allSpecialties} />
        </div>
      ) : null}

      {totalCount === 0 ? (
        <DoctorEmptyState patientId={patient.patientId} />
      ) : filteredCount === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-6 py-8 text-center text-sm text-muted-foreground">
          No doctors match this filter.
        </p>
      ) : (
        <EntityListSections
          idPrefix="doctors"
          sections={visibleGroups.map(([key, g]) => ({
            slug: key.replace(/[^a-z0-9]+/g, "-"),
            label: g.label,
            count: g.doctors.length,
            // All expanded by default per 6.4:1335 (group headers are light
            // navigation, not archive buckets).
            defaultOpen: true,
            cards: g.doctors.map((d) => (
              <DoctorCard
                key={d.id}
                patientId={patient.patientId}
                doctor={d}
                lastVisit={lastVisitMap.get(d.id)}
                medCount={medCountByDoctor.get(d.id) ?? 0}
              />
            )),
          }))}
        />
      )}

      <AskAiButton surface={{ key: "doctors-list" }} />
    </main>
  );
}
