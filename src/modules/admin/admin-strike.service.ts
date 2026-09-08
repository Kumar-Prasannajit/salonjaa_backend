import { AdminStrikeRepository } from "@/modules/admin/admin-strike.repository";
import { StrikeService } from "@/modules/strike/strike.service";
import { RequestMeta } from "@/modules/admin/admin.service";
import { AdminStrikeDTO, CustomerStrikeSummary } from "@/modules/admin/admin-strike.types";
import { ConflictError, NotFoundError } from "@/shared/errors";
import { customerStrikes } from "@/db/schema";

type StrikeRow = typeof customerStrikes.$inferSelect;

/**
 * Module 16's admin surface for docs/ADMIN_CONTRACT.md's previously-excluded "customer
 * strikes" item. FAKE_BOOKING/ABUSIVE_CANCELLATION strikes have no automated trigger anywhere
 * yet — this is how an admin records one manually. NO_SHOW strikes are normally
 * auto-recorded by BookingService.markNoShow; an admin can still add one here too (e.g.
 * backfilling a strike for a no-show that happened before this module existed).
 */
export class AdminStrikeService {
  constructor(
    private readonly repo: AdminStrikeRepository = new AdminStrikeRepository(),
    private readonly strikeService: StrikeService = new StrikeService()
  ) {}

  async listForCustomer(customerId: string): Promise<CustomerStrikeSummary> {
    const rows = await this.repo.listByCustomer(customerId);
    const advancePaymentRequired = await this.strikeService.isAdvancePaymentRequired(customerId);
    const activeNoShowCount = rows.filter((r) => r.type === "NO_SHOW" && !r.removedAt).length;
    return {
      customerId,
      activeNoShowCount,
      advancePaymentRequired,
      strikes: rows.map((r) => this.toDTO(r)),
    };
  }

  async add(
    adminUserId: string,
    customerId: string,
    input: { type: "FAKE_BOOKING" | "NO_SHOW" | "ABUSIVE_CANCELLATION"; bookingId?: string; notes?: string },
    meta: RequestMeta
  ): Promise<AdminStrikeDTO> {
    const row = await this.repo.create({ customerId, ...input });
    await this.logAction(adminUserId, row.id, "EDIT", null, row, meta, `Strike added: ${input.type}`);
    return this.toDTO(row);
  }

  async remove(adminUserId: string, customerId: string, strikeId: string, reason: string, meta: RequestMeta): Promise<AdminStrikeDTO> {
    const existing = await this.repo.findById(strikeId);
    if (!existing || existing.customerId !== customerId) {
      throw new NotFoundError("Strike not found");
    }
    if (existing.removedAt) {
      throw new ConflictError("This strike has already been removed");
    }
    const updated = await this.repo.remove(strikeId, adminUserId, reason);
    await this.logAction(adminUserId, strikeId, "REMOVE_STRIKE", existing, updated, meta, reason);
    return this.toDTO(updated!);
  }

  private async logAction(
    adminUserId: string,
    strikeId: string,
    action: "EDIT" | "REMOVE_STRIKE",
    oldValues: unknown,
    newValues: unknown,
    meta: RequestMeta,
    notes?: string
  ): Promise<void> {
    await this.repo.writeAuditLog({
      actorId: adminUserId,
      entityType: "customer_strike",
      entityId: strikeId,
      action: `strike.${action.toLowerCase()}`,
      oldValues,
      newValues,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    await this.repo.writeAdminAction({ adminUserId, entityType: "customer_strike", entityId: strikeId, action, notes });
  }

  private toDTO(row: StrikeRow): AdminStrikeDTO {
    return {
      id: row.id,
      customerId: row.customerId,
      bookingId: row.bookingId,
      type: row.type,
      notes: row.notes,
      removedAt: row.removedAt?.toISOString() ?? null,
      removedBy: row.removedBy,
      removalReason: row.removalReason,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
