"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";

/*
 * Shared commit engine for the patient profile's inline editors
 * (PatientInlineField + PatientMeasurementField). Owns the network edge: the
 * PATCH, the success router.refresh(), pending state, and the teaching-surface
 * error extraction (per-field guidance keyed by field name, falling back to
 * the top-level message). Callers own their own draft/seed/validation and call
 * commit() with the already-derived wire value.
 *
 * Both editors hit the same singleton endpoint (/api/patient, auth-derived),
 * so the endpoint is fixed per hook instance.
 */

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: {
      fieldErrors?: Record<string, string[]>;
      formErrors?: string[];
    };
  };
}

export function useInlineCommit(endpoint: string) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const commit = useCallback(
    async (fieldKey: string, wireValue: string | null): Promise<boolean> => {
      setError(null);
      setPending(true);
      try {
        const res = await fetch(endpoint, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [fieldKey]: wireValue }),
        });
        if (res.ok) {
          router.refresh();
          return true;
        }
        const parsed = (await res.json().catch(() => ({}))) as ApiErrorBody;
        const fieldMsg = parsed.error?.details?.fieldErrors?.[fieldKey]?.[0];
        setError(fieldMsg ?? parsed.error?.message ?? "Couldn't save.");
        return false;
      } catch {
        setError("Couldn't reach the server.");
        return false;
      } finally {
        setPending(false);
      }
    },
    [endpoint, router],
  );

  return { pending, error, setError, commit };
}
