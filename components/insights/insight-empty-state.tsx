/*
 * Insights feed empty state per §6.8:1577 — honest about the timeline (insights
 * need weeks of data; empty is the right output most of the time, §5.6). No
 * primary action: insights are AI-generated, not user-created (§6.8:1565). Copy
 * is verbatim from the wireframe. Voice per 7.1 — plain, no throat-clearing.
 */
export function InsightEmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-border px-6 py-10 text-center">
      <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
        Insights start appearing once arogya has a couple weeks of readings,
        visits, or lab reports. Patterns will surface here automatically — empty
        is the right output most of the time.
      </p>
    </div>
  );
}
