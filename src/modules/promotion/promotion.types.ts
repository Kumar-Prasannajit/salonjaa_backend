export interface CreatePromotionInput {
  title: string;
  description?: string;
  bannerImageUrl?: string;
  startsAt: string;
  endsAt: string;
  branchIds: string[];
  serviceIds?: string[];
}

export interface UpdatePromotionInput {
  title?: string;
  description?: string;
  bannerImageUrl?: string;
  startsAt?: string;
  endsAt?: string;
  active?: boolean;
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
  branchIds: string[];
  serviceIds: string[];
  createdAt: string;
}
