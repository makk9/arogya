import "server-only";

import {
  allergyQueries,
  conditionQueries,
  doctorQueries,
  familyHistoryQueries,
  journalQueries,
  lifestyleQueries,
  medicationQueries,
  patientQueries,
} from "@/db/queries";

/**
 * The live patient panel's data (§6.3 right side) — one flat, string-only view
 * model shared by the onboarding page (server-seeded) and GET /api/onboarding
 * (client refetch after each entity event), so both paths render identically.
 */

export interface SnapshotRow {
  id: string;
  title: string;
  subtitle: string | null;
}

export interface OnboardingSnapshot {
  patient: {
    id: string;
    name: string;
    dateOfBirth: string | null;
    sex: string;
    city: string | null;
    country: string;
  };
  conditions: SnapshotRow[];
  medications: SnapshotRow[];
  doctors: SnapshotRow[];
  allergies: SnapshotRow[];
  familyHistory: SnapshotRow[];
  lifestyle: { label: string; value: string }[];
  journal: SnapshotRow[];
}

// "aunt_uncle" → "aunt/uncle" for display when relationSpecific is unset.
function relationLabel(relation: string): string {
  return relation.replace(/_/g, "/");
}

function joinParts(...parts: Array<string | null | undefined>): string | null {
  const kept = parts.filter((p): p is string => !!p && p.length > 0);
  return kept.length > 0 ? kept.join(" · ") : null;
}

export async function loadOnboardingSnapshot(
  patientId: string,
): Promise<OnboardingSnapshot | null> {
  const [
    patient,
    conditions,
    medications,
    doctors,
    allergies,
    familyHistory,
    lifestyle,
    journal,
  ] = await Promise.all([
    patientQueries.getById(patientId),
    conditionQueries.forPatient(patientId),
    medicationQueries.active(patientId),
    doctorQueries.forPatient(patientId),
    allergyQueries.forPatient(patientId),
    familyHistoryQueries.forPatient(patientId),
    lifestyleQueries.getForPatient(patientId),
    journalQueries.forPatient(patientId),
  ]);
  if (!patient) return null;

  const lifestyleFields: { label: string; value: string }[] = [];
  if (lifestyle) {
    const push = (label: string, value: string | null) => {
      if (value) lifestyleFields.push({ label, value });
    };
    push("diet", lifestyle.dietPattern);
    push(
      "restrictions",
      lifestyle.dietRestrictions && lifestyle.dietRestrictions.length > 0
        ? lifestyle.dietRestrictions.join(", ")
        : null,
    );
    push("exercise", lifestyle.exercisePattern);
    push("intensity", lifestyle.exerciseIntensity);
    push("sleep", lifestyle.sleepPattern);
    push("stress", lifestyle.stressLevel);
    push("tobacco", lifestyle.tobaccoUse);
    push("alcohol", lifestyle.alcoholUse);
  }

  return {
    patient: {
      id: patient.id,
      name: patient.name,
      dateOfBirth: patient.dateOfBirth ?? null,
      sex: patient.sex,
      city: patient.city,
      country: patient.country,
    },
    conditions: conditions.map((c) => ({
      id: c.id,
      title: c.name,
      subtitle: joinParts(c.status, c.severity),
    })),
    medications: medications.map((m) => ({
      id: m.id,
      title: m.name,
      subtitle: joinParts(m.currentDose, m.currentFrequency),
    })),
    doctors: doctors.map((d) => ({
      id: d.id,
      title: d.name,
      subtitle: joinParts(d.specialty, d.clinic),
    })),
    allergies: allergies.map((a) => ({
      id: a.id,
      title: a.substance,
      subtitle: joinParts(a.reaction, a.severity),
    })),
    familyHistory: familyHistory.map((f) => ({
      id: f.id,
      title: f.conditionName,
      subtitle: f.relationSpecific ?? relationLabel(f.relation),
    })),
    lifestyle: lifestyleFields,
    journal: journal.slice(0, 5).map((j) => ({
      id: j.id,
      title: j.title ?? "Journal entry",
      subtitle:
        j.content.length > 80 ? `${j.content.slice(0, 79)}…` : j.content,
    })),
  };
}
