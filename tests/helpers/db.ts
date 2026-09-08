import { sql } from "drizzle-orm";
import { db } from "@/config/database";

/**
 * Truncates every table in the test database (drizzle's own migrations bookkeeping tables
 * excluded) and resets identity sequences, cascading through FKs. Called between tests that
 * need a clean slate rather than tracking every row a test creates — this is the test DB
 * only (vitest.config.ts's `test.env.DATABASE_URL`), never the dev DB.
 */
export async function resetDb(): Promise<void> {
  // `roles` is excluded — it's reference/lookup data seeded once in tests/global-setup.ts
  // (CUSTOMER/SALON_OWNER/ADMIN), not per-test data; truncating it would need every test to
  // re-seed it before creating any user_roles row.
  const { rows } = await db.execute<{ tablename: string }>(
    sql`select tablename from pg_tables where schemaname = 'public' and tablename not like 'drizzle%' and tablename != 'roles'`
  );
  if (rows.length === 0) return;
  const tables = rows.map((r) => `"${r.tablename}"`).join(", ");
  await db.execute(sql.raw(`truncate table ${tables} restart identity cascade`));
}
