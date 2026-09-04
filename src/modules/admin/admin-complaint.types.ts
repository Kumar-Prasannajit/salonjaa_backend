export interface ResolveComplaintInput {
  resolutionNotes: string;
}

export interface RejectComplaintInput {
  reason: string;
}

export interface AdminComplaintDTO {
  id: string;
  type: string;
  referenceId: string | null;
  description: string;
  status: string;
  resolutionNotes: string | null;
  resolvedAt: string | null;
  createdAt: string;
  filedBy: {
    id: string;
    email: string;
    fullName: string | null;
  };
  linkedBooking?: { id: string; bookingNumber: string; bookingStatus: string } | null;
  linkedPayment?: { id: string; amount: number; status: string } | null;
}
