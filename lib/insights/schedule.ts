import "server-only";

import { after } from "next/server";

import type { InsightEntityRef } from "@/db/schema";
import { maybeRunInsightGeneration } from "@/lib/insights/generate";
import { errorCode, logger } from "@/lib/logger";

/**
 * Fire-and-forget insight generation (§9.3): runs after the response is sent,
 * never blocks or fails the calling route. One-liner for entity-creation
 * routes and the extraction-commit finalize — the `after()` precedent is the
 * chat route's auto-titling. Kept separate from lib/insights/generate.ts so
 * non-route callers (smoke scripts) avoid the `next/server` import.
 */
export function scheduleInsightGeneration(
  patientId: string,
  trigger: InsightEntityRef,
): void {
  after(async () => {
    try {
      await maybeRunInsightGeneration({ patientId, trigger });
    } catch (err) {
      // maybeRunInsightGeneration doesn't throw by contract; this catches the
      // truly unexpected (e.g. a DB outage before the run row exists).
      logger.error({
        op: "insights.generate.schedule",
        code: errorCode(err),
        ids: { patientId },
      });
    }
  });
}
