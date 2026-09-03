import Razorpay from "razorpay";
import crypto from "node:crypto";
import { env } from "@/config/env";
import { CreateOrderResult, PaymentProvider } from "@/providers/payment/payment-provider.interface";
import { InternalServerError } from "@/shared/errors";

export class RazorpayProvider implements PaymentProvider {
  private getClient(): Razorpay {
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
      throw new InternalServerError("Razorpay is not configured — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET");
    }
    return new Razorpay({ key_id: env.RAZORPAY_KEY_ID, key_secret: env.RAZORPAY_KEY_SECRET });
  }

  async createOrder(amountRupees: number, currency: string, receipt: string): Promise<CreateOrderResult> {
    // Razorpay's receipt field caps at 40 chars — receipt is expected to be a bare booking ID
    // (36-char UUID), well within that.
    const order = await this.getClient().orders.create({
      amount: Math.round(amountRupees * 100), // Razorpay expects paise, not rupees
      currency,
      receipt,
    });
    return { orderId: order.id, amount: amountRupees, currency };
  }

  verifySignature(orderId: string, paymentId: string, signature: string): boolean {
    if (!env.RAZORPAY_KEY_SECRET) {
      throw new InternalServerError("Razorpay is not configured — set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET");
    }
    const expected = crypto
      .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");
    // Constant-time comparison — signature is attacker-controlled input.
    const expectedBuf = Buffer.from(expected, "hex");
    const actualBuf = Buffer.from(signature, "hex");
    if (expectedBuf.length !== actualBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, actualBuf);
  }
}
