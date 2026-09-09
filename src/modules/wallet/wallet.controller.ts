import { Request, Response } from "express";
import { WalletService } from "@/modules/wallet/wallet.service";

const walletService = new WalletService();

export class WalletController {
  async getBalance(req: Request, res: Response): Promise<void> {
    const wallet = await walletService.getBalance(req.user!.id);
    res.status(200).json({ success: true, data: wallet });
  }

  async listTransactions(req: Request, res: Response): Promise<void> {
    const rows = await walletService.listTransactions(req.user!.id);
    res.status(200).json({ success: true, data: rows });
  }
}
