import { bloodType, sex } from "@/db/schema";

/*
 * Select option-sets for the patient profile's inline editors. Labels derive
 * from the pgEnum value-sets (single source of truth, same convention as
 * medication-options.ts) so a new enum value flows through without drift.
 */

const SEX_LABELS: Record<(typeof sex.enumValues)[number], string> = {
  male: "Male",
  female: "Female",
  intersex: "Intersex",
  unspecified: "Unspecified",
};

export const SEX_OPTIONS = sex.enumValues.map((value) => ({
  value,
  label: SEX_LABELS[value],
}));

// Blood-type values are already display-ready ("A+", "O-", …).
export const BLOOD_TYPE_OPTIONS = bloodType.enumValues.map((value) => ({
  value,
  label: value,
}));
