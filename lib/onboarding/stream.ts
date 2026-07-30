import type { OnboardingPhase } from "@/db/schema";

/**
 * Incremental fence parser for the onboarding agent's dual-output stream (E4).
 *
 * The agent streams conversational prose interleaved with fenced JSON blocks:
 *
 *   ```entity
 *   { "type": "medication", ... }
 *   ```
 *
 * (and ```phase blocks). This parser consumes arbitrary chunk boundaries and
 * yields `text` tokens (prose, safe to forward to the client immediately) and
 * `fence` tokens (complete blocks, for the server to validate + act on). Fence
 * content is NEVER emitted as text — a malformed or unterminated block is
 * dropped by the caller, not shown to the user.
 */

export type OnboardingStreamToken =
  | { kind: "text"; text: string }
  | { kind: "fence"; tag: "entity" | "phase"; body: string };

const OPEN_MARKERS = ["```entity\n", "```phase\n"] as const;
const CLOSE_MARKER = "\n```";

// Longest suffix of `buffer` that is a strict prefix of an open marker — held
// back so a marker split across chunks isn't flushed as prose.
function heldSuffixLength(buffer: string): number {
  const max = Math.min(buffer.length, OPEN_MARKERS[0].length - 1);
  for (let len = max; len > 0; len--) {
    const suffix = buffer.slice(buffer.length - len);
    if (OPEN_MARKERS.some((m) => m.startsWith(suffix))) return len;
  }
  return 0;
}

export class FenceParser {
  private buffer = "";
  private fenceTag: "entity" | "phase" | null = null;

  push(chunk: string): OnboardingStreamToken[] {
    this.buffer += chunk;
    const tokens: OnboardingStreamToken[] = [];

    for (;;) {
      if (this.fenceTag) {
        const closeAt = this.buffer.indexOf(CLOSE_MARKER);
        if (closeAt === -1) return tokens; // wait for the close
        const body = this.buffer.slice(0, closeAt);
        let rest = this.buffer.slice(closeAt + CLOSE_MARKER.length);
        // Swallow the newline right after the closing fence (block formatting,
        // not prose) when it has already arrived.
        if (rest.startsWith("\n")) rest = rest.slice(1);
        tokens.push({ kind: "fence", tag: this.fenceTag, body });
        this.fenceTag = null;
        this.buffer = rest;
        continue;
      }

      const tickAt = this.buffer.indexOf("```");
      if (tickAt === -1) {
        const hold = heldSuffixLength(this.buffer);
        const flushable = this.buffer.slice(0, this.buffer.length - hold);
        if (flushable.length > 0) tokens.push({ kind: "text", text: flushable });
        this.buffer = this.buffer.slice(this.buffer.length - hold);
        return tokens;
      }

      if (tickAt > 0) {
        tokens.push({ kind: "text", text: this.buffer.slice(0, tickAt) });
        this.buffer = this.buffer.slice(tickAt);
      }

      const marker = OPEN_MARKERS.find((m) => this.buffer.startsWith(m));
      if (marker) {
        this.fenceTag = marker.includes("entity") ? "entity" : "phase";
        this.buffer = this.buffer.slice(marker.length);
        continue;
      }

      // Not (yet) one of ours: either we need more input to decide, or it's a
      // stray code fence — re-emit the backticks as prose and move past them.
      if (OPEN_MARKERS.some((m) => m.startsWith(this.buffer))) return tokens;
      tokens.push({ kind: "text", text: "```" });
      this.buffer = this.buffer.slice(3);
    }
  }

  // End of stream. Remaining prose flushes; an unterminated fence is dropped
  // (returned separately so the caller can log it — never shown as text).
  flush(): { tokens: OnboardingStreamToken[]; droppedFence: boolean } {
    const droppedFence = this.fenceTag !== null;
    const tokens: OnboardingStreamToken[] =
      !droppedFence && this.buffer.length > 0
        ? [{ kind: "text", text: this.buffer }]
        : [];
    this.buffer = "";
    this.fenceTag = null;
    return { tokens, droppedFence };
  }
}

// ---- ndjson wire events (server → onboarding client) ------------------------
// The single wire contract: the route encodes these, the onboarding chat
// imports this type (type-only — this module is pure) so the two ends can't
// drift.

export type OnboardingWireEvent =
  | { t: "text"; d: string }
  | {
      t: "entity";
      ok: boolean;
      type: string;
      id?: string;
      label?: string;
    }
  | { t: "phase"; phase: OnboardingPhase; step: number }
  | { t: "done" }
  | { t: "error"; message: string };

export function encodeWireEvent(event: OnboardingWireEvent): string {
  return `${JSON.stringify(event)}\n`;
}
