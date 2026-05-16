/**
 * remark plugin: walks the mdast tree, finds `§` / `↗` citation patterns inside
 * `text` nodes, and replaces them with custom `citation-pill` inline nodes that
 * react-markdown's `components` map renders as <CitationPill /> elements.
 *
 * Pure mdast transform — no React, no rendering. The actual pattern matching is
 * delegated to `tokenizeCitations()` in lib/citations/parse.ts so the regex
 * stays unit-testable in isolation.
 */

import type { Properties } from "hast";
import type { Parent, Root, Text } from "mdast";
import { visit, SKIP } from "unist-util-visit";

import { tokenizeCitations, type CitationSegment } from "./parse";

// The custom node we inject into the mdast. react-markdown's mdast→hast bridge
// uses `data.hName` to pick the HTML tag name (here "citation-pill") and
// `data.hProperties` to set its props. The `components` map in <ReactMarkdown />
// then routes "citation-pill" to our React component.
//
// `hProperties` is typed as hast's `Properties` (an index-signature shape); we
// intersect with our narrow attr unions so the keys are still type-checked at
// the construction site below.
export interface CitationPillNode {
  type: "citation-pill";
  data: {
    hName: "citation-pill";
    hProperties: Properties & (VaultPillAttrs | ExternalPillAttrs);
  };
  children: [Text];
}

interface VaultPillAttrs {
  variant: "vault";
  entityType: string;
  slug: string;
}

interface ExternalPillAttrs {
  variant: "external";
  sourceName: string;
}

type InlineNode = Text | CitationPillNode;

// Register our custom node in mdast's RootContentMap so `parent.children` (typed
// as `RootContent[]`) accepts it without a cast at every splice site. This is
// the canonical TypeScript pattern for extending unist tree types.
//
// GLOBAL TYPE EXTENSION: this `declare module` widens mdast's RootContent union
// for every file in the project. Today only this file uses mdast types, so the
// blast radius is contained, but any future code that does exhaustive switching
// on `node.type` will need to handle "citation-pill" or explicitly opt out.
declare module "mdast" {
  interface RootContentMap {
    "citation-pill": CitationPillNode;
  }
}

export function remarkCitations() {
  return (tree: Root): void => {
    visit(tree, "text", (node: Text, index, parent: Parent | undefined) => {
      if (parent === undefined || index === undefined) return;
      // Skip text inside code blocks / inline code — synthesis prompt at
      // 10.3:3078 puts pills in prose, not code, and rendering them inside
      // ```fences would be surprising.
      if (parent.type === "code" || parent.type === "inlineCode") return;

      if (!hasCitation(node.value)) return;

      const segments = tokenizeCitations(node.value);
      const replacement = segments.map(segmentToNode);
      parent.children.splice(index, 1, ...replacement);
      // Re-visit at the same index would walk into our inserted nodes and try
      // to re-tokenize the verbatim text inside each pill — skip.
      return [SKIP, index + replacement.length];
    });
  };
}

function hasCitation(text: string): boolean {
  return text.includes("§") || text.includes("↗");
}

function segmentToNode(segment: CitationSegment): InlineNode {
  if (segment.kind === "text") {
    return { type: "text", value: segment.text };
  }
  if (segment.kind === "vault") {
    return {
      type: "citation-pill",
      data: {
        hName: "citation-pill",
        hProperties: {
          variant: "vault",
          entityType: segment.entityType,
          slug: segment.slug ?? "",
        },
      },
      children: [{ type: "text", value: segment.raw }],
    };
  }
  return {
    type: "citation-pill",
    data: {
      hName: "citation-pill",
      hProperties: {
        variant: "external",
        sourceName: segment.sourceName,
      },
    },
    children: [{ type: "text", value: segment.raw }],
  };
}
