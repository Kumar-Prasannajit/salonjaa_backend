import { PublicBranchRepository } from "@/modules/browse/public-branch.repository";
import { SalonService } from "@/modules/salon/salon.service";
import { BranchSearchQuery, PublicBranchDetailDTO, PublicBranchListItemDTO } from "@/modules/browse/public-branch.types";
import { NotFoundError } from "@/shared/errors";
import { haversineKm } from "@/shared/geo";

export class PublicBranchService {
  constructor(
    private readonly repo: PublicBranchRepository = new PublicBranchRepository(),
    private readonly salonService: SalonService = new SalonService()
  ) {}

  async search(query: BranchSearchQuery): Promise<PublicBranchListItemDTO[]> {
    const rows = await this.repo.search({
      city: query.city,
      q: query.q,
      serviceCategoryId: query.serviceCategoryId,
      salonId: query.salonId,
    });
    const ratings = await this.repo.getRatingAggregates(rows.map((r) => r.branch.id));

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

    const [services, ratings, gallery] = await Promise.all([
      this.repo.findActiveServicesWithCategory(branchId),
      this.repo.getRatingAggregates([branchId]),
      this.salonService.listGallery(salon.id),
    ]);
    const rating = ratings.get(branchId);

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
    };
  }
}
