import "server-only";

import { allergyQueries } from "@/db/queries/allergy";
import { conditionQueries } from "@/db/queries/condition";
import { doctorQueries } from "@/db/queries/doctor";
import { familyHistoryQueries } from "@/db/queries/family-history";
import { insightQueries } from "@/db/queries/insight";
import { journalQueries } from "@/db/queries/journal";
import { labReportQueries, labResultQueries } from "@/db/queries/lab";
import { medicationQueries } from "@/db/queries/medication";
import { patientQueries } from "@/db/queries/patient";
import { reportQueries } from "@/db/queries/report";
import {
  symptomEpisodeQueries,
  symptomTypeQueries,
} from "@/db/queries/symptom";
import { visitQueries } from "@/db/queries/visit";
import type { CurrentPatient } from "@/lib/auth";
import {
  ALLERGIES_LIST_SURFACE,
  CONDITIONS_LIST_SURFACE,
  DASHBOARD_SURFACE,
  DOCTORS_LIST_SURFACE,
  FAMILY_HISTORY_LIST_SURFACE,
  INSIGHTS_LIST_SURFACE,
  JOURNAL_LIST_SURFACE,
  LABS_LIST_SURFACE,
  LIFESTYLE_SURFACE,
  MEDICATIONS_LIST_SURFACE,
  REPORTS_LIST_SURFACE,
  SYMPTOMS_LIST_SURFACE,
  VISITS_LIST_SURFACE,
  VITALS_HISTORY_SURFACE,
  allergySurfaceContext,
  conditionSurfaceContext,
  doctorSurfaceContext,
  familyHistorySurfaceContext,
  insightSurfaceContext,
  journalSurfaceContext,
  labReportSurfaceContext,
  medicationSurfaceContext,
  patientProfileSurfaceContext,
  reportSurfaceContext,
  symptomEpisodeSurfaceContext,
  symptomTypeSurfaceContext,
  visitSurfaceContext,
} from "@/lib/chat/surface-context";
import type { SurfaceRef } from "@/lib/chat/surface-ref";
import { displayDoctorName } from "@/lib/doctor-display";
import { isFlagged } from "@/lib/labs";

/**
 * Resolves a typed surface ref (lib/chat/surface-ref.ts) into the prose
 * surface-context string the synthesis prompt embeds. Entity refs re-query the
 * entity scoped to the current patient — the client asserts only "which page,"
 * never the words that reach the model. Returns null when the id doesn't
 * resolve in this patient's record (tampered, or a stale tab after a delete);
 * the route turns that into a 400.
 *
 * Takes the full CurrentPatient (not just the id): the patient-profile surface
 * needs `relationship`, which lives on the auth identity, not the patients row.
 */
export async function resolveSurfaceContext(
  current: CurrentPatient,
  ref: SurfaceRef,
): Promise<string | null> {
  const { patientId } = current;

  switch (ref.key) {
    case "dashboard":
      return DASHBOARD_SURFACE;
    case "vitals-history":
      return VITALS_HISTORY_SURFACE;
    case "lifestyle":
      return LIFESTYLE_SURFACE;
    case "medications-list":
      return MEDICATIONS_LIST_SURFACE;
    case "conditions-list":
      return CONDITIONS_LIST_SURFACE;
    case "doctors-list":
      return DOCTORS_LIST_SURFACE;
    case "allergies-list":
      return ALLERGIES_LIST_SURFACE;
    case "family-history-list":
      return FAMILY_HISTORY_LIST_SURFACE;
    case "visits-list":
      return VISITS_LIST_SURFACE;
    case "labs-list":
      return LABS_LIST_SURFACE;
    case "symptoms-list":
      return SYMPTOMS_LIST_SURFACE;
    case "reports-list":
      return REPORTS_LIST_SURFACE;
    case "journal-list":
      return JOURNAL_LIST_SURFACE;
    case "insights-list":
      return INSIGHTS_LIST_SURFACE;

    case "patient-profile": {
      const patient = await patientQueries.getById(patientId);
      if (!patient) return null;
      return patientProfileSurfaceContext({
        name: patient.name,
        relationship: current.relationship,
      });
    }

    case "medication": {
      const medication = await medicationQueries.getById(patientId, ref.id);
      return medication ? medicationSurfaceContext(medication) : null;
    }

    case "condition": {
      const condition = await conditionQueries.getById(patientId, ref.id);
      return condition ? conditionSurfaceContext(condition) : null;
    }

    case "allergy": {
      const allergy = await allergyQueries.getById(patientId, ref.id);
      return allergy ? allergySurfaceContext(allergy) : null;
    }

    case "doctor": {
      const doctor = await doctorQueries.getById(patientId, ref.id);
      return doctor ? doctorSurfaceContext(doctor) : null;
    }

    case "insight": {
      const insight = await insightQueries.getById(patientId, ref.id);
      return insight ? insightSurfaceContext(insight) : null;
    }

    case "symptom-type": {
      const type = await symptomTypeQueries.getById(patientId, ref.id);
      if (!type) return null;
      const episodes = await symptomEpisodeQueries.forType(patientId, ref.id);
      return symptomTypeSurfaceContext({
        name: type.name,
        status: type.status,
        episodeCount: episodes.length,
      });
    }

    case "symptom-episode": {
      const episode = await symptomEpisodeQueries.getById(patientId, ref.id);
      if (!episode) return null;
      const type = await symptomTypeQueries.getById(
        patientId,
        episode.symptomTypeId,
      );
      if (!type) return null;
      return symptomEpisodeSurfaceContext({
        symptomTypeName: type.name,
        startedAt: episode.startedAt.toISOString().slice(0, 10),
        severity: episode.severity,
      });
    }

    case "lab-report": {
      const report = await labReportQueries.getById(patientId, ref.id);
      if (!report) return null;
      const results = await labResultQueries.forReport(report.id);
      return labReportSurfaceContext({
        reportDate: report.reportDate,
        reportType: report.reportType,
        labName: report.labName,
        flaggedCount: results.filter((r) => isFlagged(r.flag)).length,
      });
    }

    case "visit": {
      const visit = await visitQueries.getById(patientId, ref.id);
      if (!visit) return null;
      const doctor = visit.doctorId
        ? await doctorQueries.getById(patientId, visit.doctorId)
        : null;
      return visitSurfaceContext({
        visitDate: visit.visitDate,
        doctorName: doctor ? displayDoctorName(doctor.name) : null,
        status: visit.status,
      });
    }

    case "report": {
      const report = await reportQueries.getById(patientId, ref.id);
      return report ? reportSurfaceContext(report) : null;
    }

    case "journal-entry": {
      const entry = await journalQueries.getById(patientId, ref.id);
      return entry ? journalSurfaceContext(entry) : null;
    }

    case "family-history-entry": {
      const entry = await familyHistoryQueries.getById(patientId, ref.id);
      return entry ? familyHistorySurfaceContext(entry) : null;
    }
  }
}
