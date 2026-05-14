import type { Patient } from "@/db/schema";

import { computeAge, formatISODate } from "./format";

export function patientSlug(patient: Patient): string {
  return `patient:${patient.id}`;
}

export function serializePatient(patient: Patient, now: Date): string {
  const dob = formatISODate(patient.dateOfBirth);
  const age = dob ? computeAge(dob, now) : null;

  const lines: string[] = [];
  lines.push(`# Patient`);
  lines.push("");
  lines.push(`- Name: ${patient.name}`);
  if (patient.preferredName) {
    lines.push(`- Preferred name: ${patient.preferredName}`);
  }
  if (dob) {
    lines.push(
      `- Date of birth: ${dob}${age !== null ? ` (age ${age} as of ${formatISODate(now)})` : ""}`,
    );
  }
  lines.push(`- Sex: ${patient.sex}`);
  if (patient.bloodType) lines.push(`- Blood type: ${patient.bloodType}`);
  if (patient.heightCm) lines.push(`- Height: ${patient.heightCm} cm`);
  if (patient.currentWeightKg) {
    lines.push(`- Weight: ${patient.currentWeightKg} kg`);
  }
  lines.push(`- Country: ${patient.country}`);
  if (patient.city) lines.push(`- City: ${patient.city}`);
  lines.push(`- Timezone: ${patient.timezone}`);

  return lines.join("\n");
}
