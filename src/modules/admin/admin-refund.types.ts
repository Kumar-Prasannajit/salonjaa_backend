export interface ApproveRefundInput {
  notes?: string;
}

export interface RejectRefundInput {
  reason: string;
}

export interface AdminRefundDTO {
  id: string;
  amount: number;
  reason: string | null;
  status: string;
  approvedBy: string | null;
  processedAt: string | null;
  createdAt: string;
  booking: {
    id: string;
    bookingNumber: string;
    scheduledStart: string;
    scheduledEnd: string;
    bookingStatus: string;
    totalAmount: number;
  };
  payment: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    providerPaymentId: string | null;
    paidAt: string | null;
  };
  customer: {
    id: string;
    email: string;
    fullName: string | null;
  } | null;
}
