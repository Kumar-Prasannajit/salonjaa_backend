import { AdminRefundRepository } from "@/modules/admin/admin-refund.repository";
import { RequestMeta } from "@/modules/admin/admin.service";
import { NotificationService } from "@/modules/notification/notification.service";
import { AdminRefundDTO } from "@/modules/admin/admin-refund.types";
import { ConflictError, NotFoundError } from "@/shared/errors";
import { refunds, bookings, payments, users } from "@/db/schema";

type RefundRow = typeof refunds.$inferSelect;
type BookingRow = typeof bookings.$inferSelect;
type PaymentRow = typeof payments.$inferSelect;
type UserRow = typeof users.$inferSelect;
type JoinedRow = { refund: RefundRow; booking: BookingRow; payment: PaymentRow; customer: UserRow | null };

// No automated eligibility logic — every refund is read and decided by hand (ADMIN_CONTRACT.md
// §1). context.md's cancellation/refund eligibility policy is still an open Pending Decision;
// this deliberately doesn't encode a rule, same reasoning as the provisional refund-request
// gate in Module 7.
export class AdminRefundService {
  constructor(
    private readonly repo: AdminRefundRepository = new AdminRefundRepository(),
    private readonly notificationService: NotificationService = new NotificationService()
  ) {}

  async list(status?: string): Promise<AdminRefundDTO[]> {
    const rows = await this.repo.list(status);
    return rows.map((r) => this.toDTO(r));
  }

  async getOne(refundId: string): Promise<AdminRefundDTO> {
    const row = await this.requireRefund(refundId);
    return this.toDTO(row);
  }

  /** Marks the decision only — MVP payment is pay-at-salon, there's no gateway to actually issue funds through yet. */
  async approve(adminUserId: string, refundId: string, notes: string | undefined, meta: RequestMeta): Promise<AdminRefundDTO> {
    const existing = await this.requireRefund(refundId);
    if (existing.refund.status !== "PENDING") {
      throw new ConflictError("Only a pending refund can be approved");
    }

    const updated = await this.repo.updateStatus(refundId, "APPROVED", { approvedBy: adminUserId });
    await this.repo.writeRefundHistory(refundId, existing.refund.status, "APPROVED", adminUserId, notes);
    await this.logAction(adminUserId, refundId, "REFUND", existing.refund, updated, meta, notes ?? "Refund approved");

    if (existing.refund.customerId) {
      await this.notificationService.notify({
        userId: existing.refund.customerId,
        eventType: "REFUND_APPROVED",
        data: { bookingNumber: existing.booking.bookingNumber, amount: String(existing.refund.amount) },
      });
    }

    return this.toDTO({ ...existing, refund: updated });
  }

  async reject(adminUserId: string, refundId: string, reason: string, meta: RequestMeta): Promise<AdminRefundDTO> {
    const existing = await this.requireRefund(refundId);
    if (existing.refund.status !== "PENDING") {
      throw new ConflictError("Only a pending refund can be rejected");
    }

    const updated = await this.repo.updateStatus(refundId, "REJECTED");
    await this.repo.writeRefundHistory(refundId, existing.refund.status, "REJECTED", adminUserId, reason);
    await this.logAction(adminUserId, refundId, "REJECT", existing.refund, updated, meta, reason);

    if (existing.refund.customerId) {
      await this.notificationService.notify({
        userId: existing.refund.customerId,
        eventType: "REFUND_REJECTED",
        data: { bookingNumber: existing.booking.bookingNumber, reason },
      });
    }

    return this.toDTO({ ...existing, refund: updated });
  }

  private async requireRefund(refundId: string): Promise<JoinedRow> {
    const row = await this.repo.findById(refundId);
    if (!row) {
      throw new NotFoundError("Refund not found");
    }
    return row;
  }

  private async logAction(
    adminUserId: string,
    refundId: string,
    action: "REFUND" | "REJECT",
    oldValues: unknown,
    newValues: unknown,
    meta: RequestMeta,
    notes?: string
  ): Promise<void> {
    await this.repo.writeAuditLog({
      actorId: adminUserId,
      entityType: "refund",
      entityId: refundId,
      action: `refund.${action.toLowerCase()}`,
      oldValues,
      newValues,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    await this.repo.writeAdminAction({ adminUserId, entityType: "refund", entityId: refundId, action, notes });
  }

  private toDTO(row: JoinedRow): AdminRefundDTO {
    return {
      id: row.refund.id,
      amount: row.refund.amount,
      reason: row.refund.reason,
      status: row.refund.status,
      approvedBy: row.refund.approvedBy,
      processedAt: row.refund.processedAt?.toISOString() ?? null,
      createdAt: row.refund.createdAt.toISOString(),
      booking: {
        id: row.booking.id,
        bookingNumber: row.booking.bookingNumber,
        scheduledStart: row.booking.scheduledStart.toISOString(),
        scheduledEnd: row.booking.scheduledEnd.toISOString(),
        bookingStatus: row.booking.bookingStatus,
        totalAmount: row.booking.totalAmount,
      },
      payment: {
        id: row.payment.id,
        amount: row.payment.amount,
        currency: row.payment.currency,
        status: row.payment.status,
        providerPaymentId: row.payment.providerPaymentId,
        paidAt: row.payment.paidAt?.toISOString() ?? null,
      },
      customer: row.customer ? { id: row.customer.id, email: row.customer.email, fullName: row.customer.fullName } : null,
    };
  }
}
