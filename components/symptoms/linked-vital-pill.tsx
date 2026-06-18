import type { VitalReading } from "@/db/schema";
import { READING_TYPE_LABEL, formatVitalValue } from "@/components/vitals/vital-options";

/*
 * The §6.6 `●` linked-vital pill shown below a symptom episode (and as a row in
 * the episode detail's "Captured at this episode"). §6.6 lists these as
 * "clickable → navigate to the linked vital reading", but VitalReading has no
 * detail page in v1 (item 11 — vitals are create-only), so the pill is a
 * non-navigating display span. The reading's value + time are shown inline
 * instead; flagged in decisions.md. The `●` glyph matches the citation-pill
 * design language (§6.6 result-badge glyph set).
 */

const TIME_FMT = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

function timeLabel(d: Date): string {
  return TIME_FMT.format(d).replace(" ", "").toLowerCase();
}

export function LinkedVitalPill({ reading }: { reading: VitalReading }) {
  const typeLabel = READING_TYPE_LABEL[reading.readingType] ?? reading.readingType;
  return (
    <span className="inline-flex items-baseline gap-1 rounded-full border border-border bg-muted px-2 py-0.5 font-mono text-[0.7rem] text-muted-foreground">
      <span aria-hidden>●</span>
      {typeLabel} {formatVitalValue(reading)} · {timeLabel(reading.recordedAt)}
    </span>
  );
}
