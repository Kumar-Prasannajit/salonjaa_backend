export interface CreateOrderResult {
  orderId: string;
  amount: number; // major currency unit (rupees), not paise
  currency: string;
}

export interface PaymentProvider {
  createOrder(amountRupees: number, currency: string, receipt: string): Promise<CreateOrderResult>;
  /** Verifies the client-returned order/payment/signature triple (standard Razorpay checkout flow). */
  verifySignature(orderId: string, paymentId: string, signature: string): boolean;
}
