import { desc, eq } from "drizzle-orm";
import { db } from "@/config/database";
import { customerStrikes, auditLogs, adminActions } from "@/db/schema";

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

// Own repository querying customer_strikes directly rather than reusing
// src/modules/strike/strike.repository.ts — same precedent as admin-refund.* not reusing
// PaymentRepository (Module 9b/9c): the admin surface's query shapes (full history including
// removed rows, audit/admin-action writes) are admin-specific, not shared with Booking's
// narrower "count active strikes" need.
export class AdminStrikeRepository {
  async listByCustomer(customerId: string) {
    return db.select().from(customerStrikes).where(eq(customerStrikes.customerId, customerId)).orderBy(desc(customerStrikes.createdAt));
  }

  async findById(strikeId: string) {
    const [row] = await db.select().from(customerStrikes).where(eq(customerStrikes.id, strikeId)).limit(1);
    return row ?? null;
  }

  async create(params: { customerId: string; bookingId?: string; type: "FAKE_BOOKING" | "NO_SHOW" | "ABUSIVE_CANCELLATION"; notes?: string }) {
    const [row] = await db
      .insert(customerStrikes)
      .values({ customerId: params.customerId, bookingId: params.bookingId ?? null, type: params.type, notes: params.notes ?? null })
      .returning();
    return row;
  }

  async remove(strikeId: string, removedBy: string, removalReason: string) {
    const [row] = await db
      .update(customerStrikes)
      .set({ removedAt: new Date(), removedBy, removalReason })
      .where(eq(customerStrikes.id, strikeId))
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
