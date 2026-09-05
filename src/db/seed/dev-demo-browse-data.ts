import "dotenv/config";
import { and, eq, isNull, inArray } from "drizzle-orm";
import { db, closeDatabaseConnection } from "@/config/database";
import {
  users,
  roles,
  userRoles,
  salonOwnerProfiles,
  salons,
  branches,
  staff,
  staffServices,
  serviceCategories,
  branchServices,
  bookings,
  bookingServices,
  reviews,
} from "@/db/schema";
import { logger } from "@/shared/logger";

/**
 * DEV-ONLY, temporary — populates realistic-looking salons/branches/staff/services/
 * reviews so the frontend's new Public Browse screens (Home/Explore/Salon
 * Details/Select Services) have something real to render in a browser, since
 * there's still no salon-owner-driven onboarding flow exercised in this dev DB.
 * Bypasses the API entirely (direct inserts via this repo's own Drizzle schema)
 * — this is not a substitute for the real salon registration -> admin
 * verification flow, just a shortcut to get VERIFIED+ACTIVE rows for the
 * public browse endpoints to return. Idempotent by replacement: re-running
 * deletes and recreates any blueprint salon that already exists (by name),
 * so editing a blueprint and re-running always reflects the latest data —
 * this is disposable demo data, never treat it as real. Safe to delete once
 * real onboarding data exists.
 *
 * Usage: npx tsx src/db/seed/dev-demo-browse-data.ts
 */

const DEMO_OWNER_EMAIL = "demo.salon.owner@salonjaa.dev";
const DEMO_CUSTOMER_EMAIL = "demo.customer@salonjaa.dev";

// Names/areas match docs/designs/04-nearby-salons-based-on-service.jpeg in the
// frontend repo so a manual visual check lines up with what the mockups show.
// Coordinates are approximate real Hyderabad neighborhood centers (public
// geography, not fabricated business data) — close enough for distance-sort
// testing.
const SALON_BLUEPRINTS = [
  {
    salonName: "The Luxe Salon",
    branchName: "The Luxe Salon",
    area: "Banjara Hills",
    lat: 17.4156,
    lng: 78.4347,
    description: "Experience luxury & perfection with our expert stylists and premium services.",
    targetAverage: 4.8,
    reviewCount: 12,
  },
  {
    salonName: "Looks Studio",
    branchName: "Looks Studio",
    area: "Jubilee Hills",
    lat: 17.431,
    lng: 78.4073,
    description: "A modern studio for hair, skin, and grooming — Jubilee Hills' go-to for a quick refresh.",
    targetAverage: 4.6,
    reviewCount: 10,
  },
  {
    salonName: "Headquarters",
    branchName: "Headquarters",
    area: "Ameerpet",
    lat: 17.4374,
    lng: 78.4482,
    description: "Unisex salon known for precision cuts and a relaxed, no-rush atmosphere.",
    targetAverage: 4.5,
    reviewCount: 8,
  },
  {
    salonName: "Style Hub",
    branchName: "Style Hub",
    area: "Madhapur",
    lat: 17.4483,
    lng: 78.3915,
    description: "Style Hub brings salon-grade color and styling to Madhapur's tech crowd.",
    targetAverage: 4.4,
    reviewCount: 6,
  },
  {
    salonName: "Cut & Style",
    branchName: "Cut & Style",
    area: "Kukatpally",
    lat: 17.4849,
    lng: 78.4138,
    description: "Neighborhood favorite for haircuts, beard styling, and quick spa treatments.",
    targetAverage: 4.3,
    reviewCount: 5,
  },
];

// One representative service per starter category (see seed/index.ts's
// STARTER_CATEGORIES) — matches the service names shown in
// docs/designs/03-salon-details.jpeg / 05-select-service.jpeg.
const SERVICE_BLUEPRINTS = [
  { categorySlug: "haircut-styling", name: "Haircut (Unisex)", durationMinutes: 45, basePrice: 499 },
  { categorySlug: "spa-massage", name: "Hair Spa", durationMinutes: 60, basePrice: 699 },
  { categorySlug: "hair-coloring", name: "Hair Color", durationMinutes: 90, basePrice: 1499 },
  { categorySlug: "grooming-men", name: "Beard Styling", durationMinutes: 30, basePrice: 299 },
  { categorySlug: "spa-massage", name: "Smoothening", durationMinutes: 120, basePrice: 2499 },
];

