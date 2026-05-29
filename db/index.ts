import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/lib/env";

import * as schema from "./schema";

// max: 3 fits Supabase's session-pooler (port 5432, 15-client cap) with
// headroom for Next.js Turbopack's multi-worker model + smoke scripts. The
// default (10) exhausts the cap once two workers are alive. Transaction
// pooler (port 6543) would lift the ceiling; keep this until we move there.
const client = postgres(env.DATABASE_URL, { prepare: false, max: 3 });

export const db = drizzle(client, { schema });
