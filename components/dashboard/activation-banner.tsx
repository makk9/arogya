import Link from "next/link";

/**
 * Activation banner (§6.1 empty pattern / §6.3:1249) — the ONLY launcher for
 * the onboarding interview. Phase E ships the shell; the `setup · N of 4`
 * counter and adaptive empty-state logic are Phase F. Shown while the
 * interview hasn't completed; "Walk me through it →" signals guided
 * onboarding, not a generic chat (§6.3:1249 label nudge).
 */

export function ActivationBanner() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-accent px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium text-accent-foreground">
          Quickest way to fill this in
        </p>
        <p className="mt-0.5 text-sm text-accent-foreground/80">
          Tell me about your family member in a short conversation — I&apos;ll
          build the record as you talk.
        </p>
      </div>
      <Link
        href="/onboarding"
        className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/80"
      >
        Walk me through it →
      </Link>
    </div>
  );
}
