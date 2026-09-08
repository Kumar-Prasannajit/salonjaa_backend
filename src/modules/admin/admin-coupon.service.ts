import { AdminCouponRepository } from "@/modules/admin/admin-coupon.repository";
import { RequestMeta } from "@/modules/admin/admin.service";
import { AdminCouponDTO, CreateCouponInput, UpdateCouponInput } from "@/modules/admin/admin-coupon.types";
import { ConflictError, NotFoundError } from "@/shared/errors";
import { coupons } from "@/db/schema";

type CouponRow = typeof coupons.$inferSelect;

/** Module 16 — new contract (ADMIN_CONTRACT.md explicitly excluded coupon management). */
export class AdminCouponService {
  constructor(private readonly repo: AdminCouponRepository = new AdminCouponRepository()) {}

  async list(): Promise<AdminCouponDTO[]> {
    const rows = await this.repo.list();
    return rows.map((r) => this.toDTO(r));
  }

  async create(adminUserId: string, input: CreateCouponInput, meta: RequestMeta): Promise<AdminCouponDTO> {
    const existing = await this.repo.findByCode(input.couponCode);
    if (existing) {
      throw new ConflictError("A coupon with this code already exists");
    }
    const row = await this.repo.create({
      createdByUserId: adminUserId,
      couponCode: input.couponCode,
      type: input.type,
      value: input.value,
      minimumAmount: input.minimumAmount,
      maxDiscount: input.maxDiscount,
      usageLimit: input.usageLimit,
      startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
    });
    await this.logAction(adminUserId, row.id, null, row, meta, "Coupon created");
    return this.toDTO(row);
  }

  async update(adminUserId: string, id: string, input: UpdateCouponInput, meta: RequestMeta): Promise<AdminCouponDTO> {
    const existing = await this.requireCoupon(id);
    const params: Record<string, unknown> = { ...input };
    if (input.startsAt) params.startsAt = new Date(input.startsAt);
    if (input.expiresAt) params.expiresAt = new Date(input.expiresAt);
    const updated = await this.repo.update(id, params);
    await this.logAction(adminUserId, id, existing, updated, meta, "Coupon updated");
    return this.toDTO(updated!);
  }

  async remove(adminUserId: string, id: string, meta: RequestMeta): Promise<void> {
    const existing = await this.requireCoupon(id);
    const updated = await this.repo.softDelete(id);
    await this.logAction(adminUserId, id, existing, updated, meta, "Coupon deleted");
  }

  private async requireCoupon(id: string): Promise<CouponRow> {
    const row = await this.repo.findById(id);
    if (!row) {
      throw new NotFoundError("Coupon not found");
    }
    return row;
  }

  private async logAction(adminUserId: string, couponId: string, oldValues: unknown, newValues: unknown, meta: RequestMeta, notes: string): Promise<void> {
    await this.repo.writeAuditLog({
      actorId: adminUserId,
      entityType: "coupon",
      entityId: couponId,
      action: "coupon.edit",
      oldValues,
      newValues,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
    await this.repo.writeAdminAction({ adminUserId, entityType: "coupon", entityId: couponId, action: "EDIT", notes });
  }

  private toDTO(row: CouponRow): AdminCouponDTO {
    return {
      id: row.id,
      couponCode: row.couponCode,
      type: row.type,
      value: row.value,
      minimumAmount: row.minimumAmount,
      maxDiscount: row.maxDiscount,
      usageLimit: row.usageLimit,
      usedCount: row.usedCount,
      startsAt: row.startsAt?.toISOString() ?? null,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      active: row.active,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
