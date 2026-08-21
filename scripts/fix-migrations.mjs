import postgres from "postgres";
import { config } from "dotenv";
config({ path: ".env" });

const connectionString = process.env.DATABASE_URL;
const sql = postgres(connectionString, { max: 1 });

try {
  // Clear all migration history, keep only the latest (init)
  await sql`DELETE FROM drizzle.__drizzle_migrations WHERE id < 8`;
  
  const remaining = await sql`SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id`;
  console.log("=== Remaining migrations ===");
  for (const m of remaining) {
    console.log(`  #${m.id} ${m.hash}`);
  }
  console.log(`\nKept ${remaining.length} migration(s)`);
} catch (e) {
  console.error("Error:", e.message);
} finally {
  await sql.end();
}
