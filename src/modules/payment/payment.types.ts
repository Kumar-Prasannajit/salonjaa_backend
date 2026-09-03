export interface CreateOrderInput {
  bookingId: string;
}

export interface VerifyPaymentInput {
  orderId: string;
  paymentId: string;
  signature: string;
}

export interface RefundRequestInput {
  bookingId: string;
  reason?: string;
}

export interface ValidateCouponInput {
  couponCode: string;
  bookingAmount: number;
}

export interface PaymentDTO {
  id: string;
  bookingId: string;
  customerId: string | null;
  method: string;
  provider: string;
  providerOrderId: string | null;
  providerPaymentId: string | null;
  amount: number;
  currency: string;
  status: string;
  paidAt: string | null;
  createdAt: string;
}

export interface RefundDTO {
  id: string;
  bookingId: string;
  paymentId: string;
  customerId: string | null;
  amount: number;
  reason: string | null;
  status: string;
  processedAt: string | null;
  createdAt: string;
}

export interface SettlementDTO {
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
}
