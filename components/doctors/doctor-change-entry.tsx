import type { DoctorChange } from "@/db/schema";
import { formatAbsoluteDate, formatRelativeDate } from "@/lib/datetime";

interface Props {
  change: DoctorChange;
}

/*
 * Clones condition-change-entry.tsx, simpler: both logged fields (specialty /
 * clinic — decisions.md 2026-06-09) carry free-text values, so there are no
 * label maps and no uuid lookups. `oldValue == null` renders "set to X"
 * (a clinic being recorded for the first time). doctor_changes.field is plain
 * text in the DB; unknown values render uppercased as-is (defensive).
 */
export function DoctorChangeEntry({ change }: Props) {
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
          <span className="mr-2 font-mono text-xs uppercase text-muted-foreground">
            {change.field}
          </span>
          {change.oldValue ? (
            <>
              <s className="text-muted-foreground">{change.oldValue}</s>
              {" → "}
              <span>{change.newValue ?? "—"}</span>
            </>
          ) : (
            <>set to {change.newValue ?? "—"}</>
          )}
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
