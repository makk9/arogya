import type { ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";

import { CitationPill } from "@/components/citation-pill";
import { remarkCitations } from "@/lib/citations/remark-plugin";

/**
 * Renders an insight's markdown body with inline `§` citation pills resolved to
 * live popovers (§6.9:1626 "same visual treatment as chat"). Reuses the chat
 * stack — `remarkCitations` + `CitationPill` — but drops AiMessage's sparkle
 * envelope: the insight detail is a document, not a chat turn. Bolded numbers /
 * key terms (`**152/95**`) render via standard markdown, matching the
 * event-detail body pattern (§6.9:1626).
 *
 * Server-Component-safe: react-markdown + unist-util-visit use no client APIs;
 * the CitationPill leaves it a client island only where a pill actually mounts.
 */

// react-markdown's Components type only allows known intrinsic element keys;
// "citation-pill" isn't one — the documented unknown-cast pattern (see
// ai-message.tsx) wires the custom hast tag to the pill renderer.
const markdownComponents = {
  "citation-pill": CitationPill,
} as unknown as Components;

const MARKDOWN_CLASS =
  "text-[0.95rem] leading-relaxed [&_p]:mb-3 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1";

export function InsightBody({ markdown }: { markdown: string }): ReactNode {
  return (
    <div className={MARKDOWN_CLASS}>
      <ReactMarkdown
        remarkPlugins={[remarkCitations]}
        components={markdownComponents}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
