import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";

/**
 * Runs once before the whole vitest run, in its own short-lived process — does not share
 * process.env with the actual test-worker processes (those get DATABASE_URL etc. from
 * vitest.config.ts's `test.env` instead). Just makes sure the test database's schema is
 * current before any test file imports the app.
 */
export default async function globalSetup(): Promise<void> {
  const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? "postgres://postgres:adi131003@localhost:5432/salonjaa_test";
  const pool = new Pool({ connectionString: testDatabaseUrl });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: "./src/db/migrations" });

  // Reference/lookup data every test needs (see tests/helpers/db.ts's resetDb, which
  // deliberately never truncates `roles`) — same 3 roles npm run db:seed creates.
  for (const name of ["CUSTOMER", "SALON_OWNER", "ADMIN"]) {
    await db.execute(sql`insert into roles (name) values (${name}) on conflict (name) do nothing`);
  }

  await pool.end();
}
