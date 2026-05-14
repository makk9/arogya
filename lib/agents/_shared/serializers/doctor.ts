import type { Doctor, DoctorChange } from "@/db/schema";

import { compareById, formatISODate, slugify, sortStable } from "./format";

export function doctorSlug(doctor: Doctor): string {
  return `doctor:${slugify(doctor.name)}`;
}

export function serializeDoctors(
  doctors: readonly Doctor[],
  changes: readonly DoctorChange[],
): string {
  if (doctors.length === 0) return "";

  const sorted = sortStable(doctors, (d) =>
    d.firstVisit ? -new Date(d.firstVisit).getTime() : 0,
  );

  const changesByDoctor = new Map<string, DoctorChange[]>();
  for (const c of changes) {
    const list = changesByDoctor.get(c.doctorId) ?? [];
    list.push(c);
    changesByDoctor.set(c.doctorId, list);
  }

  const lines: string[] = ["# Doctors", ""];

  for (const d of sorted) {
    lines.push(`## § ${doctorSlug(d)}`);
    lines.push("");
    lines.push(`- Name: ${d.name}`);
    lines.push(`- Specialty: ${d.specialty}`);
    if (d.clinic) lines.push(`- Clinic: ${d.clinic}`);
    if (d.firstVisit) {
      lines.push(`- First visit: ${formatISODate(d.firstVisit)}`);
    }
    if (d.phone) lines.push(`- Phone: ${d.phone}`);
    if (d.email) lines.push(`- Email: ${d.email}`);
    if (d.address) lines.push(`- Address: ${d.address}`);
    if (d.notes) lines.push(`- Notes: ${d.notes}`);

    const docChanges = (changesByDoctor.get(d.id) ?? [])
      .slice()
      .sort((a, b) => {
        const t = b.changedAt.getTime() - a.changedAt.getTime();
        return t !== 0 ? t : compareById(a, b);
      });
    if (docChanges.length > 0) {
      lines.push("");
      lines.push("### Changes");
      for (const c of docChanges) {
        const date = formatISODate(c.changedAt);
        const fragment = `${c.field}: ${c.oldValue ?? "—"} → ${c.newValue ?? "—"}`;
        const reason = c.reason ? ` (${c.reason})` : "";
        lines.push(`- ${date} — ${fragment}${reason}`);
      }
    }
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}
