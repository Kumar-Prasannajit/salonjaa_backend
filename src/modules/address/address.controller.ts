import { Request, Response } from "express";
import { AddressService } from "@/modules/address/address.service";
import { sendCreated, sendNoContent, sendSuccess } from "@/shared/response";

const addressService = new AddressService();

export class AddressController {
  async list(req: Request, res: Response): Promise<void> {
    const addresses = await addressService.list(req.user!.id);
    sendSuccess(res, addresses);
  }

  async create(req: Request, res: Response): Promise<void> {
    const address = await addressService.create(req.user!.id, req.body);
    sendCreated(res, address);
  }

  async update(req: Request, res: Response): Promise<void> {
    const address = await addressService.update(req.user!.id, req.params.id, req.body);
    sendSuccess(res, address);
  }

  async remove(req: Request, res: Response): Promise<void> {
    await addressService.remove(req.user!.id, req.params.id);
    sendNoContent(res);
  }
}
