import { cn } from "@/lib/utils";

/*
 * Placeholder for the global floating Ask AI button (design.md 6.4 + 6.5 +
 * the wiki-surface global pattern). Full chat wiring is Phase C item 6.
 *
 * `aria-disabled` + visual demotion signal the placeholder state without
 * "coming soon" copy (which 7.1 prohibits). aria-disabled is machine-
 * readable state, not user-facing copy — keyboard and screen-reader users
 * get accurate feedback that the affordance is inert; sighted users see a
 * muted treatment instead of a fully active-looking button.
 */
export function AskAiButton({ className }: { className?: string }) {
  return (
    <button
      type="button"
      aria-disabled
      className={cn(
        "fixed bottom-6 right-6 z-40 inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground shadow-lg transition-colors opacity-60 cursor-default focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
        className,
      )}
    >
      <span aria-hidden>✦</span>
      Ask AI
    </button>
  );
}
