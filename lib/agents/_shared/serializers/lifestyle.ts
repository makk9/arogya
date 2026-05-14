import type { LifestyleChange, LifestyleProfile } from "@/db/schema";

import { compareById, formatISODate } from "./format";

export function lifestyleSlug(): string {
  return "lifestyle:profile";
}

export function serializeLifestyle(
  profile: LifestyleProfile | undefined,
  changes: readonly LifestyleChange[],
): string {
  if (!profile && changes.length === 0) return "";

  const lines: string[] = ["# Lifestyle", ""];

  if (profile) {
    lines.push(`## § ${lifestyleSlug()}`);
    lines.push("");
    if (profile.dietPattern) lines.push(`- Diet pattern: ${profile.dietPattern}`);
    if (profile.dietRestrictions && profile.dietRestrictions.length > 0) {
      lines.push(
        `- Diet restrictions: ${profile.dietRestrictions.slice().sort().join(", ")}`,
      );
    }
    if (profile.exercisePattern) {
      lines.push(`- Exercise pattern: ${profile.exercisePattern}`);
    }
    if (profile.exerciseIntensity) {
      lines.push(`- Exercise intensity: ${profile.exerciseIntensity}`);
    }
    if (profile.sleepPattern) lines.push(`- Sleep pattern: ${profile.sleepPattern}`);
    if (profile.stressLevel) lines.push(`- Stress level: ${profile.stressLevel}`);
    if (profile.stressContext) {
      lines.push(`- Stress context: ${profile.stressContext}`);
    }
    if (profile.tobaccoUse) lines.push(`- Tobacco use: ${profile.tobaccoUse}`);
    if (profile.alcoholUse) lines.push(`- Alcohol use: ${profile.alcoholUse}`);
    if (profile.notes) lines.push(`- Notes: ${profile.notes}`);
  }

  if (changes.length > 0) {
    const sorted = changes.slice().sort((a, b) => {
      const t = b.changedAt.getTime() - a.changedAt.getTime();
      return t !== 0 ? t : compareById(a, b);
    });
    lines.push("");
    lines.push("### Changes");
    for (const c of sorted) {
      const date = formatISODate(c.changedAt);
      const reason = c.reason ? ` (${c.reason})` : "";
      lines.push(
        `- ${date} — ${c.field}: ${c.oldValue ?? "—"} → ${c.newValue ?? "—"}${reason}`,
      );
    }
  }

  return lines.join("\n").trimEnd();
}
