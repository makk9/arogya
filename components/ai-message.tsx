/**
 * AI message envelope. Renders one synthesis-agent message: sparkle marker (`✦`
 * per 7.2:2149) on the left, markdown body with inline citation pills.
 *
 * Server-Component-safe: `react-markdown` 10.x and `unist-util-visit` 5.x use no
 * hooks or client APIs, so this file does not require "use client". Phase C
 * consumers can compose it inside client components (e.g. a `useChat`-driven
 * chat pane) without re-marking this one client.
 *
 * Phase B scope: markdown + pills only. The "grounded in →" footer (6.2:1207),
 * shadcn Popover entity preview (6.2:1206), conversation header, and chat-pane
 * layout all live in the Phase C item 7 chat surface — this component is the
 * inner content, not the chat shell. Markdown typography (Tailwind `prose`
 * plugin) is also a Phase C item 7 concern: the chat surface owns the
 * typography stack so all message types render consistently.
 */

import type { ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";

import { CitationPill, type CitationPillProps } from "./citation-pill";
import { stripBriefMarkerForDisplay } from "@/lib/chat/brief";
import { remarkCitations } from "@/lib/citations/remark-plugin";

interface AiMessageProps {
  markdown: string;
}

// react-markdown's `Components` type only allows known JSX.IntrinsicElements
// keys; "citation-pill" isn't one. Augmenting JSX globally for one component is
// over-engineering — the unknown-cast through Components is the documented
// react-markdown community pattern for custom hast tag renderers.
const markdownComponents = {
  "citation-pill": CitationPill,
} as unknown as Components;

export function AiMessage({ markdown }: AiMessageProps): ReactNode {
  return (
    <div className="flex gap-3">
      <span
        aria-hidden
        className="mt-1 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-600"
      >
        ✦
      </span>
      <div className="min-w-0 flex-1">
        <ReactMarkdown
          remarkPlugins={[remarkCitations]}
          components={markdownComponents}
        >
          {/* Doctor-brief marker (E7) is transport metadata, not content —
              react-markdown would render the comment literally. */}
          {stripBriefMarkerForDisplay(markdown)}
        </ReactMarkdown>
      </div>
    </div>
  );
}

// Re-export so consumers (Phase C item 7) only need to import from this surface.
export { CitationPill, type CitationPillProps };