const STAFF_NAMES = [
  { fullName: "Ananya Reddy", staffType: "STAR" as const },
  { fullName: "Rahul Verma", staffType: "NORMAL" as const },
];

const REVIEW_TEXTS = [
  "Great experience, will come back again!",
  "Loved the service, staff was very professional.",
  "Good ambience and skilled stylists.",
  "Quick and neat haircut, happy with the result.",
  "Friendly staff, clean salon.",
  "Value for money, recommended.",
  "Really enjoyed the hair spa session.",
  "Booked online, no wait time — smooth experience.",
];

function ratingsAveragingTo(target: number, count: number): number[] {
  // Blend of floor(target) and ceil(target) star ratings, weighted so the
  // mean lands on (or within a rounding hair of) `target` — e.g. target 4.6
  // over 10 reviews is 6 fives + 4 fours (avg exactly 4.6), not a uniform
  // "everyone gave 5 stars" spread.
  const lo = Math.floor(target);
  const hi = Math.ceil(target);
  if (lo === hi) return Array(count).fill(lo);
  const hiCount = Math.round((target - lo) * count);
  return Array.from({ length: count }, (_, i) => (i < hiCount ? hi : lo));
}

// Deletes a previously-seeded demo salon and every row that hangs off it, in
// FK-safe order (children before parents — several of these are `restrict`,
// not `cascade`). Only ever targets a salon whose name matches one of
// SALON_BLUEPRINTS, so this can't reach real onboarding data.
async function deleteSalonIfExists(salonName: string): Promise<void> {
  const [existing] = await db.select({ id: salons.id }).from(salons).where(eq(salons.name, salonName)).limit(1);
  if (!existing) return;

  const branchRows = await db.select({ id: branches.id }).from(branches).where(eq(branches.salonId, existing.id));
  const branchIds = branchRows.map((b) => b.id);
  if (branchIds.length > 0) {
    const bookingRows = await db.select({ id: bookings.id }).from(bookings).where(inArray(bookings.branchId, branchIds));
    const bookingIds = bookingRows.map((b) => b.id);
    if (bookingIds.length > 0) {
      await db.delete(reviews).where(inArray(reviews.bookingId, bookingIds));
      await db.delete(bookingServices).where(inArray(bookingServices.bookingId, bookingIds));
      await db.delete(bookings).where(inArray(bookings.id, bookingIds));
    }
    await db.delete(branchServices).where(inArray(branchServices.branchId, branchIds));
    await db.delete(staff).where(inArray(staff.branchId, branchIds));
    await db.delete(branches).where(inArray(branches.id, branchIds));
  }
  await db.delete(salons).where(eq(salons.id, existing.id));
}

async function upsertDemoUser(email: string, fullName: string) {
  const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(users).values({ email, fullName, emailVerified: true }).returning();
  return created;
}

