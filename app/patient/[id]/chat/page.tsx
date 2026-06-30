import { notFound } from "next/navigation";

import { FullScreenChat } from "@/components/chat/full-screen-chat";
import { chatQueries } from "@/db/queries/chat";
import { getCurrentPatient } from "@/lib/auth";

/*
 * Full-screen chat — new-conversation route (design.md 6.2). Reached from the
 * rail's "Chat" item or "+ new conversation" in the CHATS list. No session is
 * created until the first message is sent (lazy creation in the conversation
 * pane), so merely opening this route never leaves an empty session behind.
 */
export default async function ChatNewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const current = await getCurrentPatient();
  if (id !== current.patientId) notFound();

  const sessions = await chatQueries.listSessions(current.patientId);
  const firstName =
    current.name.trim().split(/\s+/)[0] || "your family member";

  return (
    <FullScreenChat
      key="new"
      patientId={current.patientId}
      patientFirstName={firstName}
      initialSessions={sessions.map((s) => ({ id: s.id, title: s.title }))}
      activeSessionId={null}
      initialMessages={[]}
      initialTitle={null}
    />
  );
}
