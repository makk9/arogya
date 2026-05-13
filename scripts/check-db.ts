import { env } from "../lib/env";
import postgres from "postgres";

async function main() {
  const sql = postgres(env.DATABASE_URL, { max: 1 });
  try {
    const [row] = await sql<[{ ok: number; v: string }]>`select 1 as ok, version() as v`;
    console.log("db connection ok");
    console.log("postgres:", row.v.split(" ").slice(0, 2).join(" "));
  } catch (err) {
    console.error("db connection failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await sql.end();
  }
}

main();
