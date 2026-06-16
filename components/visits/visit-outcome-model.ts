import type { VisitOutcomes } from "@/db/queries/visit";

/*
 * Maps a visit's outcome backlinks (med changes / lab reports / reports) to
 * the render models shared by the §6.6 result badges and the §6.7 Outcomes
 * rows. Pure server-side shaping — glyph language per 6.6: `↑` dose/frequency
 * change, `≡` orders, `+` additions, plus `↔` for med STATUS transitions
 * (discontinue/pause/resume). The §6.6 sketch shows `↑` only for a dose raise;
 * reusing it for "discontinued" implied the wrong direction, so status gets a
 * non-directional glyph instead — the spec invites "different glyphs telling
 * different stories." Magnitude direction for dose is deliberately NOT inferred
 * (free-text doses like "5 mg" / "1x daily" don't parse reliably), so `↑` stays
 * a generic change arrow for dose/frequency.
 *
 * `significant` drives the one-per-page warm-tint rule (§6.7): the first
 * dose/status medication change is the clinically loudest outcome; everything
 * else stays neutral.
 *
 * `href` is only set for entity types whose detail pages exist. Med changes and
 * lab reports link out; uploaded reports render as plain badges until the Report
 * vertical lands (Phase D remainder) — §6.6's "badges are clickable" applies
 * where there is somewhere to go.
 */

export interface OutcomeItem {
  key: string;
  glyph: "↑" | "↔" | "≡" | "+";
  /** Badge text (§6.6 card) — also the §6.7 row title. */
  text: string;
  /** Italicized quoted reason on the §6.7 row, when recorded. */
  reason: string | null;
  /** §6.7 link-out label, e.g. "View medication →". */
  linkLabel: string | null;
  href: string | null;
  significant: boolean;
}

const MED_FIELD_LABEL: Record<string, string> = {
  dose: "dose",
  frequency: "frequency",
  status: "status",
  prescribing_doctor: "prescriber",
};

export function buildOutcomeItems(
  outcomes: VisitOutcomes,
  patientId: string,
): OutcomeItem[] {
  const items: OutcomeItem[] = [];
  let significantTaken = false;

  for (const mc of outcomes.medChanges) {
    const { change, medicationId, medicationName } = mc;
    const fieldLabel = MED_FIELD_LABEL[change.field] ?? change.field;

    let text: string;
    let glyph: OutcomeItem["glyph"];
    if (change.field === "dose" || change.field === "frequency") {
      glyph = "↑";
      text =
        change.oldValue && change.newValue
          ? `${medicationName} ${change.oldValue} → ${change.newValue}`
          : `${medicationName} ${fieldLabel} changed`;
    } else if (change.field === "status") {
      glyph = "↔";
      text = change.newValue
        ? `${medicationName} ${change.newValue}`
        : `${medicationName} status changed`;
    } else {
      // prescriber change — also a non-directional transition.
      glyph = "↔";
      text = `${medicationName} ${fieldLabel} changed`;
    }

    const isLoud = change.field === "dose" || change.field === "status";
    const significant = isLoud && !significantTaken;
    if (significant) significantTaken = true;

    items.push({
      key: `med-change-${change.id}`,
      glyph,
      text,
      reason: change.reason,
      linkLabel: "View medication →",
      href: `/patient/${patientId}/medications/${medicationId}`,
      significant,
    });
  }

  for (const lab of outcomes.labReports) {
    const what = lab.reportType ?? lab.labName ?? "Lab report";
    items.push({
      key: `lab-${lab.id}`,
      glyph: "≡",
      text: `${what} ordered`,
      reason: null,
      // Lab detail page landed (Phase D Labs vertical) — link out to it.
      linkLabel: "View lab report →",
      href: `/patient/${patientId}/labs/${lab.id}`,
      significant: false,
    });
  }

  for (const report of outcomes.reports) {
    items.push({
      key: `report-${report.id}`,
      glyph: "+",
      text: report.title,
      reason: null,
      // No report detail page yet (Phase D remainder) — badge stays inert.
      linkLabel: null,
      href: null,
      significant: false,
    });
  }

  return items;
}
