import { PromotionRepository } from "@/modules/promotion/promotion.repository";
import { PublicPromotionDTO } from "@/modules/browse/promotion.types";

/**
 * Module 16 — public counterpart of src/modules/promotion (owner CRUD). Reuses
 * PromotionRepository directly (read-only here) rather than duplicating the active-in-range
 * query — same "no separate repository needed for a pure read" reasoning as
 * ServiceCategoryRepository being minimal.
 */
export class PublicPromotionService {
  constructor(private readonly repo: PromotionRepository = new PromotionRepository()) {}

  async listActive(branchId?: string): Promise<PublicPromotionDTO[]> {
    const rows = await this.repo.listActive(branchId);
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      bannerImageUrl: r.bannerImageUrl,
      startsAt: r.startsAt.toISOString(),
      endsAt: r.endsAt.toISOString(),
    }));
  }
}
