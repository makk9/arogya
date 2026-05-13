import postgres from "postgres";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  const sql = postgres(url, { prepare: false });

  const tables = await sql<{ table_name: string }[]>`
    select table_name
    from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name
  `;

  const enums = await sql<{ typname: string }[]>`
    select t.typname
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typtype = 'e' and n.nspname = 'public'
    order by t.typname
  `;

  const indexes = await sql<{ indexname: string }[]>`
    select indexname
    from pg_indexes
    where schemaname = 'public'
    order by indexname
  `;

  const fks = await sql<{ count: string }[]>`
    select count(*)::text
    from information_schema.table_constraints
    where constraint_type = 'FOREIGN KEY' and table_schema = 'public'
  `;

  console.log(`tables (${tables.length}):`);
  tables.forEach((t) => console.log("  " + t.table_name));
  console.log(`\nenums (${enums.length}):`);
  enums.forEach((e) => console.log("  " + e.typname));
  console.log(`\nindexes (${indexes.length}):`);
  indexes.forEach((i) => console.log("  " + i.indexname));
  console.log(`\nforeign keys: ${fks[0].count}`);

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
