/**
 * Seeds crafted extraction sessions for the E3 (§6.11) verify-ui run. Does NOT
 * call the model — it writes deterministic `ready_for_confirmation` sessions so
 * the confirmation surface + commit engine can be driven in the browser without
 * live extraction. All throwaway rows are ZZZ-prefixed / tracked by id; the
 * update card targets a throwaway ZZZ medication, never the real seed vault.
 *
 * Prints a JSON blob of ids for the driver + cleanup. Run:
 *   tsx --conditions react-server --env-file=.env.local scripts/seed-e3-verify.ts
 */
import { extractionSessionQueries, medicationQueries, reportQueries } from "../db/queries";
import { STUB_PATIENT_ID } from "../lib/auth";
import type { ExtractionOutput } from "../lib/agents/_shared/schemas";

async function main(): Promise<void> {
  const patientId = STUB_PATIENT_ID;
  const today = new Date().toISOString().slice(0, 10);

  // Throwaway med the "update" card mutates (dose 5mg → 10mg on commit).
  const throwaway = await medicationQueries.create({
    patientId,
    name: "ZZZ Verify Amlodipine",
    currentDose: "5 mg",
    currentFrequency: "once daily",
    category: "allopathic",
  });

  async function mkReport(title: string, content: string) {
    return reportQueries.create({
      patientId,
      title,
      reportDate: today,
      content,
      status: "extracting",
    });
  }

  async function mkSession(
    reportId: string,
    status: "ready_for_confirmation" | "failed",
    output: ExtractionOutput,
  ) {
    return extractionSessionQueries.create({
      patientId,
      reportId,
      status,
      extractionOutputJson: output,
    });
  }

  // --- Session A: main happy path (3 cards, 2 types) ---
  const reportA = await mkReport(
    "ZZZ Verify Rx",
    "ZZZ Verify Rx\nAmlodipine 5mg once daily\nAmlodipine dose raised to 10mg\nLipid panel: LDL 130 mg/dL (H)",
  );
  const outputA: ExtractionOutput = {
    extractions: [
      {
        intent: "create",
        target_entity_type: "medication",
        matched_entity_id: null,
        extracted_data: {
          name: "ZZZ Extracted Amlodipine",
          current_dose: "5mg",
          current_frequency: "once daily",
        },
        // Non-intent ambiguity → target field renders (pending), Confirm blocked.
        ambiguities: [
          {
            field: "current_dose",
            question: "I read the dose as 5mg — is that right?",
            options: ["5mg", "10mg"],
          },
        ],
        source_excerpt: "Amlodipine 5mg once daily",
      },
      {
        intent: "update",
        target_entity_type: "medication",
        matched_entity_id: throwaway.id,
        extracted_data: {
          name: "ZZZ Verify Amlodipine",
          current_dose: "10 mg",
        },
        ambiguities: [],
        source_excerpt: "Amlodipine dose raised to 10mg",
      },
      {
        intent: "create",
        target_entity_type: "lab_report",
        matched_entity_id: null,
        extracted_data: {
          title: "ZZZ Verify Lipid Panel",
          report_date: today,
          results: [
            {
              marker: "LDL",
              value: "130",
              unit: "mg/dL",
              reference_range: "0-100",
              flag: "high",
            },
          ],
        },
        ambiguities: [],
        source_excerpt: "Lipid panel: LDL 130 mg/dL (H)",
      },
    ],
  };
  const sessionA = await mkSession(reportA.id, "ready_for_confirmation", outputA);

  // --- Session B: total-failure state ---
  const reportB = await mkReport("ZZZ Verify Blurry", "ZZZ Verify Blurry (unreadable)");
  const sessionB = await mkSession(reportB.id, "failed", { extractions: [] });

  // --- Session C: edit-manually prefill ---
  const reportC = await mkReport("ZZZ Verify EditMe", "ZZZ Verify EditMe\nMetformin 500mg twice daily");
  const outputC: ExtractionOutput = {
    extractions: [
      {
        intent: "create",
        target_entity_type: "medication",
        matched_entity_id: null,
        extracted_data: {
          name: "ZZZ Extracted Metformin",
          current_dose: "500mg",
          current_frequency: "twice daily",
          form: "tablet",
        },
        ambiguities: [],
        source_excerpt: "Metformin 500mg twice daily",
      },
    ],
  };
  const sessionC = await mkSession(reportC.id, "ready_for_confirmation", outputC);

  console.log(
    "E3_SEED_JSON=" +
      JSON.stringify({
        patientId,
        throwawayMedId: throwaway.id,
        sessionA: sessionA.id,
        reportA: reportA.id,
        sessionB: sessionB.id,
        reportB: reportB.id,
        sessionC: sessionC.id,
        reportC: reportC.id,
      }),
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
