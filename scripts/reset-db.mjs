import postgres from "postgres";
import { config } from "dotenv";
config({ path: ".env" });

const connectionString = process.env.DATABASE_URL;
const sql = postgres(connectionString, { max: 1 });

try {
  // 1. Drop all tables in novelcraft schema (cascade for foreign keys)
  await sql`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN
        SELECT tablename FROM pg_tables
        WHERE schemaname = 'novelcraft'
      LOOP
        EXECUTE 'DROP TABLE IF EXISTS novelcraft.' || quote_ident(r.tablename) || ' CASCADE';
        RAISE NOTICE 'Dropped novelcraft.%', r.tablename;
      END LOOP;
    END $$;
  `;
  console.log("Dropped all tables in novelcraft schema");

  // 2. Drop the schema itself
  await sql`DROP SCHEMA IF EXISTS novelcraft CASCADE`;
  console.log("Dropped novelcraft schema");

  // 3. Recreate the schema
  await sql`CREATE SCHEMA novelcraft`;
  console.log("Created novelcraft schema");

  console.log("\nDatabase is clean. Run 'npx drizzle-kit push' to create tables.");
} catch (e) {
  console.error("Error:", e.message);
} finally {
  await sql.end();
}
