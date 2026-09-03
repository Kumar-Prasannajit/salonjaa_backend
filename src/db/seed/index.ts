import "dotenv/config";
import { and, eq, isNull } from "drizzle-orm";
import { db, closeDatabaseConnection } from "@/config/database";
import { roles, serviceCategories } from "@/db/schema";
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

// service_categories has "platform category lifecycle" per TRD §4 and no documented CRUD
// endpoint in frontend_handover.md — same precedent as role seeding (see db:grant-role):
// this stays a local/dev seed list until an Admin category-management contract exists.
const STARTER_CATEGORIES = [
  { name: "Haircut & Styling", slug: "haircut-styling", icon: "scissors" },
  { name: "Hair Coloring", slug: "hair-coloring", icon: "palette" },
  { name: "Spa & Massage", slug: "spa-massage", icon: "spa" },
  { name: "Facial & Skincare", slug: "facial-skincare", icon: "sparkles" },
  { name: "Nail Care", slug: "nail-care", icon: "hand" },
  { name: "Threading & Waxing", slug: "threading-waxing", icon: "thread" },
  { name: "Bridal & Makeup", slug: "bridal-makeup", icon: "makeup" },
  { name: "Grooming (Men)", slug: "grooming-men", icon: "razor" },
];

async function seedServiceCategories(): Promise<void> {
  // `slug` is only uniquely-indexed among non-deleted rows (soft-delete allows slug reuse),
  // so a plain onConflictDoNothing target can't infer that partial index — check first instead.
  for (const category of STARTER_CATEGORIES) {
    const [existing] = await db
      .select({ id: serviceCategories.id })
      .from(serviceCategories)
      .where(and(eq(serviceCategories.slug, category.slug), isNull(serviceCategories.deletedAt)))
      .limit(1);
    if (!existing) {
      await db.insert(serviceCategories).values(category);
    }
  }
  logger.info(`Service categories seeded: ${STARTER_CATEGORIES.length}`);
}

async function run(): Promise<void> {
  await seedRoles();
  await seedServiceCategories();
  await closeDatabaseConnection();
}

run().catch((err) => {
  logger.error({ err }, "Seeding failed");
  process.exit(1);
});
