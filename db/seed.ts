import { sql } from "drizzle-orm";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";

import { env } from "@/lib/env";
import { STUB_PATIENT_ID, STUB_USER_ID } from "@/lib/auth";
import { patients } from "@/db/schema";

async function main() {
  const client = postgres(env.DATABASE_URL, { prepare: false });
  const db = drizzle(client);

  await db
    .insert(patients)
    .values({
      id: STUB_PATIENT_ID,
      ownerUserId: STUB_USER_ID,
      name: "Ramesh Sharma",
      dateOfBirth: "1948-09-15",
      sex: "male",
      country: "India",
      city: "Pune",
      timezone: "Asia/Kolkata",
    })
    .onConflictDoNothing({ target: patients.id });

  const [row] = await db
    .select({ id: patients.id, name: patients.name })
    .from(patients)
    .where(sql`${patients.id} = ${STUB_PATIENT_ID}`);

  console.log(`seeded: ${row?.id} (${row?.name})`);

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});