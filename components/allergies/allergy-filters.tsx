"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { CATEGORY_OPTIONS } from "@/components/allergies/allergy-options";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { allergyCategory } from "@/db/schema";

const ALL = "all" as const;

const FILTER_ITEMS: ReadonlyArray<{ value: string; label: string }> = [
  { value: ALL, label: "All categories" },
  ...CATEGORY_OPTIONS,
];

const VALID_CATEGORIES = new Set<string>(allergyCategory.enumValues);

/*
 * Filter pill for the Allergies list — a single `All categories ▾` dropdown
 * (drug / food / environmental / other), mirroring the Conditions filter
 * (§6.4:1341 defines no Allergy filter; category is the natural axis since
 * grouping handles status). Clones condition-filters.tsx: state in URL search
 * params, unknown values fall back to "all", `replace` keeps the back stack
 * clean.
 */
export function AllergyFilters() {
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