async function run(): Promise<void> {
  const [ownerRole] = await db.select().from(roles).where(eq(roles.name, "SALON_OWNER")).limit(1);
  if (!ownerRole) {
    logger.error("SALON_OWNER role not seeded — run `npm run db:seed` first.");
    process.exit(1);
  }

  const owner = await upsertDemoUser(DEMO_OWNER_EMAIL, "Demo Salon Owner");
  const customer = await upsertDemoUser(DEMO_CUSTOMER_EMAIL, "Demo Customer");

  const [existingUserRole] = await db
    .select()
    .from(userRoles)
    .where(and(eq(userRoles.userId, owner.id), eq(userRoles.roleId, ownerRole.id)))
    .limit(1);
  if (!existingUserRole) await db.insert(userRoles).values({ userId: owner.id, roleId: ownerRole.id });

  let [ownerProfile] = await db.select().from(salonOwnerProfiles).where(eq(salonOwnerProfiles.userId, owner.id)).limit(1);
  if (!ownerProfile) {
    [ownerProfile] = await db
      .insert(salonOwnerProfiles)
      .values({ userId: owner.id, businessName: "Demo Salons Pvt Ltd", kycStatus: "APPROVED" })
      .returning();
  }

  const categories = await db.select().from(serviceCategories).where(isNull(serviceCategories.deletedAt));
  const categoryBySlug = new Map(categories.map((c) => [c.slug, c]));
  const missingSlugs = SERVICE_BLUEPRINTS.map((s) => s.categorySlug).filter((slug) => !categoryBySlug.has(slug));
  if (missingSlugs.length > 0) {
    logger.error({ missingSlugs }, "Missing service categories — run `npm run db:seed` first.");
    process.exit(1);
  }

  let created = 0;

  for (const blueprint of SALON_BLUEPRINTS) {
    await deleteSalonIfExists(blueprint.salonName);

    const [salon] = await db
      .insert(salons)
      .values({
        ownerProfileId: ownerProfile.id,
        name: blueprint.salonName,
        description: blueprint.description,
        status: "ACTIVE",
        verificationStatus: "VERIFIED",
      })
      .returning();

    const [branch] = await db
      .insert(branches)
      .values({
        salonId: salon.id,
        name: blueprint.branchName,
        phone: "9800000000",
        email: `contact@${blueprint.salonName.toLowerCase().replace(/[^a-z0-9]+/g, "")}.dev`,
        addressLine1: `${blueprint.area} Main Road`,
        city: "Hyderabad",
        state: "Telangana",
        postalCode: "500034",
        latitude: blueprint.lat,
        longitude: blueprint.lng,
        totalChairs: 5,
        openingTime: "09:00",
        closingTime: "21:00",
        status: "ACTIVE",
      })
      .returning();

    const staffRows = await db
      .insert(staff)
      .values(STAFF_NAMES.map((s) => ({ branchId: branch.id, fullName: s.fullName, staffType: s.staffType, experienceYears: 3 })))
      .returning();

    const serviceRows = await db
      .insert(branchServices)
      .values(
        SERVICE_BLUEPRINTS.map((s) => ({
          branchId: branch.id,
          categoryId: categoryBySlug.get(s.categorySlug)!.id,
          name: s.name,
          durationMinutes: s.durationMinutes,
          basePrice: s.basePrice,
        }))
      )
      .returning();

    // Every demo staff member is assigned to every service at their branch —
    // GET /availability/staff's eligibility query (findEligibleStaff) only
    // returns a staff member assigned to EVERY requested service, not just
    // any one of them, so without this a customer picking more than one
    // service would always see "no eligible stylist" regardless of who's on
    // staff. Both demo staff being generalists is a simplification (real
    // staff would specialize), but keeps Choose Stylist showing real options
    // for any service combination during this visual pass.
    await db.insert(staffServices).values(
      staffRows.flatMap((s) => serviceRows.map((service) => ({ staffId: s.id, serviceId: service.id })))
    );

    // Synthetic COMPLETED bookings + reviews so GET /public/branches's
    // live-aggregated averageRating/reviewCount has real rows to compute from
    // (public-branch.repository.ts's getRatingAggregates groups directly over
    // the reviews table, keyed by branchId — no dependency beyond the FK).
    const ratings = ratingsAveragingTo(blueprint.targetAverage, blueprint.reviewCount);
    for (let i = 0; i < ratings.length; i++) {
      const service = serviceRows[i % serviceRows.length];
      const daysAgo = 5 + i * 3;
      const scheduledStart = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
      const scheduledEnd = new Date(scheduledStart.getTime() + service.durationMinutes * 60 * 1000);

      const [booking] = await db
        .insert(bookings)
        .values({
          bookingNumber: `DEMO-${branch.id.slice(0, 8)}-${i}`,
          customerId: customer.id,
          salonId: salon.id,
          branchId: branch.id,
          bookingType: "ONLINE",
          bookingStatus: "COMPLETED",
          selectedStaffId: staffRows[i % staffRows.length].id,
          scheduledStart,
          scheduledEnd,
          totalDurationMinutes: service.durationMinutes,
          subtotalAmount: service.basePrice,
          totalAmount: service.basePrice,
          completedAt: scheduledEnd,
        })
        .returning();

      await db.insert(bookingServices).values({
        bookingId: booking.id,
        serviceId: service.id,
        serviceName: service.name,
        durationMinutes: service.durationMinutes,
        price: service.basePrice,
        totalAmount: service.basePrice,
      });

      await db.insert(reviews).values({
        bookingId: booking.id,
        customerId: customer.id,
        salonId: salon.id,
        branchId: branch.id,
        staffId: staffRows[i % staffRows.length].id,
        overallRating: ratings[i],
        reviewText: REVIEW_TEXTS[i % REVIEW_TEXTS.length],
      });
    }

    created++;
    logger.info({ salon: blueprint.salonName, branchId: branch.id }, "Demo salon created");
  }

  logger.info({ created }, "Demo browse data seeding complete");
  await closeDatabaseConnection();
}

run().catch((err) => {
  logger.error({ err }, "dev-demo-browse-data seeding failed");
  process.exit(1);
});
