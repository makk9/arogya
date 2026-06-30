/**
 * Smoke test for the chat-session persistence layer (E0b). Exercises the full
 * query surface against arogya-dev with the stub patient, then cleans up.
 * Run: npx tsx --conditions react-server --env-file=.env.local scripts/check-chat-queries.ts
 */
import { chatQueries } from "@/db/queries/chat";
import { STUB_PATIENT_ID } from "@/lib/auth";

async function main() {
  const fail = (msg: string): never => {
    throw new Error(`FAIL: ${msg}`);
  };

  // create
  const session = await chatQueries.createSession(STUB_PATIENT_ID);
  if (!session.id || session.title !== null) fail("createSession shape");
  console.log("✓ createSession", session.id);

  // scoped get + foreign-patient isolation
  const got = await chatQueries.getSession(STUB_PATIENT_ID, session.id);
  if (!got) fail("getSession in-scope");
  const foreign = await chatQueries.getSession(
    "00000000-0000-0000-0000-000000000000",
    session.id,
  );
  if (foreign !== null) fail("getSession should be patient-scoped");
  console.log("✓ getSession patient-scoped");

  // add messages (+ session touch)
  await chatQueries.addMessage(session.id, "user", "Why is creatinine at 1.4?");
  await chatQueries.addMessage(
    session.id,
    "assistant",
    "Looking at § lab-report:2026-04-12 …",
  );
  const messages = await chatQueries.getMessages(STUB_PATIENT_ID, session.id);
  if (messages.length !== 2 || messages[0].role !== "user")
    fail("getMessages order/shape");
  // Foreign patient sees nothing — getMessages self-scopes via the session join.
  const foreignMsgs = await chatQueries.getMessages(
    "00000000-0000-0000-0000-000000000000",
    session.id,
  );
  if (foreignMsgs.length !== 0) fail("getMessages should be patient-scoped");
  console.log("✓ addMessage + getMessages ordered + patient-scoped");

  // setTitleIfNull sets once, then no-ops
  const setFirst = await chatQueries.setTitleIfNull(session.id, "Creatinine 1.4");
  const setAgain = await chatQueries.setTitleIfNull(session.id, "clobbered?");
  if (!setFirst || setAgain) fail("setTitleIfNull guard");
  const afterTitle = await chatQueries.getSession(STUB_PATIENT_ID, session.id);
  if (afterTitle?.title !== "Creatinine 1.4") fail("title not the first value");
  console.log("✓ setTitleIfNull sets once, never clobbers");

  // rename
  const renamed = await chatQueries.renameSession(
    STUB_PATIENT_ID,
    session.id,
    "Renamed",
  );
  if (renamed?.title !== "Renamed") fail("renameSession");
  console.log("✓ renameSession");

  // list includes it
  const list = await chatQueries.listSessions(STUB_PATIENT_ID);
  if (!list.some((s) => s.id === session.id)) fail("listSessions");
  console.log("✓ listSessions includes it");

  // delete cascades messages
  const deleted = await chatQueries.deleteSession(STUB_PATIENT_ID, session.id);
  if (!deleted) fail("deleteSession");
  const gone = await chatQueries.getMessages(STUB_PATIENT_ID, session.id);
  if (gone.length !== 0) fail("messages should cascade on session delete");
  console.log("✓ deleteSession cascades messages");

  console.log("\nALL CHAT QUERY CHECKS PASSED");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
