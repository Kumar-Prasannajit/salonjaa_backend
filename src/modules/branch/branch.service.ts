import { BranchRepository } from "@/modules/branch/branch.repository";
import {
  BranchDTO,
  CapacityRuleDTO,
  CreateBranchInput,
  CreateHolidayInput,
  HolidayDTO,
  SlotTemplateDTO,
  SlotTemplateInput,
  UpdateBranchInput,
  UpdateSlotTemplateInput,
} from "@/modules/branch/branch.types";
import { SalonService } from "@/modules/salon/salon.service";
import { NotFoundError, BadRequestError } from "@/shared/errors";

export class BranchService {
  constructor(
    private readonly repo: BranchRepository = new BranchRepository(),
    private readonly salonService: SalonService = new SalonService()
  ) {}

  async create(userId: string, input: CreateBranchInput): Promise<BranchDTO> {
    // Verify the target salon belongs to this owner before creating a branch under it.
    await this.salonService.assertOwned(userId, input.salonId);
    const branch = await this.repo.create(input);
    return this.toDTO(branch);
  }

  async list(userId: string, salonId?: string): Promise<BranchDTO[]> {
    if (salonId) {
      await this.salonService.assertOwned(userId, salonId);
    }
    const branches = await this.repo.listOwnedBranches(userId, salonId);
    return branches.map((b) => this.toDTO(b));
  }

  async getOne(userId: string, branchId: string): Promise<BranchDTO> {
    const branch = await this.assertOwned(userId, branchId);
    return this.toDTO(branch);
  }

  async update(userId: string, branchId: string, input: UpdateBranchInput): Promise<BranchDTO> {
    await this.assertOwned(userId, branchId);
    const updated = await this.repo.update(branchId, input);
    return this.toDTO(updated);
  }

  async listHolidays(userId: string, branchId: string): Promise<HolidayDTO[]> {
    await this.assertOwned(userId, branchId);
    const holidays = await this.repo.listHolidays(branchId);
    return holidays.map((h) => ({ id: h.id, date: h.holidayDate, reason: h.reason }));
  }

  async createHoliday(userId: string, branchId: string, input: CreateHolidayInput): Promise<HolidayDTO> {
    await this.assertOwned(userId, branchId);
    const holiday = await this.repo.createHoliday(branchId, input.date, input.reason, userId);
    return { id: holiday.id, date: holiday.holidayDate, reason: holiday.reason };
  }

  async deleteHoliday(userId: string, branchId: string, holidayId: string): Promise<void> {
    await this.assertOwned(userId, branchId);
    const holiday = await this.repo.findHoliday(branchId, holidayId);
    if (!holiday) {
      throw new NotFoundError("Holiday not found");
    }
    await this.repo.deleteHoliday(holidayId);
  }

  async setCapacityRule(userId: string, branchId: string, maxCapacityOverride: number): Promise<CapacityRuleDTO> {
    await this.assertOwned(userId, branchId);
    const rule = await this.repo.upsertCapacityRule(branchId, maxCapacityOverride);
    return { branchId: rule.branchId, maxCapacityOverride: rule.maxCapacityOverride };
  }

  // ---- Module 16: slot templates ----

  async listSlotTemplates(userId: string, branchId: string): Promise<SlotTemplateDTO[]> {
    await this.assertOwned(userId, branchId);
    const rows = await this.repo.listSlotTemplates(branchId);
    return rows.map((r) => this.toSlotTemplateDTO(r));
  }

  async createSlotTemplate(userId: string, branchId: string, input: SlotTemplateInput): Promise<SlotTemplateDTO> {
    await this.assertOwned(userId, branchId);
    this.assertValidTemplateRange(input.startTime, input.endTime, input.slotDurationMinutes);
    const row = await this.repo.createSlotTemplate(branchId, input);
    return this.toSlotTemplateDTO(row);
  }

  async updateSlotTemplate(userId: string, branchId: string, templateId: string, input: UpdateSlotTemplateInput): Promise<SlotTemplateDTO> {
    await this.assertOwned(userId, branchId);
    const existing = await this.repo.findSlotTemplate(branchId, templateId);
    if (!existing) {
      throw new NotFoundError("Slot template not found");
    }
    if (input.startTime || input.endTime || input.slotDurationMinutes) {
      this.assertValidTemplateRange(
        input.startTime ?? existing.startTime,
        input.endTime ?? existing.endTime,
        input.slotDurationMinutes ?? existing.slotDurationMinutes
      );
    }
    const updated = await this.repo.updateSlotTemplate(templateId, input);
    return this.toSlotTemplateDTO(updated!);
  }

  async deleteSlotTemplate(userId: string, branchId: string, templateId: string): Promise<void> {
    await this.assertOwned(userId, branchId);
    const existing = await this.repo.findSlotTemplate(branchId, templateId);
    if (!existing) {
      throw new NotFoundError("Slot template not found");
    }
    await this.repo.deleteSlotTemplate(templateId);
  }

  /** Used by Availability to generate slots from active templates instead of the fixed
   * DEFAULT_SLOT_INTERVAL_MINUTES fallback, when a branch has any. */
  async findActiveSlotTemplates(branchId: string) {
    return this.repo.listActiveSlotTemplates(branchId);
  }

  /** TRD: "start < end, duration > 0." */
  private assertValidTemplateRange(startTime: string, endTime: string, slotDurationMinutes: number): void {
    if (startTime >= endTime) {
      throw new BadRequestError("startTime must be before endTime");
    }
    if (slotDurationMinutes <= 0) {
      throw new BadRequestError("slotDurationMinutes must be positive");
    }
  }

  private toSlotTemplateDTO(row: {
    id: string;
    branchId: string;
    name: string;
    startTime: string;
    endTime: string;
    slotDurationMinutes: number;
    active: boolean;
  }): SlotTemplateDTO {
    return {
      id: row.id,
      branchId: row.branchId,
      name: row.name,
      startTime: row.startTime,
      endTime: row.endTime,
      slotDurationMinutes: row.slotDurationMinutes,
      active: row.active,
    };
  }

  /** Used by other modules (Staff, Service) to verify branch ownership before mutating child resources. */
  async assertOwned(userId: string, branchId: string) {
    const branch = await this.repo.findOwnedBranch(userId, branchId);
    if (!branch) {
      throw new NotFoundError("Branch not found");
    }
    return branch;
  }

  private toDTO(branch: {
    id: string;
    salonId: string;
    name: string;
    phone: string | null;
    email: string | null;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    postalCode: string;
    latitude: number | null;
    longitude: number | null;
    totalChairs: number;
    openingTime: string;
    closingTime: string;
    status: string;
    genderServed: string;
  }): BranchDTO {
    return {
      id: branch.id,
      salonId: branch.salonId,
      name: branch.name,
      phone: branch.phone,
      email: branch.email,
      addressLine1: branch.addressLine1,
      addressLine2: branch.addressLine2,
      city: branch.city,
      state: branch.state,
      postalCode: branch.postalCode,
      latitude: branch.latitude,
      longitude: branch.longitude,
      totalChairs: branch.totalChairs,
      openingTime: branch.openingTime,
      closingTime: branch.closingTime,
      status: branch.status,
      genderServed: branch.genderServed,
    };
  }
}
