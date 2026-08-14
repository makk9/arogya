"use client";

import ReactMarkdown from "react-markdown";

import { CLICK_TARGET_MARKDOWN_COMPONENTS } from "@/components/log-change-affordance";

import { ReportInlineField } from "@/components/reports/report-inline-field";
import type { Report } from "@/db/schema";

/*
 * The §6.7 body section, per-entity header name: REPORT CONTENT. Renders the
 * document's text (`content`, a markdown column, §4:489) through react-markdown
 * so the §6.7 "bolded key data within prose" pattern works.
 *
 * §6.7:1534 also lists "PDF preview" as the alternative body — that rides the
 * source file, deferred to Phase E with the upload pipeline. v1 Phase D is
 * text-only. An empty body renders a quiet invitation rather than nothing — the
 * body is the page's main content, so its absence should read as "not captured
 * yet", not a layout bug. The field self-manages display vs editor (click the
 * content — or the invitation — or global Edit).
 */

interface Props {
  report: Report;
}

const MARKDOWN_CLASS =
  "text-sm leading-relaxed [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-0.5";

export function ReportBodySection({ report }: Props) {
  const content = report.content?.trim() ?? "";

  return (
    <section className="mb-8">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
        Report content
      </h2>

      {/* ReportInlineField self-manages display vs editor (click-to-edit,
          decisions.md 2026-08-13) — no editing branch needed here. */}
      <ReportInlineField
        fieldKey="content"
        value={report.content}
        variant="textarea"
        rows={12}
        required={false}
        clearable
        ariaLabel="Report content"
        placeholder="Paste or transcribe what the document says."
        displayValue={
          content ? (
            <div className={MARKDOWN_CLASS}>
              <ReactMarkdown components={CLICK_TARGET_MARKDOWN_COMPONENTS}>{content}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No content captured yet — Edit to add the document text, or upload
              the file in chat.
            </p>
          )
        }
      />
    </section>
  );
}
