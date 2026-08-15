import "server-only";

import {
  Document,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { ReactElement } from "react";

import type { BriefBlock, BriefDoc } from "./brief-parse";

/**
 * Fixed doctor-brief PDF template (design.md 5.7 output-format details).
 *
 * One deterministic layout for every export — the whole point of the template
 * is that two briefs generated weeks apart look like documents from the same
 * system. Clean clinical styling per spec: black-on-white, tight line spacing,
 * no warm visual treatment, citations already stripped upstream. Colors are
 * intentionally literal here — this is a print artifact, not an app surface,
 * so the semantic-token rule for UI does not apply.
 */

export interface BriefPdfStats {
  /** Distinct vault entities cited by the brief (same derivation as the chat grounding strip). */
  dataPoints: number;
  /** e.g. "Apr 3 – Aug 14, 2026"; null when no cited entity carries a date. */
  rangeLabel: string | null;
}

const TITLE: Record<BriefDoc["mode"], string> = {
  delta: "Doctor visit brief",
  handoff: "Specialist handoff brief",
};

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    lineHeight: 1.35,
    color: "#000000",
    backgroundColor: "#ffffff",
    paddingTop: 56,
    paddingBottom: 64,
    paddingHorizontal: 56,
  },
  title: {
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
    marginBottom: 2,
  },
  titleRule: {
    borderBottomWidth: 1.5,
    borderBottomColor: "#000000",
    marginBottom: 10,
    paddingBottom: 6,
  },
  metaRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  metaLabel: {
    fontFamily: "Helvetica-Bold",
    width: 110,
  },
  metaValue: {
    flex: 1,
  },
  section: {
    marginTop: 14,
  },
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.8,
    borderBottomWidth: 0.5,
    borderBottomColor: "#000000",
    paddingBottom: 3,
    marginBottom: 6,
  },
  bulletRow: {
    flexDirection: "row",
    marginBottom: 3,
  },
  bulletGlyph: {
    width: 12,
  },
  bulletBody: {
    flex: 1,
  },
  paragraph: {
    marginBottom: 3,
  },
  bold: {
    fontFamily: "Helvetica-Bold",
  },
  // Footer pieces are individually `fixed` absolute Texts — the canonical
  // react-pdf footer shape (a fixed View wrapper renders inconsistently).
  footerRule: {
    position: "absolute",
    left: 56,
    right: 56,
    bottom: 44,
    borderTopWidth: 0.5,
    borderTopColor: "#000000",
  },
  footerNote: {
    position: "absolute",
    left: 56,
    right: 56,
    bottom: 32,
    fontSize: 7.5,
    color: "#444444",
  },
});

function runsOf(block: BriefBlock): ReactElement[] {
  return block.runs.map((run, i) => (
    <Text key={i} style={run.bold ? styles.bold : undefined}>
      {run.text}
    </Text>
  ));
}

function Block({ block }: { block: BriefBlock }): ReactElement {
  if (block.kind === "bullet") {
    // wrap={false}: a page break must move the whole bullet, never split the
    // glyph from its body (observed: lone "–" at a page bottom, body orphaned
    // on the next page).
    return (
      <View style={styles.bulletRow} wrap={false}>
        <Text style={styles.bulletGlyph}>–</Text>
        <Text style={styles.bulletBody}>{runsOf(block)}</Text>
      </View>
    );
  }
  return <Text style={styles.paragraph}>{runsOf(block)}</Text>;
}

function footerText(stats: BriefPdfStats): string {
  const points = `${stats.dataPoints} data point${stats.dataPoints === 1 ? "" : "s"}`;
  const range = stats.rangeLabel ? ` across ${stats.rangeLabel}` : "";
  return `Generated from ${points}${range}. Source detail available in the arogya app.`;
}

function BriefPdf({ doc, stats }: { doc: BriefDoc; stats: BriefPdfStats }): ReactElement {
  return (
    <Document title={TITLE[doc.mode]} producer="arogya" creator="arogya">
      <Page size="A4" style={styles.page}>
        <View style={styles.titleRule}>
          <Text style={styles.title}>{TITLE[doc.mode]}</Text>
        </View>

        {doc.meta.map((row, i) => (
          <View key={i} style={styles.metaRow}>
            <Text style={styles.metaLabel}>{row.label}</Text>
            <Text style={styles.metaValue}>{row.value}</Text>
          </View>
        ))}

        {doc.preamble.map((block, i) => (
          <Block key={i} block={block} />
        ))}

        {doc.sections.map((section, i) => (
          <View key={i} style={styles.section}>
            {/* Keep a heading with at least a bullet's worth of its body. */}
            <Text style={styles.sectionTitle} minPresenceAhead={48}>
              {section.title.toUpperCase()}
            </Text>
            {section.blocks.map((block, j) => (
              <Block key={j} block={block} />
            ))}
          </View>
        ))}

        <View style={styles.footerRule} fixed />
        <Text style={styles.footerNote} fixed>
          {footerText(stats)}
        </Text>
      </Page>
    </Document>
  );
}

export async function renderBriefPdf(
  doc: BriefDoc,
  stats: BriefPdfStats,
): Promise<Buffer> {
  return renderToBuffer(<BriefPdf doc={doc} stats={stats} />);
}
