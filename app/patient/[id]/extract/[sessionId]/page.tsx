import Link from "next/link";
import { notFound } from "next/navigation";

import { Breadcrumb } from "@/components/breadcrumb";
import { FilePreview } from "@/components/reports/file-preview";
import { extractionSessionQueries, reportQueries } from "@/db/queries";
import { parseStoredExtractionOutput } from "@/lib/agents/extraction";
import { getCurrentPatient } from "@/lib/auth";
import { mimeFromPath } from "@/lib/files/mime";
import { getSignedUrl } from "@/lib/storage";

// db queries + storage signing require Node.
export const runtime = "nodejs";

/**
 * STUB extraction-confirmation page (E3 placeholder). The router's `log` branch
 * and the upload pipeline both land here; this renders enough to verify the
 * loop end-to-end — source preview + the parsed extractions — but is NOT the
 * §6.11 surface. E3 replaces it with the split-panel confirmation UI
 * (ambiguity chips, new-vs-update toggles, per-card Confirm/Discard, commit).
 */
export default async function ExtractConfirmStubPage({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>;
}) {
  const { id, sessionId } = await params;
  const { patientId } = await getCurrentPatient();
  if (id !== patientId) notFound();

  const session = await extractionSessionQueries.getById(patientId, sessionId);
  if (!session) notFound();

  const report = await reportQueries.getById(patientId, session.reportId);
  const output = parseStoredExtractionOutput(session.extractionOutputJson);
  const extractions = output?.extractions ?? [];
  const isFailure = session.status === "failed" || extractions.length === 0;

  // Source: a quick-log Report carries the typed text in `content`; an uploaded
  // Report carries a file path in `sourceFileUrl` (signed per-load).
  const fileUrl = report?.sourceFileUrl
    ? await getSignedUrl(report.sourceFileUrl)
    : null;

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <Breadcrumb
        patientId={patientId}
        trail={[
          { label: "extract" },
          { label: `${sessionId.slice(0, 8)}…` },
        ]}
      />

      <div className="mb-6 rounded-md border border-dashed border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
        <strong className="font-medium text-foreground">Stub screen.</strong>{" "}
        The full §6.11 confirmation UI (ambiguity resolution, new-vs-update
        toggles, per-card commit) arrives in E3. This view confirms the
        extraction loop end-to-end.
      </div>

      <h1 className="text-2xl font-medium text-foreground">Review extraction</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Session {sessionId.slice(0, 8)}… · status{" "}
        <span className="font-mono">{session.status}</span> ·{" "}
        {extractions.length} entit{extractions.length === 1 ? "y" : "ies"} found
      </p>

      <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-[2fr_3fr]">
        {/* Source panel */}
        <section className="md:sticky md:top-6 md:self-start">
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Source
          </h2>
          {report?.content ? (
            <div className="rounded-lg border border-border bg-muted p-4 font-mono text-sm whitespace-pre-wrap text-foreground">
              {report.content}
            </div>
          ) : fileUrl && report?.sourceFileUrl ? (
            <FilePreview
              url={fileUrl}
              mimeType={mimeFromPath(report.sourceFileUrl)}
              filename={report.title}
            />
          ) : (
            <p className="text-sm text-muted-foreground">No source available.</p>
          )}
        </section>

        {/* Extractions */}
        <section className="flex flex-col gap-4">
          {isFailure ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <p className="font-medium text-foreground">
                I couldn&apos;t reliably read this
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                There wasn&apos;t enough here to extract. In E3 you&apos;ll be
                able to try a different file or enter it manually.
              </p>
            </div>
          ) : (
            extractions.map((e, i) => (
              <article
                key={i}
                className="rounded-lg border border-border bg-card p-4"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {e.target_entity_type}
                  </h3>
                  <span className="rounded-full bg-accent px-2 py-0.5 text-xs text-accent-foreground">
                    {e.intent === "uncertain" ? "needs your call" : e.intent}
                  </span>
                </div>

                {e.ambiguities.length > 0 ? (
                  <ul className="mt-3 flex flex-col gap-2">
                    {e.ambiguities.map((a, j) => (
                      <li
                        key={j}
                        className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground"
                      >
                        ⚠ {a.question}
                        <span className="ml-1 text-muted-foreground">
                          ({a.options.join(" · ")})
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}

                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
                  {Object.entries(e.extracted_data).map(([k, v]) => (
                    <div key={k} className="contents">
                      <dt className="text-muted-foreground">{k}</dt>
                      <dd className="text-foreground">
                        {typeof v === "object" ? JSON.stringify(v) : String(v)}
                      </dd>
                    </div>
                  ))}
                </dl>

                {e.matched_entity_id ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    matches existing entity{" "}
                    <span className="font-mono">
                      {e.matched_entity_id.slice(0, 8)}…
                    </span>
                  </p>
                ) : null}
              </article>
            ))
          )}

          <Link
            href={`/patient/${patientId}/chat`}
            className="text-sm text-link underline underline-offset-2"
          >
            ← Back to chat
          </Link>
        </section>
      </div>
    </main>
  );
}
