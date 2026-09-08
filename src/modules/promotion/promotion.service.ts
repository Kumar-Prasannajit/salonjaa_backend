import { PromotionRepository } from "@/modules/promotion/promotion.repository";
import { BranchService } from "@/modules/branch/branch.service";
import { ServiceService } from "@/modules/service/service.service";
import { CreatePromotionInput, PromotionDTO, UpdatePromotionInput } from "@/modules/promotion/promotion.types";
import { NotFoundError } from "@/shared/errors";
import { promotions } from "@/db/schema";
import { schedulePromotionDeactivation } from "@/queues/promotion-deactivate.queue";

type PromotionRow = typeof promotions.$inferSelect;

/**
 * Module 16 — new contract (TRD §4's promotions/promotion_branches/promotion_services,
 * deferred since Module 10 for lack of a source of truth). Salon Owner creates a promotion
 * targeting one or more of their own branches (and optionally specific services within
 * them); a public discovery endpoint lives in src/modules/browse/promotion.*.
 */
export class PromotionService {
  constructor(
    private readonly repo: PromotionRepository = new PromotionRepository(),
    private readonly branchService: BranchService = new BranchService(),
    private readonly serviceService: ServiceService = new ServiceService()
  ) {}

  async create(userId: string, input: CreatePromotionInput): Promise<PromotionDTO> {
    // Every targeted branch (and service, if any) must belong to the caller — no existence
    // leak, same assertOwned philosophy as everywhere else.
    for (const branchId of input.branchIds) {
      await this.branchService.assertOwned(userId, branchId);
    }
    for (const serviceId of input.serviceIds ?? []) {
      await this.serviceService.assertOwned(userId, serviceId);
    }

    const row = await this.repo.create({
      createdByUserId: userId,
      title: input.title,
      description: input.description,
      bannerImageUrl: input.bannerImageUrl,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
    });
    await this.repo.linkBranches(row.id, input.branchIds);
    if (input.serviceIds?.length) {
      await this.repo.linkServices(row.id, input.serviceIds);
    }
    await schedulePromotionDeactivation(row.id, row.endsAt.getTime() - Date.now());

    return this.toDTO(row, input.branchIds, input.serviceIds ?? []);
  }

  async listMine(userId: string): Promise<PromotionDTO[]> {
    const rows = await this.repo.listByCreator(userId);
    return Promise.all(rows.map((r) => this.hydrate(r)));
  }

  async update(userId: string, id: string, input: UpdatePromotionInput): Promise<PromotionDTO> {
    await this.requireOwned(userId, id);
    const params: Record<string, unknown> = { ...input };
    if (input.startsAt) params.startsAt = new Date(input.startsAt);
    if (input.endsAt) params.endsAt = new Date(input.endsAt);
    const updated = await this.repo.update(id, params);
    if (input.endsAt) {
      // Re-time the deactivation job so extending/shortening endsAt doesn't leave a stale job
      // firing at the old time — same rescheduleBookingCompletion precedent as Booking.
      await schedulePromotionDeactivation(id, updated!.endsAt.getTime() - Date.now());
    }
    return this.hydrate(updated!);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.requireOwned(userId, id);
    await this.repo.softDelete(id);
  }

  private async requireOwned(userId: string, id: string): Promise<PromotionRow> {
    const row = await this.repo.findById(id);
    if (!row || row.createdByUserId !== userId) {
      throw new NotFoundError("Promotion not found");
    }
    return row;
  }

  private async hydrate(row: PromotionRow): Promise<PromotionDTO> {
    const [branchIds, serviceIds] = await Promise.all([this.repo.listBranchIds(row.id), this.repo.listServiceIds(row.id)]);
    return this.toDTO(row, branchIds, serviceIds);
  }

  private toDTO(row: PromotionRow, branchIds: string[], serviceIds: string[]): PromotionDTO {
    return {
      id: row.id,
      createdByUserId: row.createdByUserId,
      title: row.title,
      description: row.description,
      bannerImageUrl: row.bannerImageUrl,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      active: row.active,
      branchIds,
      serviceIds,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
