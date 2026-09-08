import { and, desc, eq, gte, inArray, isNull, lte } from "drizzle-orm";
import { db } from "@/config/database";
import { promotions, promotionBranches, promotionServices } from "@/db/schema";

export class PromotionRepository {
  async create(params: {
    createdByUserId: string;
    title: string;
    description?: string;
    bannerImageUrl?: string;
    startsAt: Date;
    endsAt: Date;
  }) {
    const [row] = await db.insert(promotions).values(params).returning();
    return row;
  }

  async linkBranches(promotionId: string, branchIds: string[]): Promise<void> {
    if (branchIds.length === 0) return;
    await db.insert(promotionBranches).values(branchIds.map((branchId) => ({ promotionId, branchId })));
  }

  async linkServices(promotionId: string, serviceIds: string[]): Promise<void> {
    if (serviceIds.length === 0) return;
    await db.insert(promotionServices).values(serviceIds.map((serviceId) => ({ promotionId, serviceId })));
  }

  async listBranchIds(promotionId: string): Promise<string[]> {
    const rows = await db.select({ branchId: promotionBranches.branchId }).from(promotionBranches).where(eq(promotionBranches.promotionId, promotionId));
    return rows.map((r) => r.branchId);
  }

  async listServiceIds(promotionId: string): Promise<string[]> {
    const rows = await db
      .select({ serviceId: promotionServices.serviceId })
      .from(promotionServices)
      .where(eq(promotionServices.promotionId, promotionId));
    return rows.map((r) => r.serviceId);
  }

  async listByCreator(userId: string) {
    return db
      .select()
      .from(promotions)
      .where(and(eq(promotions.createdByUserId, userId), isNull(promotions.deletedAt)))
      .orderBy(desc(promotions.createdAt));
  }

  async findById(id: string) {
    const [row] = await db
      .select()
      .from(promotions)
      .where(and(eq(promotions.id, id), isNull(promotions.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  async update(id: string, params: Record<string, unknown>) {
    const [row] = await db.update(promotions).set(params).where(eq(promotions.id, id)).returning();
    return row ?? null;
  }

  async softDelete(id: string): Promise<void> {
    await db.update(promotions).set({ deletedAt: new Date(), active: false }).where(eq(promotions.id, id));
  }

  /** Public discovery — currently-active, in-range promotions, optionally scoped to one branch. */
  async listActive(branchId?: string) {
    const now = new Date();
    const conditions = [eq(promotions.active, true), isNull(promotions.deletedAt), lte(promotions.startsAt, now), gte(promotions.endsAt, now)];

    if (!branchId) {
      return db.select().from(promotions).where(and(...conditions)).orderBy(desc(promotions.createdAt));
    }
    const branchPromoIds = await db
      .select({ promotionId: promotionBranches.promotionId })
      .from(promotionBranches)
      .where(eq(promotionBranches.branchId, branchId));
    const ids = branchPromoIds.map((r) => r.promotionId);
    if (ids.length === 0) return [];
    return db
      .select()
      .from(promotions)
      .where(and(...conditions, inArray(promotions.id, ids)))
      .orderBy(desc(promotions.createdAt));
  }

  /** Used by the promotion.deactivate delayed job — re-checks the promotion is still active
   * before acting, same safe-no-op pattern as every other delayed job in this codebase. */
  async deactivate(id: string): Promise<void> {
    await db.update(promotions).set({ active: false }).where(eq(promotions.id, id));
  }
}
