import "dotenv/config";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, closeDatabaseConnection } from "@/config/database";
import { logger } from "@/shared/logger";

async function run(): Promise<void> {
  logger.info("Running database migrations...");
  await migrate(db, { migrationsFolder: "./src/db/migrations" });
  logger.info("Migrations complete");
  await closeDatabaseConnection();
}

run().catch((err) => {
  logger.error({ err }, "Migration failed");
  process.exit(1);
});
