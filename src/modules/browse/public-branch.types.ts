export interface BranchSearchQuery {
  city?: string;
  q?: string;
  serviceCategoryId?: string;
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
  // Always empty — `salon_gallery_images` doesn't exist yet (deferred in Module 3, still no
  // documented contract). Kept as a field so the frontend's card layout doesn't need a branch
  // when this ships for real later.
  gallery: string[];
  city: string;
  addressLine1: string;
  latitude: number | null;
  longitude: number | null;
  verificationStatus: string;
  averageRating: number | null;
  reviewCount: number;
  openingTime: string;
  closingTime: string;
  services: PublicBranchServiceDTO[];
}
