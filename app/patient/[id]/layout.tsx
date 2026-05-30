import { type ReactNode } from "react";

import { ChatDrawerProvider } from "@/components/chat/chat-drawer-provider";

/**
 * Patient-level layout. Hosts the chat drawer so a single conversation persists
 * across navigation between entity pages (App Router keeps a layout mounted
 * while its child routes change). This is also where the wiki rail will live in
 * Phase D.
 */
export default function PatientLayout({ children }: { children: ReactNode }) {
  return <ChatDrawerProvider>{children}</ChatDrawerProvider>;
}
