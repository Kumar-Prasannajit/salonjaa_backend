export interface CreatePromotionInput {
  title: string;
  description?: string;
  bannerImageUrl?: string;
  startsAt: string;
  endsAt: string;
  branchIds: string[];
  serviceIds?: string[];
  // Module 22 — docs/NEXT_SESSION_PLAN.md item 3, see src/db/schema/promotion.ts's comment.
  // Defaults false.
  featured?: boolean;
}

export interface UpdatePromotionInput {
  title?: string;
  description?: string;
  bannerImageUrl?: string;
  startsAt?: string;
  endsAt?: string;
  active?: boolean;
  featured?: boolean;
}

export interface PromotionDTO {
  id: string;
  createdByUserId: string;
  title: string;
  description: string | null;
  bannerImageUrl: string | null;
  startsAt: string;
  endsAt: string;
  active: boolean;
  featured: boolean;
  branchIds: string[];
  serviceIds: string[];
  createdAt: string;
}
