import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/config/database";
import { branchServices, staffServices, branches, salons, salonOwnerProfiles, serviceVariants } from "@/db/schema";
import { CreateServiceInput, CreateVariantInput, UpdateServiceInput, UpdateVariantInput } from "@/modules/service/service.types";

export class ServiceRepository {
  async create(input: CreateServiceInput) {
    const [row] = await db
      .insert(branchServices)
      .values({
        branchId: input.branchId,
        categoryId: input.categoryId,
        name: input.name,
        durationMinutes: input.durationMinutes,
        basePrice: input.basePrice,
      })
      .returning();
    return row;
  }

  /** Raw lookup by id (non-deleted), no ownership check — caller verifies branch ownership. */
  async findById(serviceId: string) {
    const [row] = await db
      .select()
      .from(branchServices)
      .where(and(eq(branchServices.id, serviceId), isNull(branchServices.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  /** Lists services across every branch owned (transitively) by this user, optionally filtered to one branch. */
  async listOwned(userId: string, branchId?: string) {
    const conditions = [
      eq(salonOwnerProfiles.userId, userId),
      isNull(salonOwnerProfiles.deletedAt),
      isNull(salons.deletedAt),
      isNull(branches.deletedAt),
      isNull(branchServices.deletedAt),
    ];
    if (branchId) conditions.push(eq(branchServices.branchId, branchId));

    const rows = await db
      .select({ service: branchServices })
      .from(branchServices)
      .innerJoin(branches, eq(branchServices.branchId, branches.id))
      .innerJoin(salons, eq(branches.salonId, salons.id))
      .innerJoin(salonOwnerProfiles, eq(salons.ownerProfileId, salonOwnerProfiles.id))
      .where(and(...conditions));
    return rows.map((r) => r.service);
  }

  async update(serviceId: string, input: UpdateServiceInput) {
    const [row] = await db
      .update(branchServices)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(branchServices.id, serviceId))
      .returning();
    return row;
  }

  async softDelete(serviceId: string) {
    await db.update(branchServices).set({ deletedAt: new Date() }).where(eq(branchServices.id, serviceId));
  }

  // ---- Staff assignment ----

  async findAssignment(staffId: string, serviceId: string) {
    const [row] = await db
      .select()
      .from(staffServices)
      .where(and(eq(staffServices.staffId, staffId), eq(staffServices.serviceId, serviceId)))
      .limit(1);
    return row ?? null;
  }

  async assignStaff(staffId: string, serviceId: string) {
    const [row] = await db.insert(staffServices).values({ staffId, serviceId }).returning();
    return row;
  }

  async removeAssignment(staffId: string, serviceId: string) {
    await db
      .delete(staffServices)
      .where(and(eq(staffServices.staffId, staffId), eq(staffServices.serviceId, serviceId)));
  }

  // ---- Module 22: service variants ----

  async listVariants(branchServiceId: string) {
    return db
      .select()
      .from(serviceVariants)
      .where(and(eq(serviceVariants.branchServiceId, branchServiceId), isNull(serviceVariants.deletedAt)));
  }

  async findVariant(branchServiceId: string, variantId: string) {
    const [row] = await db
      .select()
      .from(serviceVariants)
      .where(
        and(eq(serviceVariants.id, variantId), eq(serviceVariants.branchServiceId, branchServiceId), isNull(serviceVariants.deletedAt))
      )
      .limit(1);
    return row ?? null;
  }

  async createVariant(branchServiceId: string, input: CreateVariantInput) {
    const [row] = await db
      .insert(serviceVariants)
      .values({ branchServiceId, name: input.name, price: input.price })
      .returning();
    return row;
  }

  async updateVariant(variantId: string, input: UpdateVariantInput) {
    const [row] = await db
      .update(serviceVariants)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(serviceVariants.id, variantId))
      .returning();
    return row;
  }

  async softDeleteVariant(variantId: string): Promise<void> {
    await db.update(serviceVariants).set({ deletedAt: new Date() }).where(eq(serviceVariants.id, variantId));
  }

  /**
   * Bulk lookup used by BookingService.resolveServiceLines — every ACTIVE variant across a set
   * of services in one query (same N+1-avoidance precedent as AvailabilityRepository's own
   * bulk findActiveServices), so it can both validate a chosen variantId and detect which
   * services require one (have ≥1 active variant) but got none.
   */
  async listActiveVariantsForServices(branchServiceIds: string[]) {
    if (branchServiceIds.length === 0) return [];
    return db
      .select()
      .from(serviceVariants)
      .where(
        and(
          inArray(serviceVariants.branchServiceId, branchServiceIds),
          eq(serviceVariants.status, "ACTIVE"),
          isNull(serviceVariants.deletedAt)
        )
      );
  }
}
