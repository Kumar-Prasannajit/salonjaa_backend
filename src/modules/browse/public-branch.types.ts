export interface BranchSearchQuery {
  city?: string;
  q?: string;
  serviceCategoryId?: string;
  // Closes docs/COMPETITOR_COMPARISON_LUZO.md's "View Branches" gap — "show this brand's
  // other locations" from the salon detail page.
  salonId?: string;
  lat?: number;
  lng?: number;
  sort?: "distance" | "rating" | "popular";
}

// Field names/shape co-defined with the frontend's proposed contract
// (docs/PROPOSED_PUBLIC_BROWSE_CONTRACT.md in the frontend repo). One deviation, flagged in
// docs/PROGRESS.md: the proposal's `area` field/query param has no backing column anywhere in
// `branches` (only addressLine1/addressLine2/city/state/postalCode exist) — `addressLine1` is
// returned instead of a fabricated `area`.
export interface PublicBranchListItemDTO {
  branchId: string;
  salonId: string;
  salonName: string;
  branchName: string;
  city: string;
  addressLine1: string;
  coverImage: string | null;
  distanceKm: number | null;
  averageRating: number | null;
  reviewCount: number;
}

export interface PublicBranchServiceDTO {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  durationMinutes: number;
  basePrice: number;
  imageUrl: string | null;
}

export interface PublicBranchDetailDTO {
  branchId: string;
  salonId: string;
  salonName: string;
  branchName: string;
  description: string | null;
  coverImage: string | null;
  // Module 16 — image URLs from salon_gallery_images (SalonService.listGallery), ordered by
  // displayOrder. Empty for a salon that hasn't added any yet.
  gallery: string[];
  city: string;
  addressLine1: string;
  latitude: number | null;
  longitude: number | null;
  // Closes docs/COMPETITOR_COMPARISON_LUZO.md's "Contact"/"Call Salon" gap.
  phone: string | null;
  verificationStatus: string;
  averageRating: number | null;
  reviewCount: number;
  openingTime: string;
  closingTime: string;
  services: PublicBranchServiceDTO[];
}
