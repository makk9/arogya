"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "all" as const;

interface DoctorFiltersProps {
  /**
   * Distinct specialties present in this patient's record, display casing,
   * alphabetical. Server-derived: specialty is free text (no enum to import),
   * so the option set is the data itself.
   */
  specialties: ReadonlyArray<string>;
}

/*
 * Filter pill per design.md 6.4:1342 — Doctors get a single `All specialties ▾`
 * dropdown (also reflected in the grouping). Clones condition-filters.tsx.
 * Filter state lives in the URL (?specialty=, lowercased); values not in the
 * option set fall back to "all". `replace` keeps the back stack clean.
 */
export function DoctorFilters({ specialties }: DoctorFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const items = [
    { value: ALL, label: "All specialties" },
    ...specialties.map((s) => ({ value: s.toLowerCase(), label: s })),
  ];

  const valid = new Set(items.map((i) => i.value));
  const rawSpecialty = sp.get("specialty");
  const specialty =
    rawSpecialty && valid.has(rawSpecialty.toLowerCase())
      ? rawSpecialty.toLowerCase()
      : ALL;

  function navigate(value: string | null) {
    const params = new URLSearchParams(sp.toString());
    if (value === null) params.delete("specialty");
    else params.set("specialty", value);
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  return (
    <Select
      value={specialty}
      items={items}
      onValueChange={(value) => navigate(value === ALL ? null : value)}
    >
      <SelectTrigger className="h-7 w-44 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
