import { Request, Response } from "express";
import { SalonService } from "@/modules/salon/salon.service";
import { sendCreated, sendNoContent, sendSuccess } from "@/shared/response";

const salonService = new SalonService();

export class SalonController {
  async create(req: Request, res: Response): Promise<void> {
    const salon = await salonService.createSalon(req.user!.id, req.body);
    sendCreated(res, salon, "Salon submitted for Admin review");
  }

  /** GET /salons -> [{ id, name }] exactly per frontend_handover.md */
  async list(req: Request, res: Response): Promise<void> {
    const salons = await salonService.listMySalons(req.user!.id);
    res.status(200).json(salons);
  }

  async getOne(req: Request, res: Response): Promise<void> {
    const salon = await salonService.getMySalon(req.user!.id, req.params.salonId);
    sendSuccess(res, salon);
  }

  async update(req: Request, res: Response): Promise<void> {
    const salon = await salonService.updateMySalon(req.user!.id, req.params.salonId, req.body);
    sendSuccess(res, salon);
  }

  async remove(req: Request, res: Response): Promise<void> {
    await salonService.deleteMySalon(req.user!.id, req.params.salonId);
    sendNoContent(res);
  }

  // ---- Module 16: gallery ----

  async listGallery(req: Request, res: Response): Promise<void> {
    const images = await salonService.listGallery(req.params.salonId);
    sendSuccess(res, images);
  }

  async addGalleryImage(req: Request, res: Response): Promise<void> {
    const image = await salonService.addGalleryImage(req.user!.id, req.params.salonId, req.body);
    sendCreated(res, image);
  }

  async removeGalleryImage(req: Request, res: Response): Promise<void> {
    await salonService.removeGalleryImage(req.user!.id, req.params.salonId, req.params.imageId);
    sendNoContent(res);
  }
}
