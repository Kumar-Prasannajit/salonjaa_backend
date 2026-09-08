import { eq } from "drizzle-orm";
import { db } from "@/config/database";
import { salonOwnerProfiles, salons, branches, branchServices, serviceCategories, staff, staffServices } from "@/db/schema";
import { createTestUser } from "./auth";
import { ROLE_NAMES } from "@/shared/constants";

/**
 * A bookable branch with one active service and one assigned staff member — the common
 * fixture almost every Booking/Availability/Payment test needs. Inserted directly (bypassing
 * the Salon/Branch/Staff/Service HTTP endpoints, which are already covered by their own
 * module's tests) and the salon is verified directly in the DB, same precedent this whole
 * project's manual-verification passes used ("salon verification flipped directly in
 * Postgres, since no Admin endpoint existed yet" — Module 5's PROGRESS.md note) — except here
 * it's simply faster test setup, the Admin endpoint exists and is tested on its own.
 */
export async function createBookableBranch(
  overrides: { totalChairs?: number; openingTime?: string; closingTime?: string; basePrice?: number; durationMinutes?: number } = {}
) {
  const owner = await createTestUser([ROLE_NAMES.CUSTOMER, ROLE_NAMES.SALON_OWNER]);

  const [profile] = await db.insert(salonOwnerProfiles).values({ userId: owner.id }).returning();
  const [salon] = await db
    .insert(salons)
    .values({ ownerProfileId: profile.id, name: "Test Salon", status: "ACTIVE", verificationStatus: "VERIFIED" })
    .returning();
  const [branch] = await db
    .insert(branches)
    .values({
      salonId: salon.id,
      name: "Test Branch",
      phone: "+919999999999",
      addressLine1: "1 Test Street",
      city: "Hyderabad",
      state: "Telangana",
      postalCode: "500001",
      totalChairs: overrides.totalChairs ?? 2,
      openingTime: overrides.openingTime ?? "09:00",
      closingTime: overrides.closingTime ?? "18:00",
      status: "ACTIVE",
    })
    .returning();
  const [category] = await db.insert(serviceCategories).values({ name: "Test Category", slug: `test-category-${branch.id}` }).returning();
  const [service] = await db
    .insert(branchServices)
    .values({
      branchId: branch.id,
      categoryId: category.id,
      name: "Haircut",
      durationMinutes: overrides.durationMinutes ?? 30,
      basePrice: overrides.basePrice ?? 200,
      status: "ACTIVE",
    })
    .returning();
  const [staffMember] = await db
    .insert(staff)
    .values({ branchId: branch.id, fullName: "Test Stylist", staffType: "NORMAL", status: "ACTIVE" })
    .returning();
  await db.insert(staffServices).values({ staffId: staffMember.id, serviceId: service.id });

  return { owner, salon, branch, service, staffMember };
}

export async function verifySalon(salonId: string): Promise<void> {
  await db.update(salons).set({ status: "ACTIVE", verificationStatus: "VERIFIED" }).where(eq(salons.id, salonId));
}

/** YYYY-MM-DD for "tomorrow," server-local — every booking-related test needs a date that's
 * never in the past regardless of what day the suite happens to run. */
export function tomorrowDateString(): string {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}
