import { and, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { db } from "@/config/database";
import { branches, salons, branchServices, serviceCategories, reviews } from "@/db/schema";

export interface BranchSearchFilters {
  city?: string;
  q?: string;
  serviceCategoryId?: string;
}

export class PublicBranchRepository {
  /**
   * Public discovery listing. Only a VERIFIED, ACTIVE salon's ACTIVE branches ever appear —
   * the exact same "bookable" gate AvailabilityRepository.findBookableBranch already
   * enforces (Module 5), reused here for consistency rather than inventing a second gate.
   */
  async search(filters: BranchSearchFilters) {
    const conditions = [
      isNull(branches.deletedAt),
      eq(branches.status, "ACTIVE"),
      isNull(salons.deletedAt),
      eq(salons.status, "ACTIVE"),
      eq(salons.verificationStatus, "VERIFIED"),
    ];
    if (filters.city) {
      conditions.push(ilike(branches.city, filters.city));
    }
    if (filters.q) {
      const term = `%${filters.q}%`;
      conditions.push(or(ilike(salons.name, term), ilike(branches.name, term))!);
    }
    if (filters.serviceCategoryId) {
      conditions.push(
        inArray(
          branches.id,
          db
            .select({ id: branchServices.branchId })
            .from(branchServices)
            .where(
              and(
                eq(branchServices.categoryId, filters.serviceCategoryId),
                eq(branchServices.status, "ACTIVE"),
                isNull(branchServices.deletedAt)
              )
            )
        )
      );
    }

    return db
      .select({ branch: branches, salon: salons })
      .from(branches)
      .innerJoin(salons, eq(branches.salonId, salons.id))
      .where(and(...conditions));
  }

  /** Same bookable gate as search() above — 404s rather than leaking existence otherwise. */
  async findBookableBranchDetail(branchId: string) {
    const [row] = await db
      .select({ branch: branches, salon: salons })
      .from(branches)
      .innerJoin(salons, eq(branches.salonId, salons.id))
      .where(
        and(
          eq(branches.id, branchId),
          isNull(branches.deletedAt),
          eq(branches.status, "ACTIVE"),
          isNull(salons.deletedAt),
          eq(salons.status, "ACTIVE"),
          eq(salons.verificationStatus, "VERIFIED")
        )
      )
      .limit(1);
    return row ?? null;
  }

  async findActiveServicesWithCategory(branchId: string) {
    return db
      .select({
        id: branchServices.id,
        categoryId: branchServices.categoryId,
        categoryName: serviceCategories.name,
        name: branchServices.name,
        durationMinutes: branchServices.durationMinutes,
        basePrice: branchServices.basePrice,
        imageUrl: branchServices.imageUrl,
      })
      .from(branchServices)
      .innerJoin(serviceCategories, eq(branchServices.categoryId, serviceCategories.id))
      .where(
        and(eq(branchServices.branchId, branchId), eq(branchServices.status, "ACTIVE"), isNull(branchServices.deletedAt))
      );
  }

  /**
   * Live-computed, no cache — same "compute on every request" precedent Availability chose
   * for MVP (Module 5) rather than wiring Redis invalidation for an unfinalized TTL.
   */
  async getRatingAggregates(branchIds: string[]): Promise<Map<string, { average: number; count: number }>> {
    if (branchIds.length === 0) return new Map();
    const rows = await db
      .select({
        branchId: reviews.branchId,
        average: sql<number>`avg(${reviews.overallRating})`.mapWith(Number),
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(reviews)
      .where(and(inArray(reviews.branchId, branchIds), isNull(reviews.deletedAt)))
      .groupBy(reviews.branchId);

    const map = new Map<string, { average: number; count: number }>();
    for (const r of rows) {
      map.set(r.branchId, { average: Math.round(r.average * 10) / 10, count: r.count });
    }
    return map;
  }
}
