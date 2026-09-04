import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/config/database";
import { refunds, refundHistory, bookings, payments, users, auditLogs, adminActions } from "@/db/schema";

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

const REFUND_JOIN_COLUMNS = { refund: refunds, booking: bookings, payment: payments, customer: users };

export class AdminRefundRepository {
  async list(status?: string) {
    const query = db
      .select(REFUND_JOIN_COLUMNS)
      .from(refunds)
      .innerJoin(bookings, eq(refunds.bookingId, bookings.id))
      .innerJoin(payments, eq(refunds.paymentId, payments.id))
      .leftJoin(users, eq(refunds.customerId, users.id));

    const rows = await query
      .where(status ? and(sql`true`, eq(refunds.status, status as never)) : undefined)
      .orderBy(desc(refunds.createdAt));
    return rows;
  }

  async findById(refundId: string) {
    const [row] = await db
      .select(REFUND_JOIN_COLUMNS)
      .from(refunds)
      .innerJoin(bookings, eq(refunds.bookingId, bookings.id))
      .innerJoin(payments, eq(refunds.paymentId, payments.id))
      .leftJoin(users, eq(refunds.customerId, users.id))
      .where(eq(refunds.id, refundId))
      .limit(1);
    return row ?? null;
  }

  async updateStatus(refundId: string, status: "APPROVED" | "REJECTED", extra: { approvedBy?: string } = {}) {
    const [row] = await db
      .update(refunds)
      .set({ status, ...extra })
      .where(eq(refunds.id, refundId))
      .returning();
    return row;
  }

  async writeRefundHistory(refundId: string, oldStatus: string, newStatus: string, changedBy: string, notes?: string): Promise<void> {
    await db.insert(refundHistory).values({ refundId, oldStatus: oldStatus as never, newStatus: newStatus as never, changedBy, notes });
  }

  async writeAuditLog(params: AuditLogParams): Promise<void> {
    await db.insert(auditLogs).values(params);
  }

  async writeAdminAction(params: AdminActionParams): Promise<void> {
    await db.insert(adminActions).values(params);
  }
}
