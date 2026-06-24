"use client";

import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/*
 * `…` menu per design.md 6.10:1664 — Export patient record + Archive patient.
 * Both behaviors are post-launch (PDF export and archive flows aren't in the
 * patient-profile vertical), so the items render disabled with the sub-text
 * the sketch specifies (1697) — present-but-disabled keeps the designed
 * surface and signals "coming" without dead clicks. Delete is post-launch and
 * absent entirely (1664).
 */

function MenuItemBody({ title, sub }: { title: string; sub: string }) {
  return (
    <span className="flex flex-col">
      <span>{title}</span>
      <span className="text-xs text-muted-foreground">{sub}</span>
    </span>
  );
}

export function PatientActionsMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Patient actions"
          >
            <MoreHorizontal />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem disabled>
          <MenuItemBody
            title="Export patient record"
            sub="full archival PDF · coming soon"
          />
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          <MenuItemBody
            title="Archive patient"
            sub="destructive · confirms first · coming soon"
          />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
