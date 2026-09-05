import { Request, Response } from "express";
import { ServiceCategoryService } from "@/modules/browse/service-category.service";

const serviceCategoryService = new ServiceCategoryService();

export class ServiceCategoryController {
  /** GET /service-categories -> bare array, matching the proposal's example and the existing
   *  public-array precedent (GET /availability/slots, GET /availability/staff). */
  async list(_req: Request, res: Response): Promise<void> {
    const categories = await serviceCategoryService.list();
    res.status(200).json(categories);
  }
}
