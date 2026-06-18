"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { REPORT_TYPE_OPTIONS } from "@/components/reports/report-options";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "all" as const;

/*
 * Filter pill for the Reports timeline — the single `All types ▾` dropdown
 * §6.6:1450 specifies. Options are the §4:486 report-type enum (a fixed set,
 * unlike the Visits timeline's free-set doctor list). State in URL search params
 * (`?type=<enum>`), `replace` keeps the back stack clean — clones the
 * state-list filter pattern (visit-filters.tsx).
 */

const VALID_TYPES = new Set<string>(REPORT_TYPE_OPTIONS.map((o) => o.value));

export function ReportFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const items = [
    { value: ALL, label: "All types" },
    ...REPORT_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
  ];

  const rawType = sp.get("type");
  const type = rawType && VALID_TYPES.has(rawType) ? rawType : ALL;

  function navigate(updates: Record<string, string | null>) {
    const params = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null) params.delete(k);
      else params.set(k, v);
    }
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  return (
    <Select
      value={type}
      items={items}
      onValueChange={(value) => navigate({ type: value === ALL ? null : value })}
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
