"use client";

import ReactMarkdown from "react-markdown";

import { VisitInlineField } from "@/components/visits/visit-inline-field";
import { useMaybeVisitEdit } from "@/components/visits/visit-edit-context";
import type { Visit } from "@/db/schema";

/*
 * The §6.7 body section, per-entity header name: NOTES FROM VISIT. Composes
 * the four narrative columns — chief complaint, summary, diagnosis, next
 * steps — as labeled sub-blocks. `summary` and `next_steps` are markdown
 * columns (Phase 4), rendered through react-markdown so the §6.7 "bolded key
 * data within prose" pattern (`**152/95**`) actually bolds; chief complaint
 * and diagnosis are short plain-text lines.
 *
 * Sub-blocks are omitted when empty in read mode (§6.5:1386 omission
 * rationale, carried over); a fully empty body renders a quiet invitation
 * instead of nothing — the body is the page's main content, and its absence
 * should read as "not captured yet", not a layout bug. Edit mode always shows
 * every field.
 */

interface Props {
  visit: Visit;
}

const SUB_LABEL_CLASS =
  "mb-1 font-mono text-[0.65rem] uppercase tracking-wide text-muted-foreground";

// Constrained markdown typography for narrative bodies — sized to match the
// plain-text sections elsewhere on the page.
const MARKDOWN_CLASS =
  "text-sm leading-relaxed [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-0.5";

export function VisitBodySection({ visit }: Props) {
  const editCtx = useMaybeVisitEdit();
  const editing = editCtx?.editing ?? false;

  const chiefComplaint = visit.chiefComplaint?.trim() ?? "";
  const summary = visit.summary?.trim() ?? "";
  const diagnosisText = visit.diagnosisText?.trim() ?? "";
  const nextSteps = visit.nextSteps?.trim() ?? "";

  const isEmpty = !chiefComplaint && !summary && !diagnosisText && !nextSteps;

  return (
    <section className="mb-8">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
        Notes from visit
      </h2>

      {isEmpty && !editing ? (
        <p className="text-sm text-muted-foreground">
          Nothing captured from this visit yet — Edit to add what happened.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {chiefComplaint || editing ? (
            <div>
              <h3 className={SUB_LABEL_CLASS}>Chief complaint</h3>
              {editing ? (
                <VisitInlineField
                  fieldKey="chiefComplaint"
                  value={visit.chiefComplaint}
                  variant="text"
                  required={false}
                  clearable
                  ariaLabel="Chief complaint"
                  placeholder="Why the visit happened…"
                  displayValue={null}
                />
              ) : (
                <p className="text-sm leading-relaxed">{chiefComplaint}</p>
              )}
            </div>
          ) : null}

          {summary || editing ? (
            <div>
              <h3 className={SUB_LABEL_CLASS}>Summary</h3>
              {editing ? (
                <VisitInlineField
                  fieldKey="summary"
                  value={visit.summary}
                  variant="textarea"
                  rows={6}
                  required={false}
                  clearable
                  ariaLabel="Summary"
                  placeholder="What happened — observations, discussion, readings."
                  displayValue={null}
                />
              ) : (
                <div className={MARKDOWN_CLASS}>
                  <ReactMarkdown>{summary}</ReactMarkdown>
                </div>
              )}
            </div>
          ) : null}

          {diagnosisText || editing ? (
            <div>
              <h3 className={SUB_LABEL_CLASS}>Diagnosis</h3>
              {editing ? (
                <VisitInlineField
                  fieldKey="diagnosisText"
                  value={visit.diagnosisText}
                  variant="text"
                  required={false}
                  clearable
                  ariaLabel="Diagnosis"
                  placeholder="As the doctor stated it…"
                  displayValue={null}
                />
              ) : (
                <p className="text-sm leading-relaxed">{diagnosisText}</p>
              )}
            </div>
          ) : null}

          {nextSteps || editing ? (
            <div>
              <h3 className={SUB_LABEL_CLASS}>Next steps</h3>
              {editing ? (
                <VisitInlineField
                  fieldKey="nextSteps"
                  value={visit.nextSteps}
                  variant="textarea"
                  rows={3}
                  required={false}
                  clearable
                  ariaLabel="Next steps"
                  placeholder="Recheck in 8 weeks, schedule lipid panel…"
                  displayValue={null}
                />
              ) : (
                <div className={MARKDOWN_CLASS}>
                  <ReactMarkdown>{nextSteps}</ReactMarkdown>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
