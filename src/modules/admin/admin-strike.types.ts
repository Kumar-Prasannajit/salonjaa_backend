export interface AdminStrikeDTO {
  id: string;
  customerId: string;
  bookingId: string | null;
  type: string;
  notes: string | null;
  removedAt: string | null;
  removedBy: string | null;
  removalReason: string | null;
  createdAt: string;
}

export interface CustomerStrikeSummary {
  customerId: string;
  activeNoShowCount: number;
  advancePaymentRequired: boolean;
  strikes: AdminStrikeDTO[];
}
