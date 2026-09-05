import { ServiceCategoryRepository } from "@/modules/browse/service-category.repository";
import { ServiceCategoryDTO } from "@/modules/browse/service-category.types";

export class ServiceCategoryService {
  constructor(private readonly repo: ServiceCategoryRepository = new ServiceCategoryRepository()) {}

  async list(): Promise<ServiceCategoryDTO[]> {
    return this.repo.listActive();
  }
}
