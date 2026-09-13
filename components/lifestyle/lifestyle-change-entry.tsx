import {
  TREND_FIELD_LABEL,
  trendValueLabel,
} from "@/components/lifestyle/lifestyle-options";
import type { LifestyleChange } from "@/db/schema";
import { formatAbsoluteDate, formatRelativeDate } from "@/lib/datetime";

interface Props {
  change: LifestyleChange;
}

/*
 * One change-log row — the §4:538 trend story ("patient cut sugar in March
 * 2026" as a discrete entry). Clones allergy-change-entry.tsx; the twist is
 * that three of the seven fields carry free-text narrative values, so the
 * strikethrough old → new can be long — values stay inline (matching the
 * locked §6.5:1409 pattern) and wrap naturally.
 * lifestyle_changes.field is a plain text column, so the label map falls back
 * to uppercasing an unexpected value rather than failing a Record lookup.
 */

function renderTransition(change: LifestyleChange) {
  const newLabel = change.newValue
    ? trendValueLabel(change.field, change.newValue)
    : "—";
  if (!change.oldValue) {
    return <>set to {newLabel}</>;
  }
  return (
    <>
      <s className="text-muted-foreground">
        {trendValueLabel(change.field, change.oldValue)}
      </s>
      {" → "}
      <span>{newLabel}</span>
    </>
  );
}

export function LifestyleChangeEntry({ change }: Props) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-3 border-l-2 border-border py-2 pl-4">
      <div className="font-mono text-xs leading-snug text-muted-foreground">
        <div>{formatRelativeDate(change.changedAt)}</div>
        <div className="text-muted-foreground/70">
          {formatAbsoluteDate(change.changedAt)}
        </div>
      </div>
      <div className="space-y-1">
        <div className="text-sm">
          <span className="mr-2 font-mono text-xs text-muted-foreground">
            {(TREND_FIELD_LABEL[change.field] ?? change.field).toUpperCase()}
          </span>
          {renderTransition(change)}
        </div>
        {change.reason ? (
          <div className="text-xs italic text-muted-foreground">
            &ldquo;{change.reason}&rdquo;
          </div>
        ) : null}
      </div>
    </div>
  );
}
