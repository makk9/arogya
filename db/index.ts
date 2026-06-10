import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/lib/env";

import * as schema from "./schema";

// max: 3 fits Supabase's session-pooler (port 5432, 15-client cap) with
// headroom for Next.js Turbopack's multi-worker model + smoke scripts. The
// default (10) exhausts the cap once two workers are alive. Transaction
// pooler (port 6543) would lift the ceiling; keep this until we move there.
//
// Two leak guards (added after the pooler hit EMAXCONNSESSION mid-dev,
// 2026-06-09): the client is cached on globalThis so Turbopack HMR re-runs of
// this module reuse it instead of abandoning live connections, and
// idle_timeout closes sockets a worker stops using. Without these, a dev
// session that touches many routes accumulates orphaned connections until the
// 15-client cap blocks everything (including drizzle-kit and smoke scripts).
const globalForDb = globalThis as { __arogyaDbClient?: ReturnType<typeof postgres> };

const client =
  globalForDb.__arogyaDbClient ??
  postgres(env.DATABASE_URL, { prepare: false, max: 3, idle_timeout: 20 });
globalForDb.__arogyaDbClient = client;

export const db = drizzle(client, { schema });
