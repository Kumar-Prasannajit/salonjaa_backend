import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/config/database";
import { complaints, users, bookings, payments, auditLogs, adminActions } from "@/db/schema";

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

const COMPLAINT_JOIN_COLUMNS = { complaint: complaints, filedBy: users };

export class AdminComplaintRepository {
  async list(status?: string) {
    const query = db.select(COMPLAINT_JOIN_COLUMNS).from(complaints).innerJoin(users, eq(complaints.filedByUserId, users.id));
    return query
      .where(status ? and(sql`true`, eq(complaints.status, status as never)) : undefined)
      .orderBy(desc(complaints.createdAt));
  }

  async findById(complaintId: string) {
    const [row] = await db
      .select(COMPLAINT_JOIN_COLUMNS)
      .from(complaints)
      .innerJoin(users, eq(complaints.filedByUserId, users.id))
      .where(eq(complaints.id, complaintId))
      .limit(1);
    return row ?? null;
  }

  async findLinkedBooking(bookingId: string) {
    const [row] = await db
      .select({ id: bookings.id, bookingNumber: bookings.bookingNumber, bookingStatus: bookings.bookingStatus })
      .from(bookings)
      .where(eq(bookings.id, bookingId))
      .limit(1);
    return row ?? null;
  }

  async findLinkedPayment(paymentId: string) {
    const [row] = await db
      .select({ id: payments.id, amount: payments.amount, status: payments.status })
      .from(payments)
      .where(eq(payments.id, paymentId))
      .limit(1);
    return row ?? null;
  }

  async resolve(complaintId: string, resolvedBy: string, resolutionNotes: string) {
    const [row] = await db
      .update(complaints)
      .set({ status: "RESOLVED", resolvedBy, resolutionNotes, resolvedAt: new Date() })
      .where(eq(complaints.id, complaintId))
      .returning();
    return row;
  }

  async reject(complaintId: string, resolvedBy: string, reason: string) {
    const [row] = await db
      .update(complaints)
      .set({ status: "REJECTED", resolvedBy, resolutionNotes: reason, resolvedAt: new Date() })
      .where(eq(complaints.id, complaintId))
      .returning();
    return row;
  }

  async writeAuditLog(params: AuditLogParams): Promise<void> {
    await db.insert(auditLogs).values(params);
  }

  async writeAdminAction(params: AdminActionParams): Promise<void> {
    await db.insert(adminActions).values(params);
  }
}
