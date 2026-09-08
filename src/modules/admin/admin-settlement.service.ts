import { AdminSettlementRepository } from "@/modules/admin/admin-settlement.repository";
import { SalonService } from "@/modules/salon/salon.service";
import { RequestMeta } from "@/modules/admin/admin.service";
import { AdminSettlementDTO, CreateSettlementInput } from "@/modules/admin/admin-settlement.types";
import { NotFoundError, ConflictError } from "@/shared/errors";
import { settlements } from "@/db/schema";

type SettlementRow = typeof settlements.$inferSelect;

/**
 * Module 16 — new contract (ADMIN_CONTRACT.md explicitly excluded settlement creation).
 * Deliberately manual, matching TRD §4's own "manual MVP records" characterization: no
 * commission-rate business rule exists anywhere in the docs, so this doesn't invent one — the
 * admin enters gross/commission/refund/adjustment amounts themselves (from whatever
 * accounting process they already use) and this just records + totals them, same spirit as
 * salon verification being a manual admin call rather than an automated rule.
 */
export class AdminSettlementService {
  constructor(
    private readonly repo: AdminSettlementRepository = new AdminSettlementRepository(),
    private readonly salonService: SalonService = new SalonService()
  ) {}

  async list(salonId?: string, status?: string): Promise<AdminSettlementDTO[]> {
    const rows = await this.repo.list(salonId, status);
    return rows.map((r) => this.toDTO(r));
  }

  async create(adminUserId: string, input: CreateSettlementInput, meta: RequestMeta): Promise<AdminSettlementDTO> {
    // Confirms the salon actually exists (findOwnerUserId returns null for an unknown salon) —
    // doesn't require the admin to *own* it, obviously, just that it's real.
    const ownerUserId = await this.salonService.findOwnerUserId(input.salonId);
    if (!ownerUserId) {
      throw new NotFoundError("Salon not found");
    }

    const commissionAmount = input.commissionAmount ?? 0;
    const refundAmount = input.refundAmount ?? 0;
    const adjustmentAmount = input.adjustmentAmount ?? 0;
    const netAmount = input.grossAmount - commissionAmount - refundAmount + adjustmentAmount;

    const row = await this.repo.create({
      salonId: input.salonId,
      branchId: input.branchId,
      periodStart: new Date(input.periodStart),
      periodEnd: new Date(input.periodEnd),
      grossAmount: input.grossAmount,
      commissionAmount,
      refundAmount,
      adjustmentAmount,
      netAmount,
    });

    if (input.bookingIds?.length) {
      await this.repo.linkBookings(row.id, input.bookingIds);
    }

    await this.repo.writeAuditLog({
      actorId: adminUserId,
      entityType: "settlement",
      entityId: row.id,
      action: "settlement.create",
      oldValues: null,
      newValues: row,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    await this.repo.writeAdminAction({ adminUserId, entityType: "settlement", entityId: row.id, action: "EDIT", notes: "Settlement created" });

    return this.toDTO(row);
  }

  async markSettled(adminUserId: string, id: string, meta: RequestMeta): Promise<AdminSettlementDTO> {
    const existing = await this.repo.findById(id);
    if (!existing) {
      throw new NotFoundError("Settlement not found");
    }
    if (existing.status === "COMPLETED") {
      throw new ConflictError("This settlement is already marked settled");
    }
    const updated = await this.repo.markSettled(id, "COMPLETED");

    await this.repo.writeAuditLog({
      actorId: adminUserId,
      entityType: "settlement",
      entityId: id,
      action: "settlement.settle",
      oldValues: existing,
      newValues: updated,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    await this.repo.writeAdminAction({ adminUserId, entityType: "settlement", entityId: id, action: "EDIT", notes: "Marked settled" });

    return this.toDTO(updated!);
  }

  private toDTO(row: SettlementRow): AdminSettlementDTO {
    return {
      id: row.id,
      salonId: row.salonId,
      branchId: row.branchId,
      periodStart: row.periodStart.toISOString(),
      periodEnd: row.periodEnd.toISOString(),
      grossAmount: row.grossAmount,
      commissionAmount: row.commissionAmount,
      refundAmount: row.refundAmount,
      adjustmentAmount: row.adjustmentAmount,
      netAmount: row.netAmount,
      status: row.status,
      settledAt: row.settledAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
