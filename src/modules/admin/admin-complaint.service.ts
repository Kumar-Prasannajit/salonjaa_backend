import { AdminComplaintRepository } from "@/modules/admin/admin-complaint.repository";
import { RequestMeta } from "@/modules/admin/admin.service";
import { NotificationService } from "@/modules/notification/notification.service";
import { AdminComplaintDTO } from "@/modules/admin/admin-complaint.types";
import { ConflictError, NotFoundError } from "@/shared/errors";
import { complaints, users } from "@/db/schema";

type ComplaintRow = typeof complaints.$inferSelect;
type UserRow = typeof users.$inferSelect;
type JoinedRow = { complaint: ComplaintRow; filedBy: UserRow };

const RESOLVABLE_STATUSES = ["OPEN", "IN_PROGRESS"];

export class AdminComplaintService {
  constructor(
    private readonly repo: AdminComplaintRepository = new AdminComplaintRepository(),
    private readonly notificationService: NotificationService = new NotificationService()
  ) {}

  async list(status?: string): Promise<AdminComplaintDTO[]> {
    const rows = await this.repo.list(status);
    return Promise.all(rows.map((r) => this.toDTO(r)));
  }

  async getOne(complaintId: string): Promise<AdminComplaintDTO> {
    const row = await this.requireComplaint(complaintId);
    return this.toDTO(row);
  }

  async resolve(adminUserId: string, complaintId: string, resolutionNotes: string, meta: RequestMeta): Promise<AdminComplaintDTO> {
    const existing = await this.requireComplaint(complaintId);
    if (!RESOLVABLE_STATUSES.includes(existing.complaint.status)) {
      throw new ConflictError("Only an open complaint can be resolved");
    }

    const updated = await this.repo.resolve(complaintId, adminUserId, resolutionNotes);
    await this.logAction(adminUserId, complaintId, "APPROVE", existing.complaint, updated, meta, resolutionNotes);
    await this.notificationService.notify({
      userId: existing.complaint.filedByUserId,
      eventType: "COMPLAINT_RESOLVED",
      data: { resolutionNotes },
    });

    return this.toDTO({ ...existing, complaint: updated });
  }

  async reject(adminUserId: string, complaintId: string, reason: string, meta: RequestMeta): Promise<AdminComplaintDTO> {
    const existing = await this.requireComplaint(complaintId);
    if (!RESOLVABLE_STATUSES.includes(existing.complaint.status)) {
      throw new ConflictError("Only an open complaint can be rejected");
    }

    const updated = await this.repo.reject(complaintId, adminUserId, reason);
    await this.logAction(adminUserId, complaintId, "REJECT", existing.complaint, updated, meta, reason);
    await this.notificationService.notify({
      userId: existing.complaint.filedByUserId,
      eventType: "COMPLAINT_REJECTED",
      data: { reason },
    });

    return this.toDTO({ ...existing, complaint: updated });
  }

  private async requireComplaint(complaintId: string): Promise<JoinedRow> {
    const row = await this.repo.findById(complaintId);
    if (!row) {
      throw new NotFoundError("Complaint not found");
    }
    return row;
  }

  private async logAction(
    adminUserId: string,
    complaintId: string,
    action: "APPROVE" | "REJECT",
    oldValues: unknown,
    newValues: unknown,
    meta: RequestMeta,
    notes?: string
  ): Promise<void> {
    await this.repo.writeAuditLog({
      actorId: adminUserId,
      entityType: "complaint",
      entityId: complaintId,
      action: `complaint.${action.toLowerCase()}`,
      oldValues,
      newValues,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    await this.repo.writeAdminAction({ adminUserId, entityType: "complaint", entityId: complaintId, action, notes });
  }

  private async toDTO(row: JoinedRow): Promise<AdminComplaintDTO> {
    let linkedBooking: AdminComplaintDTO["linkedBooking"] = null;
    let linkedPayment: AdminComplaintDTO["linkedPayment"] = null;

    if (row.complaint.referenceId && row.complaint.type === "BOOKING") {
      linkedBooking = await this.repo.findLinkedBooking(row.complaint.referenceId);
    } else if (row.complaint.referenceId && row.complaint.type === "PAYMENT") {
      linkedPayment = await this.repo.findLinkedPayment(row.complaint.referenceId);
    }

    return {
      id: row.complaint.id,
      type: row.complaint.type,
      referenceId: row.complaint.referenceId,
      description: row.complaint.description,
      status: row.complaint.status,
      resolutionNotes: row.complaint.resolutionNotes,
      resolvedAt: row.complaint.resolvedAt?.toISOString() ?? null,
      createdAt: row.complaint.createdAt.toISOString(),
      filedBy: { id: row.filedBy.id, email: row.filedBy.email, fullName: row.filedBy.fullName },
      linkedBooking,
      linkedPayment,
    };
  }
}
