export interface StrikeDTO {
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

export interface AddStrikeInput {
  customerId: string;
  bookingId?: string;
  type: "FAKE_BOOKING" | "NO_SHOW" | "ABUSIVE_CANCELLATION";
  notes?: string;
}
