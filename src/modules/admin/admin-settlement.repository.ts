import { and, desc, eq } from "drizzle-orm";
import { db } from "@/config/database";
import { settlements, settlementBookings, auditLogs, adminActions } from "@/db/schema";

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

// Own repository, same admin-module precedent as admin-refund.*/admin-category.* — settlements
// existed since Module 7 with zero writers (TRD: "manual MVP records"), GET /payments/
// salon-settlements always returned []. This is the first writer.
export class AdminSettlementRepository {
  async list(salonId?: string, status?: string) {
    const conditions = [];
    if (salonId) conditions.push(eq(settlements.salonId, salonId));
    if (status) conditions.push(eq(settlements.status, status as never));
    return db
      .select()
      .from(settlements)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(settlements.createdAt));
  }

  async findById(id: string) {
    const [row] = await db.select().from(settlements).where(eq(settlements.id, id)).limit(1);
    return row ?? null;
  }

  async create(params: {
    salonId: string;
    branchId?: string;
    periodStart: Date;
    periodEnd: Date;
    grossAmount: number;
    commissionAmount: number;
    refundAmount: number;
    adjustmentAmount: number;
    netAmount: number;
  }) {
    const [row] = await db.insert(settlements).values(params).returning();
    return row;
  }

  async linkBookings(settlementId: string, bookingIds: string[]): Promise<void> {
    if (bookingIds.length === 0) return;
    await db
      .insert(settlementBookings)
      .values(bookingIds.map((bookingId) => ({ settlementId, bookingId })))
      .onConflictDoNothing();
  }

  async markSettled(id: string, status: "PROCESSING" | "COMPLETED") {
    const [row] = await db
      .update(settlements)
      .set({ status, settledAt: status === "COMPLETED" ? new Date() : null })
      .where(eq(settlements.id, id))
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
