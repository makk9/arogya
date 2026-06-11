"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { medicationCategory } from "@/db/schema";
import { cn } from "@/lib/utils";

const ALL = "all" as const;

const CATEGORY_OPTIONS: ReadonlyArray<{
  value: (typeof medicationCategory.enumValues)[number] | typeof ALL;
  label: string;
}> = [
  { value: ALL, label: "All categories" },
  { value: "allopathic", label: "Allopathic" },
  { value: "ayurvedic", label: "Ayurvedic" },
  { value: "homeopathic", label: "Homeopathic" },
  { value: "supplement", label: "Supplement" },
  { value: "OTC", label: "OTC" },
  { value: "other", label: "Other" },
];

const VALID_CATEGORIES = new Set<string>(medicationCategory.enumValues);

/*
 * Filter pills per design.md 6.4. Two controls:
 *  - `Active only` toggle → ?status=active (or absent)
 *  - `All categories ▾` dropdown → ?category=allopathic etc. (or absent)
 *
 * Filter state lives in URL search params (shareable, refresh-stable) per
 * the plan's hybrid model. Unknown values in the URL are tolerated by the
 * page and ignored here — the UI falls back to defaults. Uses `replace` so
 * filter tweaks don't pollute the back stack.
 */
export function MedicationFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const activeOnly = sp.get("status") === "active";
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
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-pressed={activeOnly}
        onClick={() =>
          navigate({ status: activeOnly ? null : "active" })
        }
        className={cn(
          "rounded-full border px-3 py-1 text-xs transition-colors",
          activeOnly
            ? "border-foreground bg-foreground text-background"
            : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
        )}
      >
        Active only
      </button>

      <Select
        value={category}
        items={CATEGORY_OPTIONS}
        onValueChange={(value) =>
          navigate({ category: value === ALL ? null : value })
        }
      >
        <SelectTrigger className="h-7 w-44 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CATEGORY_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
