import { type ReactNode } from "react";

import { ChatDrawerProvider } from "@/components/chat/chat-drawer-provider";
import { WikiRail } from "@/components/patient/wiki-rail";
import { wikiCounts } from "@/db/queries/wiki-counts";
import { getCurrentPatient } from "@/lib/auth";

/**
 * Patient-level layout. Hosts the chat drawer so a single conversation persists
 * across navigation between entity pages (App Router keeps a layout mounted
 * while its child routes change), and the Health Wiki rail (§3 + §6.1:1146) —
 * the persistent left nav across every wiki surface.
 *
 * Counts are fetched here (server) and passed to the rail so it stays a thin
 * client island. App Router preserves a shared layout across soft navigation,
 * so these counts refresh on initial load and after any mutation's
 * `router.refresh()` (every create/delete island calls it) — not on a plain
 * <Link> nav between sibling routes, which reuses the cached layout.
 */
export default async function PatientLayout({
  children,
}: {
  children: ReactNode;
}) {
  const patient = await getCurrentPatient();
  const counts = await wikiCounts(patient.patientId);

  return (
    <ChatDrawerProvider>
      <div className="flex min-h-screen">
        <WikiRail
          patientId={patient.patientId}
          patientName={patient.name}
          relationship={patient.relationship}
          counts={counts}
        />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </ChatDrawerProvider>
  );
}
