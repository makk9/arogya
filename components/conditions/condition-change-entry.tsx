import {
  SEVERITY_OPTIONS,
  STATUS_OPTIONS,
} from "@/components/conditions/condition-options";
import type { ConditionChange } from "@/db/schema";
import { formatAbsoluteDate, formatRelative } from "@/lib/datetime";
import { displayDoctorName } from "@/lib/doctor-display";
import { EntityTypeGlyph } from "@/components/entity-type-glyph";

export interface DoctorRef {
  name: string;
  specialty: string;
}

interface Props {
  change: ConditionChange;
  doctorLookup: Record<string, DoctorRef>;
}

// Clones medication-change-entry.tsx. The three logged fields are the §6.5
// Condition History axes. `managing_doctor` carries UUIDs (resolved via
// doctorLookup); status / severity carry enum values rendered through their
// shared label maps. `oldValue == null` renders "set to X".

const FIELD_LABEL: Record<ConditionChange["field"], string> = {
  status: "STATUS",
  severity: "SEVERITY",
  managing_doctor: "MANAGING DOCTOR",
  // The DB enum permits "notes", but notes is inline-edited (not change-logged)
  // — this label is defensive and should never render in practice.
  notes: "NOTES",
};

const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((o) => [o.value, o.label]),
);
const SEVERITY_LABEL: Record<string, string> = Object.fromEntries(
  SEVERITY_OPTIONS.map((o) => [o.value, o.label]),
);

function renderDoctorPill(
  uuid: string | null,
  lookup: Record<string, DoctorRef>,
) {
  if (!uuid) return <>—</>;
  const doc = lookup[uuid];
  if (!doc) return <span className="text-muted-foreground">Dr (removed)</span>;
  return (
    <span>
      <EntityTypeGlyph letter="D" />
      {displayDoctorName(doc.name)} ·{" "}
      {doc.specialty}
    </span>
  );
}

function renderEnumValue(field: ConditionChange["field"], value: string) {
  if (field === "status") return STATUS_LABEL[value] ?? value;
  if (field === "severity") return SEVERITY_LABEL[value] ?? value;
  return value;
}

function renderTransition(
  change: ConditionChange,
  doctorLookup: Record<string, DoctorRef>,
) {
  if (change.field === "managing_doctor") {
    if (!change.oldValue) {
      return <>set to {renderDoctorPill(change.newValue, doctorLookup)}</>;
    }
    return (
      <>
        <s className="text-muted-foreground">
          {renderDoctorPill(change.oldValue, doctorLookup)}
        </s>
        {" → "}
        {renderDoctorPill(change.newValue, doctorLookup)}
      </>
    );
  }

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

export function ConditionChangeEntry({ change, doctorLookup }: Props) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-3 border-l-2 border-border py-2 pl-4">
      <div className="font-mono text-xs leading-snug text-muted-foreground">
        <div>{formatRelative(change.changedAt)}</div>
        <div className="text-muted-foreground/70">
          {formatAbsoluteDate(change.changedAt)}
        </div>
      </div>
      <div className="space-y-1">
        <div className="text-sm">
          <span className="mr-2 font-mono text-xs text-muted-foreground">
            {FIELD_LABEL[change.field]}
          </span>
          {renderTransition(change, doctorLookup)}
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
