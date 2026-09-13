import {
  SEVERITY_OPTIONS,
  STATUS_OPTIONS,
} from "@/components/allergies/allergy-options";
import type { AllergyChange } from "@/db/schema";
import { formatAbsoluteDate, formatRelativeDate } from "@/lib/datetime";

interface Props {
  change: AllergyChange;
}

// Clones condition-change-entry.tsx, simpler: the two logged fields (status /
// severity, the §6.5:1402 Allergy History axes) both carry enum values — no
// doctor uuids to resolve. `oldValue == null` renders "set to X".
// allergy_changes.field is a plain text column, so the label map falls back to
// uppercasing an unexpected value rather than failing a Record lookup.

const FIELD_LABEL: Record<string, string> = {
  status: "STATUS",
  severity: "SEVERITY",
};

const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label]),
);
const SEVERITY_LABEL: Record<string, string> = Object.fromEntries(
  SEVERITY_OPTIONS.map((o) => [o.value, o.label]),
);

function renderEnumValue(field: string, value: string) {
  if (field === "status") return STATUS_LABEL[value] ?? value;
  if (field === "severity") return SEVERITY_LABEL[value] ?? value;
  return value;
}

function renderTransition(change: AllergyChange) {
  const newLabel = change.newValue
    ? renderEnumValue(change.field, change.newValue)
    : "—";
  if (!change.oldValue) {
    return <>set to {newLabel}</>;
  }
  return (
    <>
      <s className="text-muted-foreground">
        {renderEnumValue(change.field, change.oldValue)}
      </s>
      {" → "}
      <span>{newLabel}</span>
    </>
  );
}

export function AllergyChangeEntry({ change }: Props) {
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
            {FIELD_LABEL[change.field] ?? change.field.toUpperCase()}
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
