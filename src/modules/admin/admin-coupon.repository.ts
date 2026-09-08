import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/config/database";
import { coupons, auditLogs, adminActions } from "@/db/schema";

interface AuditLogParams {
  actorId: string;
  entityType: string;
  entityId: string;
  action: string;
  oldValues: unknown;
  newValues: unknown;
  ipAddress?: string;
  userAgent?: string;
}

interface AdminActionParams {
  adminUserId: string;
  entityType: string;
  entityId: string;
  action: "APPROVE" | "REJECT" | "SUSPEND" | "REMOVE_STRIKE" | "REFUND" | "EDIT";
  notes?: string;
}

// Own repository, same admin-module precedent as admin-refund.*/admin-category.* — coupons
// previously had zero writers outside npm run db:seed and Module 16's own forfeiture-coupon
// path (BookingRepository.createForfeitureCoupon, a separate narrow insert, not this CRUD).
export class AdminCouponRepository {
  async list() {
    return db.select().from(coupons).where(isNull(coupons.deletedAt)).orderBy(desc(coupons.createdAt));
  }

  async findById(id: string) {
    const [row] = await db
      .select()
      .from(coupons)
      .where(and(eq(coupons.id, id), isNull(coupons.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  async findByCode(code: string) {
    const [row] = await db
      .select()
      .from(coupons)
      .where(and(eq(coupons.couponCode, code), isNull(coupons.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  async create(params: {
    createdByUserId: string;
    couponCode: string;
    type: "FIXED" | "PERCENTAGE";
    value: number;
    minimumAmount?: number;
    maxDiscount?: number;
    usageLimit?: number;
    startsAt?: Date;
    expiresAt?: Date;
  }) {
    const [row] = await db.insert(coupons).values(params).returning();
    return row;
  }

  async update(id: string, params: Record<string, unknown>) {
    const [row] = await db
      .update(coupons)
      .set({ ...params, updatedAt: new Date() })
      .where(eq(coupons.id, id))
      .returning();
    return row ?? null;
  }

  async softDelete(id: string) {
    const [row] = await db
      .update(coupons)
      .set({ deletedAt: new Date(), active: false, updatedAt: new Date() })
      .where(eq(coupons.id, id))
      .returning();
    return row ?? null;
  }

  async writeAuditLog(params: AuditLogParams): Promise<void> {
    await db.insert(auditLogs).values(params);
  }

  async writeAdminAction(params: AdminActionParams): Promise<void> {
    await db.insert(adminActions).values(params);
  }
}
