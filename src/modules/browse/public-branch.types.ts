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
  // Module 21 — docs/NEXT_SESSION_PLAN.md item 2. null when the branch has no active services
  // to average (nothing to bucket). genderServed always has a value (DB default UNISEX).
  priceTier: "₹" | "₹₹" | "₹₹₹" | null;
  genderServed: string;
  // Module 22 — docs/NEXT_SESSION_PLAN.md item 3. Only a currently-active, in-range,
  // owner-`featured` promotion targeting this branch is ever surfaced here; null otherwise
  // (a branch with active-but-not-featured promotions still shows no banner — see
  // PromotionRepository.findFeaturedActiveByBranchIds).
  activePromotion: { title: string; bannerImageUrl: string | null } | null;
}

export interface PublicBranchServiceDTO {
  id: string;
  categoryId: string;
  categoryName: string;
  name: string;
  durationMinutes: number;
  basePrice: number;
  imageUrl: string | null;
  // Module 22 — docs/NEXT_SESSION_PLAN.md item 1. Empty array for a service with no variants
  // (book it directly with basePrice, as before). Non-empty means variant selection is
  // REQUIRED — POST /bookings' services entry for this serviceId must carry a variantId from
  // this list (see docs/frontend_handover.md's service-variants section for the full contract).
  variants: PublicServiceVariantDTO[];
}

export interface PublicServiceVariantDTO {
  id: string;
  name: string;
  price: number;
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
  // Module 21 — same fields/semantics as the listing card (PublicBranchListItemDTO above).
  priceTier: "₹" | "₹₹" | "₹₹₹" | null;
  genderServed: string;
}
