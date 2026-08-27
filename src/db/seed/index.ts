import "dotenv/config";
import { db, closeDatabaseConnection } from "@/config/database";
import { roles } from "@/db/schema";
import { ROLE_NAMES } from "@/shared/constants";
import { logger } from "@/shared/logger";

async function seedRoles(): Promise<void> {
  for (const name of Object.values(ROLE_NAMES)) {
    await db
      .insert(roles)
      .values({ name: name as never })
      .onConflictDoNothing({ target: roles.name });
  }
  logger.info("Roles seeded: CUSTOMER, SALON_OWNER, ADMIN");
}

async function run(): Promise<void> {
  await seedRoles();
  await closeDatabaseConnection();
}

run().catch((err) => {
  logger.error({ err }, "Seeding failed");
  process.exit(1);
});
