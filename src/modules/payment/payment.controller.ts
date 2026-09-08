import { Request, Response } from "express";
import { PaymentService } from "@/modules/payment/payment.service";

const paymentService = new PaymentService();

export class PaymentController {
  /** POST /payments/create-order -> { orderId, amount, currency } exactly per frontend_handover.md */
  async createOrder(req: Request, res: Response): Promise<void> {
    const result = await paymentService.createOrder(req.user!.id, req.body);
    res.status(201).json(result);
  }

  /** POST /payments/verify -> { success, paymentStatus } exactly per frontend_handover.md */
  async verify(req: Request, res: Response): Promise<void> {
    const result = await paymentService.verifyPayment(req.user!.id, req.body);
    res.status(200).json(result);
  }

  /** POST /payments/:paymentId/cancel -> default envelope (new endpoint, not pinned by an
   *  existing literal contract, so CONVENTIONS.md's default applies). */
  async cancel(req: Request, res: Response): Promise<void> {
    const payment = await paymentService.cancelPendingPayment(req.user!.id, req.params.paymentId);
    res.status(200).json({ success: true, data: payment });
  }

  async getDetail(req: Request, res: Response): Promise<void> {
    const payment = await paymentService.getDetail(req.user!.id, req.user!.roles, req.params.paymentId);
    res.status(200).json({ success: true, data: payment });
  }

  async myPayments(req: Request, res: Response): Promise<void> {
    const rows = await paymentService.listMyPayments(req.user!.id);
    res.status(200).json({ success: true, data: rows });
  }

  async requestRefund(req: Request, res: Response): Promise<void> {
    const refund = await paymentService.requestRefund(req.user!.id, req.body);
    res.status(201).json({ success: true, data: refund });
  }

  async myRefunds(req: Request, res: Response): Promise<void> {
    const rows = await paymentService.listMyRefunds(req.user!.id);
    res.status(200).json({ success: true, data: rows });
  }

  async salonSettlements(req: Request, res: Response): Promise<void> {
    const rows = await paymentService.listSalonSettlements(req.user!.id);
    res.status(200).json({ success: true, data: rows });
  }

  /** POST /payments/coupons/validate -> { valid, discount } exactly per frontend_handover.md */
  async validateCoupon(req: Request, res: Response): Promise<void> {
    const result = await paymentService.validateCoupon(req.body, req.user!.id);
    res.status(200).json(result);
  }
}
