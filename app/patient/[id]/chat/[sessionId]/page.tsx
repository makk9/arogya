import { notFound } from "next/navigation";

import { FullScreenChat } from "@/components/chat/full-screen-chat";
import { chatQueries } from "@/db/queries/chat";
import { getCurrentPatient } from "@/lib/auth";

// Matches the uuid form chat session ids take, so a malformed path param is a
// clean 404 rather than a pg "invalid input syntax for type uuid" 500.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/*
 * Full-screen chat — a specific persisted conversation (design.md 6.2). Loads
 * the session (patient-scoped) and its transcript, seeding the conversation
 * pane. notFound on a foreign/stale id so one record's chats can't be reached
 * from another's.
 */
export default async function ChatSessionPage({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>;
}) {
  const { id, sessionId } = await params;
  const current = await getCurrentPatient();
  if (id !== current.patientId || !UUID_RE.test(sessionId)) notFound();

  const session = await chatQueries.getSession(current.patientId, sessionId);
  if (!session) notFound();

  const [sessions, messages] = await Promise.all([
    chatQueries.listSessions(current.patientId),
    chatQueries.getMessages(current.patientId, session.id),
  ]);
  const firstName =
    current.name.trim().split(/\s+/)[0] || "your family member";

  return (
    <FullScreenChat
      key={session.id}
      patientId={current.patientId}
      patientFirstName={firstName}
      initialSessions={sessions.map((s) => ({ id: s.id, title: s.title }))}
      activeSessionId={session.id}
      initialMessages={messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
      }))}
      initialTitle={session.title}
    />
  );
}
