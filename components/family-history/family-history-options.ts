// Type-only import: the enum is used solely in `typeof X.enumValues` positions
// below, never at runtime — keeps @/db/schema out of the client bundle.
// Mirrors allergy-options.ts.
import type { familyHistoryRelation } from "@/db/schema";

type Relation = (typeof familyHistoryRelation.enumValues)[number];

// Shared label map for the relation enum. Consumed by the Add form, the
// list/detail surfaces, and the citation pill.
export const RELATION_OPTIONS: ReadonlyArray<{
  value: Relation;
  label: string;
}> = [
  { value: "parent", label: "Parent" },
  { value: "sibling", label: "Sibling" },
  { value: "child", label: "Child" },
  { value: "grandparent", label: "Grandparent" },
  { value: "aunt_uncle", label: "Aunt / uncle" },
  { value: "cousin", label: "Cousin" },
  { value: "other", label: "Other" },
];

export const RELATION_LABEL: Record<string, string> = Object.fromEntries(
  RELATION_OPTIONS.map((o) => [o.value, o.label]),
);

/*
 * §6.4:1336 list grouping: PARENTS + SIBLINGS expanded, GRANDPARENTS / OTHER
 * collapsed. The spec's example data has no `child` entries so the bucket
 * isn't mentioned — CHILDREN gets its own expanded group (first-degree
 * relatives are as clinically close as parents/siblings; folding children
 * under OTHER would bury them). aunt_uncle / cousin / other share the OTHER
 * bucket. Deviation noted in decisions.md 2026-06-10.
 */
export interface RelationGroup {
  slug: string;
  label: string;
  relations: ReadonlyArray<Relation>;
  defaultOpen: boolean;
}

export const RELATION_GROUPS: ReadonlyArray<RelationGroup> = [
  { slug: "parents", label: "Parents", relations: ["parent"], defaultOpen: true },
  {
    slug: "siblings",
    label: "Siblings",
    relations: ["sibling"],
    defaultOpen: true,
  },
  {
    slug: "children",
    label: "Children",
    relations: ["child"],
    defaultOpen: true,
  },
  {
    slug: "grandparents",
    label: "Grandparents",
    relations: ["grandparent"],
    defaultOpen: false,
  },
  {
    slug: "other",
    label: "Other",
    relations: ["aunt_uncle", "cousin", "other"],
    defaultOpen: false,
  },
];
