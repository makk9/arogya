"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { CATEGORY_OPTIONS } from "@/components/conditions/condition-options";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { conditionCategory } from "@/db/schema";

const ALL = "all" as const;

// Prepend the "all" option to the shared category list. Passed to <Select> as
// `items` so Base UI's <SelectValue> renders the label ("All categories") rather
// than the raw value — see condition-form.tsx for the same fix.
const FILTER_ITEMS: ReadonlyArray<{ value: string; label: string }> = [
  { value: ALL, label: "All categories" },
  ...CATEGORY_OPTIONS,
];

const VALID_CATEGORIES = new Set<string>(conditionCategory.enumValues);

/*
 * Filter pill per design.md 6.4:1341 — Conditions get a single `All categories ▾`
 * dropdown (no "Active only" toggle; that's Medication-specific). Clones
 * medication-filters.tsx minus the toggle. Filter state lives in the URL search
 * params (shareable, refresh-stable); unknown values are tolerated and fall back
 * to "all". Uses `replace` so filter tweaks don't pollute the back stack.
 */
export function ConditionFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const rawCategory = sp.get("category");
  const category =
    rawCategory && VALID_CATEGORIES.has(rawCategory) ? rawCategory : ALL;

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
      value={category}
      items={FILTER_ITEMS}
      onValueChange={(value) =>
        navigate({ category: value === ALL ? null : value })
      }
    >
      <SelectTrigger className="h-7 w-44 text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {FILTER_ITEMS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
