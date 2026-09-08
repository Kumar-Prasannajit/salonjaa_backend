export interface AdminCouponDTO {
  id: string;
  couponCode: string;
  type: string;
  value: number;
  minimumAmount: number | null;
  maxDiscount: number | null;
  usageLimit: number | null;
  usedCount: number;
  startsAt: string | null;
  expiresAt: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCouponInput {
  couponCode: string;
  type: "FIXED" | "PERCENTAGE";
  value: number;
  minimumAmount?: number;
  maxDiscount?: number;
  usageLimit?: number;
  startsAt?: string;
  expiresAt?: string;
}

export interface UpdateCouponInput {
  type?: "FIXED" | "PERCENTAGE";
  value?: number;
  minimumAmount?: number;
  maxDiscount?: number;
  usageLimit?: number;
  startsAt?: string;
  expiresAt?: string;
  active?: boolean;
}
