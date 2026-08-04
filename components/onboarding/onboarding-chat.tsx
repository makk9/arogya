"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import { AiMessage } from "@/components/ai-message";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { OnboardingMessage, OnboardingPhase } from "@/db/schema";
import type { OnboardingWireEvent } from "@/lib/onboarding/stream";

/**
 * The interview conversation (§6.3 left side). Visuals match the locked chat
 * surface (§6.2): ✦ AI marker via AiMessage, periwinkle-tinted user bubbles,
 * `•••` thinking state — onboarding is a flavor of chat, not a different chat.
 * Streams over the E4 ndjson protocol (no useChat — the interview has no
 * router/quick-log plumbing).
 */

const PHASE_STEPS: Record<OnboardingPhase, { step: number; label: string }> = {
  patient: { step: 1, label: "THE PATIENT" },
  conditions: { step: 2, label: "CONDITIONS" },
  medications: { step: 3, label: "MEDICATIONS" },
  doctors: { step: 4, label: "CARE TEAM" },
  allergies: { step: 5, label: "ALLERGIES" },
  family_history: { step: 6, label: "FAMILY HISTORY" },
  lifestyle: { step: 7, label: "LIFESTYLE" },
  loose_ends: { step: 8, label: "LOOSE ENDS" },
  complete: { step: 8, label: "DONE" },
};

interface OnboardingChatProps {
  patientId: string;
  initialMessages: OnboardingMessage[];
  initialPhase: OnboardingPhase;
  completed: boolean;
  // Fired whenever an entity write lands, so the surface refetches the panel.
  // Carries the written entity's id when known — updates flash/scroll too, not
  // just brand-new cards.
  onEntity: (id?: string) => void;
}

