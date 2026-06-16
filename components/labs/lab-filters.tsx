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

/*
 * Filter pill for the Labs timeline — the single `All report types ▾` dropdown
 * §6.6:1450 specifies. Options are the patient's distinct report types (free
 * text, passed from the server page). State in URL search params (`?type=…`);
 * `replace` keeps the back stack clean — clones visit-filters.tsx.
 */

interface LabFiltersProps {
  reportTypes: ReadonlyArray<string>;
}

export function LabFilters({ reportTypes }: LabFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const items = [
    { value: ALL, label: "All report types" },
    ...reportTypes.map((t) => ({ value: t, label: t })),
  ];

  const validTypes = new Set(reportTypes);
  const rawType = sp.get("type");
  const type = rawType && validTypes.has(rawType) ? rawType : ALL;

  function navigate(value: string | null) {
    const params = new URLSearchParams(sp.toString());
    if (!value || value === ALL) params.delete("type");
    else params.set("type", value);
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  return (
    <Select value={type} items={items} onValueChange={navigate}>
      <SelectTrigger className="h-7 w-48 text-xs">
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
