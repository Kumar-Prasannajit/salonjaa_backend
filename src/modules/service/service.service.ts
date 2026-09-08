import { ServiceRepository } from "@/modules/service/service.repository";
import { CreateServiceInput, ServiceDTO, UpdateServiceInput } from "@/modules/service/service.types";
import { BranchService } from "@/modules/branch/branch.service";
import { StaffService } from "@/modules/staff/staff.service";
import { ConflictError, NotFoundError } from "@/shared/errors";

export class ServiceService {
  constructor(
    private readonly repo: ServiceRepository = new ServiceRepository(),
    private readonly branchService: BranchService = new BranchService(),
    private readonly staffService: StaffService = new StaffService()
  ) {}

  async create(userId: string, input: CreateServiceInput): Promise<ServiceDTO> {
    await this.branchService.assertOwned(userId, input.branchId);
    const row = await this.repo.create(input);
    return this.toDTO(row);
  }

  async list(userId: string, branchId?: string): Promise<ServiceDTO[]> {
    if (branchId) {
      await this.branchService.assertOwned(userId, branchId);
    }
    const rows = await this.repo.listOwned(userId, branchId);
    return rows.map((r) => this.toDTO(r));
  }

  async getOne(userId: string, serviceId: string): Promise<ServiceDTO> {
    const row = await this.assertOwned(userId, serviceId);
    return this.toDTO(row);
  }

  async update(userId: string, serviceId: string, input: UpdateServiceInput): Promise<ServiceDTO> {
    await this.assertOwned(userId, serviceId);
    const updated = await this.repo.update(serviceId, input);
    return this.toDTO(updated);
  }

  async remove(userId: string, serviceId: string): Promise<void> {
    await this.assertOwned(userId, serviceId);
    await this.repo.softDelete(serviceId);
  }

  async assignStaff(userId: string, serviceId: string, staffId: string): Promise<void> {
    const service = await this.assertOwned(userId, serviceId);

    // Ownership of `service`'s branch is already confirmed above; a raw staff lookup plus a
    // same-branch check is enough to prove `staffId` is under an owned branch too, without
    // re-deriving ownership through Staff's own join.
    const staffRow = await this.staffService.findRawById(staffId);
    if (!staffRow || staffRow.branchId !== service.branchId) {
      throw new NotFoundError("Staff not found");
    }

    const existing = await this.repo.findAssignment(staffId, serviceId);
    if (existing) {
      throw new ConflictError("Staff already assigned to this service");
    }

    await this.repo.assignStaff(staffId, serviceId);
  }

  async removeAssignment(userId: string, serviceId: string, staffId: string): Promise<void> {
    await this.assertOwned(userId, serviceId);
    const existing = await this.repo.findAssignment(staffId, serviceId);
    if (!existing) {
      throw new NotFoundError("Assignment not found");
    }
    await this.repo.removeAssignment(staffId, serviceId);
  }

  /** Made public (Module 16) so Promotion can verify a target serviceId belongs to the
   * caller — same precedent as BranchService.assertOwned being made public for Staff/Service. */
  async assertOwned(userId: string, serviceId: string) {
    const row = await this.repo.findById(serviceId);
    if (!row) {
      throw new NotFoundError("Service not found");
    }
    await this.branchService.assertOwned(userId, row.branchId);
    return row;
  }

  private toDTO(service: {
    id: string;
    branchId: string;
    categoryId: string;
    name: string;
    description: string | null;
    durationMinutes: number;
    basePrice: number;
    imageUrl: string | null;
    status: string;
  }): ServiceDTO {
    return {
      id: service.id,
      branchId: service.branchId,
      categoryId: service.categoryId,
      name: service.name,
      description: service.description,
      durationMinutes: service.durationMinutes,
      basePrice: service.basePrice,
      imageUrl: service.imageUrl,
      status: service.status,
    };
  }
}
