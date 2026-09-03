import { PaymentProvider } from "@/providers/payment/payment-provider.interface";
import { RazorpayProvider } from "@/providers/payment/razorpay.provider";

export const paymentProvider: PaymentProvider = new RazorpayProvider();

export * from "@/providers/payment/payment-provider.interface";