export function OnboardingChat({
  patientId,
  initialMessages,
  initialPhase,
  completed,
  onEntity,
}: OnboardingChatProps) {
  const [messages, setMessages] = useState<OnboardingMessage[]>(initialMessages);
  const [streaming, setStreaming] = useState<string | null>(null);
  const [phase, setPhase] = useState<OnboardingPhase>(
    completed ? "complete" : initialPhase,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadNote, setUploadNote] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const openedRef = useRef(false);

  const isComplete = phase === "complete";
  const { step, label } = PHASE_STEPS[phase];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streaming, busy]);

  const send = useCallback(
    async (text: string | null) => {
      setBusy(true);
      setError(null);
      if (text) {
        setMessages((prev) => [...prev, { role: "user", content: text }]);
      }

      let assistantText = "";
      try {
        const res = await fetch("/api/onboarding", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(text ? { message: text } : {}),
        });
        if (!res.ok || !res.body) {
          setError("I couldn't reach the interview just now — try that again.");
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (line.trim().length === 0) continue;
            let event: OnboardingWireEvent;
            try {
              event = JSON.parse(line) as OnboardingWireEvent;
            } catch {
              continue;
            }
            switch (event.t) {
              case "text":
                assistantText += event.d;
                setStreaming(assistantText);
                break;
              case "entity":
                if (event.ok) onEntity(event.id);
                break;
              case "phase":
                setPhase(event.phase);
                break;
              case "error":
                setError(event.message);
                break;
              case "done":
                break;
            }
          }
        }
      } catch {
        setError("Something interrupted that reply. Send your message again.");
      } finally {
        const finalText = assistantText.trim();
        if (finalText.length > 0) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: finalText },
          ]);
        }
        setStreaming(null);
        setBusy(false);
      }
    },
    [onEntity],
  );

  // The agent opens the interview (§6.3:1250 — its first message asks for the
  // patient's identity). Fires once, only on a truly fresh interview.
  useEffect(() => {
    if (openedRef.current) return;
    openedRef.current = true;
    if (initialMessages.length === 0 && !completed) {
      // Deferred so the send's state updates happen outside the effect body.
      queueMicrotask(() => void send(null));
    }
  }, [initialMessages.length, completed, send]);

  const submit = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || busy) return;
      setInput("");
      void send(trimmed);
    },
    [busy, send],
  );

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    submit(input);
  }

  async function onFilePicked(file: File) {
    setUploadNote(null);
    try {
      const signRes = await fetch("/api/files/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        }),
      });
      if (!signRes.ok) throw new Error("sign");
      const { signedUrl, path } = (await signRes.json()) as {
        signedUrl: string;
        path: string;
      };
      const putRes = await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error("put");
      const processRes = await fetch("/api/files/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, mimeType: file.type }),
      });
      if (!processRes.ok) throw new Error("process");
      const { extractionSessionId } = (await processRes.json()) as {
        extractionSessionId: string;
      };
      window.open(
        `/patient/${patientId}/extract/${extractionSessionId}`,
        "_blank",
        "noopener",
      );
      setUploadNote(
        "I'm reading that file — review what I found in the tab that opened. Anything you confirm there shows up on the right, and we can keep going here.",
      );
    } catch {
      setUploadNote(
        "I couldn't take that file just now — we can keep going and try the upload again later.",
      );
    }
  }

  const chipsDisabled = busy || isComplete;

  return (
    <div className="flex h-full min-w-0 flex-col">
      <header className="flex items-center justify-between gap-4 border-b px-6 py-3">
        <div className="min-w-0">
          <p className="text-xs tracking-wide text-muted-foreground">
            arogya · STEP {step} OF 8 · {label}
          </p>
          <div className="mt-1.5 h-0.5 w-44 rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${(step / 8) * 100}%` }}
            />
          </div>
        </div>
        <Link
          href={`/patient/${patientId}/dashboard`}
          className="shrink-0 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          Skip to dashboard →
        </Link>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="flex flex-col gap-5">
          {messages.map((message, i) =>
            message.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl bg-accent px-4 py-2.5 text-accent-foreground ring-1 ring-accent-foreground/15">
                  {message.content}
                </div>
              </div>
            ) : (
              <div
                key={i}
                className="min-w-0 [&_li]:ml-4 [&_ol]:my-2 [&_ol]:ml-4 [&_ol]:list-decimal [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:my-2 [&_ul]:list-disc"
              >
                <AiMessage markdown={message.content} />
              </div>
            ),
          )}

          {streaming !== null && streaming.length > 0 ? (
            <div className="min-w-0 [&_p]:mb-3 [&_p:last-child]:mb-0">
              <AiMessage markdown={streaming} />
            </div>
          ) : null}

          {busy && (streaming === null || streaming.length === 0) ? (
            <div className="flex gap-3 text-muted-foreground" aria-live="polite">
              <span
                aria-hidden
                className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
              >
                ✦
              </span>
              <span className="pt-1">•••</span>
            </div>
          ) : null}

          {uploadNote ? (
            <div className="flex gap-3" aria-live="polite">
              <span
                aria-hidden
                className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
              >
                ✦
              </span>
              <p className="pt-0.5 text-sm text-muted-foreground">{uploadNote}</p>
            </div>
          ) : null}

          {error ? (
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {error}
            </p>
          ) : null}

          {isComplete ? (
            <div className="flex flex-wrap gap-2 pl-9">
              <Button
                nativeButton={false}
                render={
                  <Link href={`/patient/${patientId}/chat?run=scan`}>
                    Run the full health scan →
                  </Link>
                }
              />
              <Button
                nativeButton={false}
                variant="outline"
                render={
                  <Link href={`/patient/${patientId}/dashboard`}>
                    Go to dashboard →
                  </Link>
                }
              />
            </div>
          ) : null}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Escape chips (§6.3:1236) — persistent, above the input. */}
      {!isComplete ? (
        <div className="border-t px-6 pt-3">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={chipsDisabled}
              onClick={() => void send("I don't know")}
              className="rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              I don&apos;t know
            </button>
            <button
              type="button"
              disabled={chipsDisabled}
              onClick={() => fileRef.current?.click()}
              className="rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              Upload instead
            </button>
            <button
              type="button"
              disabled={chipsDisabled}
              onClick={() => void send("Skip for now")}
              className="rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50"
            >
              Skip for now
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void onFilePicked(file);
            }}
          />
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="px-6 pb-4 pt-3">
        <div className="flex items-end gap-3">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(input);
              }
            }}
            placeholder={
              isComplete
                ? "Anything else to add or correct?"
                : "Tell me in your own words…"
            }
            rows={1}
            className="max-h-40 min-h-[2.75rem] flex-1 resize-none"
          />
          <Button type="submit" disabled={busy || input.trim().length === 0}>
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}
