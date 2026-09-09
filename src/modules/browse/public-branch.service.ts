import { PublicBranchRepository } from "@/modules/browse/public-branch.repository";
import { PromotionRepository } from "@/modules/promotion/promotion.repository";
import { SalonService } from "@/modules/salon/salon.service";
import { BranchSearchQuery, PublicBranchDetailDTO, PublicBranchListItemDTO } from "@/modules/browse/public-branch.types";
import { NotFoundError } from "@/shared/errors";
import { haversineKm } from "@/shared/geo";
import { PRICE_TIER_LOW_MAX, PRICE_TIER_MID_MAX } from "@/shared/constants";

/** Module 21 — buckets an average active-service price into a ₹/₹₹/₹₹₹ tier. Cutoffs
 * confirmed with the user: < ₹300 is ₹, ₹300–800 is ₹₹, > ₹800 is ₹₹₹. */
function computePriceTier(averagePrice: number | undefined): "₹" | "₹₹" | "₹₹₹" | null {
  if (averagePrice === undefined) return null;
  if (averagePrice < PRICE_TIER_LOW_MAX) return "₹";
  if (averagePrice <= PRICE_TIER_MID_MAX) return "₹₹";
  return "₹₹₹";
}

export class PublicBranchService {
  constructor(
    private readonly repo: PublicBranchRepository = new PublicBranchRepository(),
    private readonly salonService: SalonService = new SalonService(),
    private readonly promotionRepo: PromotionRepository = new PromotionRepository()
  ) {}

  async search(query: BranchSearchQuery): Promise<PublicBranchListItemDTO[]> {
    const rows = await this.repo.search({
      city: query.city,
      q: query.q,
      serviceCategoryId: query.serviceCategoryId,
      salonId: query.salonId,
    });
    const branchIds = rows.map((r) => r.branch.id);
    const [ratings, averagePrices, featuredPromotions] = await Promise.all([
      this.repo.getRatingAggregates(branchIds),
      this.repo.getAveragePrices(branchIds),
      this.promotionRepo.findFeaturedActiveByBranchIds(branchIds),
    ]);

    let items: PublicBranchListItemDTO[] = rows.map(({ branch, salon }) => {
      const rating = ratings.get(branch.id);
      const distanceKm =
        query.lat !== undefined && query.lng !== undefined && branch.latitude !== null && branch.longitude !== null
          ? Math.round(haversineKm(query.lat, query.lng, branch.latitude, branch.longitude) * 10) / 10
          : null;
      return {
        branchId: branch.id,
        salonId: salon.id,
        salonName: salon.name,
        branchName: branch.name,
        city: branch.city,
        addressLine1: branch.addressLine1,
        coverImage: salon.coverImage,
        distanceKm,
        averageRating: rating?.average ?? null,
        reviewCount: rating?.count ?? 0,
        priceTier: computePriceTier(averagePrices.get(branch.id)),
        genderServed: branch.genderServed,
        activePromotion: featuredPromotions.get(branch.id) ?? null,
      };
    });

    const sort = query.sort ?? "popular";
    if (sort === "distance") {
      // Validator guarantees lat/lng were supplied when sort=distance, so every item has a
      // non-null distanceKm here.
      items = items.sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0));
    } else if (sort === "rating") {
      items = items.sort((a, b) => (b.averageRating ?? 0) - (a.averageRating ?? 0));
    } else {
      // "popular" — by review count, matching the proposal's Home/Explore "Popular Near You"
      // framing. No separate popularity signal (views/bookings-count) exists to rank by.
      items = items.sort((a, b) => b.reviewCount - a.reviewCount);
    }

    return items;
  }

  async getDetail(branchId: string): Promise<PublicBranchDetailDTO> {
    const row = await this.repo.findBookableBranchDetail(branchId);
    if (!row) {
      // Same "don't leak existence" philosophy as owner-scoped assertOwned — a PENDING,
      // REJECTED, or SUSPENDED salon's branch 404s exactly like a nonexistent one.
      throw new NotFoundError("Branch not found");
    }
    const { branch, salon } = row;

    const [rawServices, ratings, gallery, averagePrices] = await Promise.all([
      this.repo.findActiveServicesWithCategory(branchId),
      this.repo.getRatingAggregates([branchId]),
      this.salonService.listGallery(salon.id),
      this.repo.getAveragePrices([branchId]),
    ]);
    const rating = ratings.get(branchId);

    // Module 22 — bulk-fetch every active service's variants in one extra query, not one per
    // service (same N+1-avoidance precedent as ratings/prices above).
    const variantRows = await this.repo.findActiveVariantsForServices(rawServices.map((s) => s.id));
    const variantsByService = new Map<string, { id: string; name: string; price: number }[]>();
    for (const v of variantRows) {
      const list = variantsByService.get(v.branchServiceId) ?? [];
      list.push({ id: v.id, name: v.name, price: v.price });
      variantsByService.set(v.branchServiceId, list);
    }
    const services = rawServices.map((s) => ({ ...s, variants: variantsByService.get(s.id) ?? [] }));

    return {
      branchId: branch.id,
      salonId: salon.id,
      salonName: salon.name,
      branchName: branch.name,
      description: salon.description,
      coverImage: salon.coverImage,
      // Module 16 — was always an empty placeholder; now backed by salon_gallery_images.
      gallery: gallery.map((g) => g.imageUrl),
      city: branch.city,
      addressLine1: branch.addressLine1,
      latitude: branch.latitude,
      longitude: branch.longitude,
      phone: branch.phone,
      verificationStatus: salon.verificationStatus,
      averageRating: rating?.average ?? null,
      reviewCount: rating?.count ?? 0,
      openingTime: branch.openingTime,
      closingTime: branch.closingTime,
      services,
      priceTier: computePriceTier(averagePrices.get(branchId)),
      genderServed: branch.genderServed,
    };
  }
}
