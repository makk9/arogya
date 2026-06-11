import type { MedicationChange } from "@/db/schema";
import { formatAbsoluteDate, formatRelative } from "@/lib/datetime";
import { displayDoctorName } from "@/lib/doctor-display";
import { EntityTypeGlyph } from "@/components/entity-type-glyph";

export interface DoctorRef {
  name: string;
  specialty: string;
}

export interface VisitRef {
  visitDate: string;
  doctorName: string;
}

interface Props {
  change: MedicationChange;
  doctorLookup: Record<string, DoctorRef>;
  visitLookup: Record<string, VisitRef>;
}

// `prescribing_doctor` carries UUIDs (resolved via doctorLookup), not text.
// `oldValue == null` renders "set to X" — item 5's `+ Log a change` form
// will write such rows even though v1 today does not.

const FIELD_LABEL: Record<MedicationChange["field"], string> = {
  dose: "DOSE",
  frequency: "FREQUENCY",
  status: "STATUS",
  prescribing_doctor: "PRESCRIBING DOCTOR",
};

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

function renderTransition(
  change: MedicationChange,
  doctorLookup: Record<string, DoctorRef>,
) {
  if (change.field === "prescribing_doctor") {
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
  if (!change.oldValue) {
    return <>set to {change.newValue}</>;
  }
  return (
    <>
      <s className="text-muted-foreground">{change.oldValue}</s>
      {" → "}
      <span>{change.newValue}</span>
    </>
  );
}

export function MedicationChangeEntry({
  change,
  doctorLookup,
  visitLookup,
}: Props) {
  const linkedVisit = change.linkedVisitId
    ? visitLookup[change.linkedVisitId]
    : null;

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
        {linkedVisit ? (
          <div className="text-xs text-muted-foreground">
            Linked: <span className="text-foreground">V</span> Visit · Dr{" "}
            {linkedVisit.doctorName} ·{" "}
            {formatAbsoluteDate(linkedVisit.visitDate)}
          </div>
        ) : null}
      </div>
    </div>
  );
}
