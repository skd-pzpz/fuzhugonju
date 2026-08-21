import postgres from "postgres";
import { config } from "dotenv";
config({ path: ".env" });

const connectionString = process.env.DATABASE_URL;
const sql = postgres(connectionString, { max: 1 });

try {
  // List all schemas
  const schemas = await sql`
    SELECT schema_name FROM information_schema.schemata
    WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
    ORDER BY schema_name
  `;
  console.log("=== All schemas ===");
  for (const s of schemas) {
    console.log(`  ${s.schema_name}`);
  }

  // List all tables across all schemas
  const tables = await sql`
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
    ORDER BY schemaname, tablename
  `;
  console.log("\n=== All tables ===");
  for (const t of tables) {
    console.log(`  ${t.schemaname}.${t.tablename}`);
  }

  // For each table in novelcraft schema, show columns
  const novelcraftTables = tables.filter(t => t.schemaname === "novelcraft");
  for (const t of novelcraftTables) {
    const cols = await sql`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = ${t.schemaname} AND table_name = ${t.tablename}
      ORDER BY ordinal_position
    `;
    console.log(`\n=== ${t.schemaname}.${t.tablename} (${cols.length} cols) ===`);
    for (const c of cols) {
      const nullable = c.is_nullable === "YES" ? "NULL" : "NOT NULL";
      console.log(`  ${c.column_name} (${c.data_type}, ${nullable})`);
    }
  }

  // Check drizzle migrations table
  const migrations = await sql`
    SELECT id, hash, created_at
    FROM drizzle.__drizzle_migrations
    ORDER BY created_at
  `;
  console.log("\n=== Drizzle migrations ===");
  for (const m of migrations) {
    console.log(`  #${m.id} ${m.hash} (${m.created_at})`);
  }
} catch (e) {
  console.error("Error:", e.message);
} finally {
  await sql.end();
}
