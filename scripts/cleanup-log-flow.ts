/**
 * Removes the placeholder Report + extraction session + chat session created by
 * the log-flow smoke (verify-log-flow.mjs). Deleting the report cascades its
 * extraction_session; deleting the chat session cascades its messages. Pass the
 * CLEANUP_IDS blob as argv[2]. Nothing was committed to the vault (Discard all).
 */
import { eq } from "drizzle-orm";

import { db } from "../db";
import { chatSessions, extractionSessions, reports } from "../db/schema";

async function main(): Promise<void> {
  const ids = JSON.parse(process.argv[2] ?? "{}") as {
    extractSessionId?: string;
    chatSessionId?: string;
  };

  if (ids.extractSessionId) {
    const [sess] = await db
      .select({ reportId: extractionSessions.reportId })
      .from(extractionSessions)
      .where(eq(extractionSessions.id, ids.extractSessionId));
    if (sess?.reportId) {
      await db.delete(reports).where(eq(reports.id, sess.reportId)); // cascades extraction_session
    }
  }
  if (ids.chatSessionId) {
    await db.delete(chatSessions).where(eq(chatSessions.id, ids.chatSessionId)); // cascades messages
  }
  console.log("log-flow cleanup done");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
