/**
 * Smoke test for the file upload pipeline (E2, §9.4).
 *
 * Tier 1 (no API key): pure path helpers + the /process trust boundary
 *   (a path outside the patient's upload namespace is rejected before any I/O).
 * Tier 2 (ANTHROPIC_API_KEY + a configured `arogya` bucket): a real round-trip —
 *   build a minimal text PDF, get a signed upload URL, PUT it to storage, run
 *   processUpload, assert the Report + extraction_session outcome, then clean up.
 *
 * Prereqs for Tier 2: `npm run storage:setup` (bucket) and a seeded patient.
 * Run via:  npm run file-pipeline:check
 */

import { getCurrentPatient, STUB_PATIENT_ID } from "../lib/auth";
import { extractionSessionQueries, reportQueries } from "../db/queries";
import { processUpload } from "../lib/files/pipeline";
import type { ExtractionOutput } from "../lib/agents/_shared/schemas";
import {
  buildUploadPath,
  createSignedUploadUrl,
  deleteFile,
  uploadPathPrefix,
} from "../lib/storage";

function assert(condition: unknown, message: string): void {
  if (!condition) {
    console.error(`ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
}

// Minimal single-page PDF carrying one line of text, with a correct xref table
// (byte offsets computed from the assembled body). latin1 keeps string length ==
// byte length so the offsets are exact. No parens in the text (PDF-string syntax).
function buildTextPdf(text: string): Buffer {
  const objects = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>",
    `<</Length 0>>\nstream\nBT /F1 16 Tf 72 720 Td (${text}) Tj ET\nendstream`,
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
  ];

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((off) => {
    pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(pdf, "latin1");
}

async function checkHelpers(): Promise<void> {
  console.log("=== Tier 1: path helpers + trust boundary ===\n");

  const prefix = uploadPathPrefix(STUB_PATIENT_ID);
  assert(
    prefix === `patients/${STUB_PATIENT_ID}/uploads/`,
    "uploadPathPrefix is patient-namespaced",
  );
  const path = buildUploadPath(STUB_PATIENT_ID, "Lab Report (Apr 3).pdf");
  assert(path.startsWith(prefix), "buildUploadPath sits under the prefix");
  assert(
    !/[^a-zA-Z0-9._/-]/.test(path),
    "buildUploadPath sanitizes the filename to safe storage chars",
  );
  console.log(`  prefix: ${prefix}`);
  console.log(`  built path: ${path}`);

  // Trust boundary: a path outside the patient's namespace is refused before any
  // storage/AI work — no Report or session is created.
  const { timezone } = await getCurrentPatient();
  const rejected = await processUpload({
    patientId: STUB_PATIENT_ID,
    timezone,
    path: `patients/some-other-patient/uploads/evil.pdf`,
    mimeType: "application/pdf",
  });
  assert(
    rejected.ok === false && rejected.reason === "path_out_of_scope",
    "processUpload rejects an out-of-namespace path",
  );
  console.log("  out-of-scope path → rejected ✓");
  console.log("\n✓ Tier 1 assertions passed.\n");
}

async function checkRoundTrip(): Promise<void> {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log(
      "ANTHROPIC_API_KEY not set — skipping Tier 2 round-trip (expected in CI without the secret).",
    );
    return;
  }

  console.log("=== Tier 2: signed upload → PUT → process (live) ===\n");

  const pdf = buildTextPdf(
    "Prescription. Telmisartan 80 mg once daily. Prescribed by Dr. Kavita Menon.",
  );
  const path = buildUploadPath(STUB_PATIENT_ID, "test-rx.pdf");

  // 1. Signed upload URL.
  const { signedUrl } = await createSignedUploadUrl(path);
  console.log(`  signed upload URL issued for ${path}`);

  // 2. Browser-style direct PUT to storage.
  const putRes = await fetch(signedUrl, {
    method: "PUT",
    headers: { "content-type": "application/pdf" },
    body: new Uint8Array(pdf),
  });
  assert(
    putRes.ok,
    `PUT to signed URL succeeded (got ${putRes.status} ${putRes.statusText})`,
  );
  console.log(`  PUT ${pdf.byteLength} bytes → ${putRes.status}`);

  let reportId: string | undefined;
  try {
    // 3. Process: create Report + session, run extraction.
    const startedAt = Date.now();
    const { timezone } = await getCurrentPatient();
    const result = await processUpload({
      patientId: STUB_PATIENT_ID,
      timezone,
      path,
      mimeType: "application/pdf",
    });
    assert(result.ok, "processUpload returned ok");
    if (!result.ok) return;
    reportId = result.reportId;
    console.log(`  processed in ${Date.now() - startedAt}ms`);

    // 4. Inspect the persisted state.
    const session = await extractionSessionQueries.getById(
      STUB_PATIENT_ID,
      result.extractionSessionId,
    );
    const report = await reportQueries.getById(STUB_PATIENT_ID, result.reportId);
    assert(session !== null, "extraction session row exists");
    assert(report !== null, "report row exists");
    assert(
      report?.sourceFileUrl === path,
      "report holds the source file path",
    );

    console.log(`  session.status = ${session?.status}`);
    console.log(`  report.status  = ${report?.status}`);

    if (session?.status === "ready_for_confirmation") {
      const out = session.extractionOutputJson as ExtractionOutput;
      console.log(
        `  extractions (${out.extractions.length}):\n${JSON.stringify(out.extractions, null, 2)}`,
      );
      assert(
        out.extractions.length > 0,
        "ready session carries at least one extraction",
      );
      assert(
        report?.status === "extracting",
        "report stays 'extracting' until E3 commit",
      );
      const med = out.extractions.find(
        (e) => e.target_entity_type === "medication",
      );
      if (med) {
        console.log(
          `  ✓ medication extracted: intent=${med.intent} matched=${med.matched_entity_id ?? "null"}`,
        );
      } else {
        console.warn("  ⚠ no medication extracted from the Rx PDF (eyeball above)");
      }
    } else {
      // failed: the agent couldn't read the synthetic PDF. Plumbing still proven
      // (report→failed, session→failed); extraction quality is covered by
      // extraction:check (text) + a real upload at E3.
      assert(session?.status === "failed", "non-ready session is 'failed'");
      assert(report?.status === "failed", "failed extraction marks report failed");
      console.warn(
        "  ⚠ extraction returned empty for the synthetic PDF — failure plumbing verified, quality not.",
      );
    }
  } finally {
    // Cleanup: deleting the report cascades the extraction_session (FK
    // onDelete:cascade); then remove the stored file.
    if (reportId) await reportQueries.delete(STUB_PATIENT_ID, reportId);
    await deleteFile(path);
    console.log("\n  cleaned up test report + file.");
  }

  console.log("\n✓ Tier 2 round-trip complete.\n");
}

async function main(): Promise<void> {
  await checkHelpers();
  await checkRoundTrip();
  console.log("file-pipeline:check done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("file-pipeline:check FAILED:", err);
  process.exit(1);
});
