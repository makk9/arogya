import { Camera } from "lucide-react";

import { cn } from "@/lib/utils";

/*
 * Patient avatar with initials fallback (design.md 6.10:1663, 1670). The
 * dashed ring + camera badge is the photo-upload affordance pattern from the
 * 6.10 sketch (1693) — rendered but inert for the patient-profile vertical:
 * Supabase Storage upload wiring is deferred (see decisions.md). The badge is
 * shown only in edit mode and carries aria-disabled so it reads as
 * "coming, not broken".
 *
 * Initials: up to two leading letters of the name. No color is hardcoded —
 * the badge and ring use semantic tokens so the deferred brand accent stays a
 * one-place swap (§7.2).
 */

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (
    parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)
  ).toUpperCase();
}

interface Props {
  name: string;
  photoUrl: string | null;
  editing: boolean;
  className?: string;
}

export function PatientAvatar({ name, photoUrl, editing, className }: Props) {
  return (
    <div className={cn("relative inline-block", className)}>
      <div
        className={cn(
          "flex size-16 items-center justify-center overflow-hidden rounded-full bg-muted font-heading text-xl font-semibold text-muted-foreground",
          editing && "outline-2 outline-offset-2 outline-dashed outline-border",
        )}
      >
        {photoUrl ? (
          // Storage-hosted patient photo; next/image remote-loader config is
          // deferred with the upload wiring (the affordance is inert for now).
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt={name} className="size-full object-cover" />
        ) : (
          <span aria-hidden>{initialsFromName(name)}</span>
        )}
      </div>
      {editing ? (
        <span
          aria-disabled
          title="Photo upload coming soon"
          className="absolute -bottom-1 -right-1 flex size-6 cursor-not-allowed items-center justify-center rounded-full border border-border bg-card text-muted-foreground opacity-70"
        >
          <Camera className="size-3.5" />
        </span>
      ) : null}
    </div>
  );
}
