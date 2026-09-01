import "dotenv/config";
import { eq, and } from "drizzle-orm";
import { db, closeDatabaseConnection } from "@/config/database";
import { users, roles, userRoles } from "@/db/schema";
import { logger } from "@/shared/logger";

/**
 * Usage: npx tsx src/db/seed/grant-role.ts <email> <ROLE_NAME>
 * Dev/local utility only — no such endpoint exists in the API spec. Use this to promote
 * a test account to SALON_OWNER or ADMIN while building/testing those modules locally.
 */
async function run(): Promise<void> {
  const [email, roleName] = process.argv.slice(2);
  if (!email || !roleName) {
    logger.error("Usage: npx tsx src/db/seed/grant-role.ts <email> <ROLE_NAME>");
    process.exit(1);
  }

  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  if (!user) {
    logger.error({ email }, "No user found with that email. Log in via /auth first to create the account.");
    process.exit(1);
  }

  const [role] = await db
    .select()
    .from(roles)
    .where(eq(roles.name, roleName as never))
    .limit(1);
  if (!role) {
    logger.error({ roleName }, "Role not seeded. Run `npm run db:seed` first.");
    process.exit(1);
  }

  const [existing] = await db
    .select()
    .from(userRoles)
    .where(and(eq(userRoles.userId, user.id), eq(userRoles.roleId, role.id)))
    .limit(1);

  if (existing) {
    logger.info({ email, roleName }, "User already has this role.");
  } else {
    await db.insert(userRoles).values({ userId: user.id, roleId: role.id });
    logger.info(
      { email, roleName },
      "Role granted. Call POST /auth/refresh-token with your existing refreshToken to get a new accessToken with the updated role — no need to log out."
    );
  }

  await closeDatabaseConnection();
}

run().catch((err) => {
  logger.error({ err }, "grant-role failed");
  process.exit(1);
});
