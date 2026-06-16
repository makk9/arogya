"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { displayDoctorName } from "@/lib/doctor-display";

const ALL = "all" as const;

/*
 * Filter pill for the Visits timeline — the single `All doctors ▾` dropdown
 * §6.6:1457 specifies. Options are the patient's doctors (passed from the
 * server page — free-set, unlike the enum filters on state lists). State in
 * URL search params (`?doctor=<uuid>`), `replace` keeps the back stack clean —
 * clones the state-list filter pattern (allergy-filters.tsx).
 */

interface VisitFiltersProps {
  doctors: ReadonlyArray<{ id: string; name: string }>;
}

export function VisitFilters({ doctors }: VisitFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const items = [
    { value: ALL, label: "All doctors" },
    ...doctors.map((d) => ({ value: d.id, label: displayDoctorName(d.name) })),
  ];

  const validIds = new Set(doctors.map((d) => d.id));
  const rawDoctor = sp.get("doctor");
  const doctor = rawDoctor && validIds.has(rawDoctor) ? rawDoctor : ALL;

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
      value={doctor}
      items={items}
      onValueChange={(value) =>
        navigate({ doctor: value === ALL ? null : value })
      }
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
