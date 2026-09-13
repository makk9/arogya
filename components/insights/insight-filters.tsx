"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import {
  CATEGORY_OPTIONS,
  STATUS_GROUPS,
} from "@/components/insights/insight-options";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { insightCategory, insightStatus } from "@/db/schema";

/*
 * The two filter pills per §6.8:1564 — `All statuses ▾` + `All categories ▾`,
 * each a **multi-select** menu (§6.8:1593 "multi-select within a pill"). The
 * insights feed is the one surface that warrants this: the user genuinely
 * combines selections (show NEW *and* SEEN, or risk *and* gap). Built on the
 * checkbox-menu primitive — Base UI's CheckboxItem keeps the menu open on
 * toggle (closeOnClick defaults false), so several boxes can be ticked in one
 * pass.
 *
 * Selection lives in the URL as a comma-list (`?status=new,seen`) — shareable,
 * refresh-stable; unknown values are dropped on parse, empty → param removed
 * (reads as "All"). `replace` keeps filter tweaks out of the back stack.
 */

const STATUS_ITEMS: ReadonlyArray<{ value: string; label: string }> =
  STATUS_GROUPS.map((g) => ({ value: g.value, label: g.label }));
const CATEGORY_ITEMS: ReadonlyArray<{ value: string; label: string }> =
  CATEGORY_OPTIONS.map((o) => ({ value: o.value, label: o.label }));

const VALID_STATUSES = new Set<string>(insightStatus.enumValues);
const VALID_CATEGORIES = new Set<string>(insightCategory.enumValues);

function parseList(raw: string | null, valid: Set<string>): string[] {
  if (!raw) return [];
  return raw.split(",").filter((v) => valid.has(v));
}

export function InsightFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const statuses = parseList(sp.get("status"), VALID_STATUSES);
  const categories = parseList(sp.get("category"), VALID_CATEGORIES);

  // The menu stays open across toggles, but `sp` only updates after the
  // replace's server round-trip — two quick ticks would each build from the
  // same stale params and the second would drop the first. Build from the last
  // query we wrote until the URL catches up to it.
  const spString = sp.toString();
  const pendingQs = useRef<string | null>(null);
  useEffect(() => {
    if (pendingQs.current === spString) pendingQs.current = null;
  }, [spString]);

  function toggle(key: string, value: string, checked: boolean) {
    const params = new URLSearchParams(pendingQs.current ?? spString);
    const valid = key === "status" ? VALID_STATUSES : VALID_CATEGORIES;
    const current = parseList(params.get(key), valid);
    const next = checked
      ? current.includes(value)
        ? current
        : [...current, value]
      : current.filter((v) => v !== value);
    if (next.length === 0) params.delete(key);
    else params.set(key, next.join(","));
    const qs = params.toString();
    pendingQs.current = qs;
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  return (
    <div className="flex gap-2">
      <FilterPill
        allLabel="All statuses"
        unit="status"
        items={STATUS_ITEMS}
        selected={statuses}
        onToggle={(value, checked) => toggle("status", value, checked)}
      />
      <FilterPill
        allLabel="All categories"
        unit="category"
        items={CATEGORY_ITEMS}
        selected={categories}
        onToggle={(value, checked) => toggle("category", value, checked)}
      />
    </div>
  );
}

function FilterPill({
  allLabel,
  unit,
  items,
  selected,
  onToggle,
}: {
  allLabel: string;
  /** Singular noun for the multi-selected count ("2 statuses"). */
  unit: "status" | "category";
  items: ReadonlyArray<{ value: string; label: string }>;
  selected: string[];
  onToggle: (value: string, checked: boolean) => void;
}) {
  const selectedSet = new Set(selected);
  const plural = unit === "status" ? "statuses" : "categories";
  const triggerLabel =
    selected.length === 0
      ? allLabel
      : selected.length === 1
        ? (items.find((i) => i.value === selected[0])?.label ?? allLabel)
        : `${selected.length} ${plural}`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs text-foreground transition-colors hover:bg-muted/60"
          >
            {triggerLabel}
            <span aria-hidden className="text-muted-foreground">
              ▾
            </span>
          </button>
        }
      />
      <DropdownMenuContent align="end">
        {items.map((item) => (
          <DropdownMenuCheckboxItem
            key={item.value}
            checked={selectedSet.has(item.value)}
            onCheckedChange={(checked) => onToggle(item.value, checked === true)}
          >
            {item.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
