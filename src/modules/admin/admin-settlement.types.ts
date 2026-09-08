export interface AdminSettlementDTO {
  id: string;
  salonId: string;
  branchId: string | null;
  periodStart: string;
  periodEnd: string;
  grossAmount: number;
  commissionAmount: number;
  refundAmount: number;
  adjustmentAmount: number;
  netAmount: number;
  status: string;
  settledAt: string | null;
  createdAt: string;
}

export interface CreateSettlementInput {
  salonId: string;
  branchId?: string;
  periodStart: string;
  periodEnd: string;
  grossAmount: number;
  commissionAmount?: number;
  refundAmount?: number;
  adjustmentAmount?: number;
  bookingIds?: string[];
}
