interface Props {
  notes: string;
}

/*
 * Notes per design.md 6.5. Page guards omission when notes is null/empty
 * (locked refinement: matches Linked Context's omit-when-empty pattern,
 * keeping detail pages quiet when there's nothing to say). §6.5 doesn't yet
 * carve out Notes — pending doc-fix to align the spec with this behavior.
 */
export function MedicationNotesSection({ notes }: Props) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 font-mono text-xs uppercase tracking-wide text-muted-foreground">
        Notes
      </h2>
      <p className="whitespace-pre-wrap text-sm leading-relaxed">{notes}</p>
    </section>
  );
}
