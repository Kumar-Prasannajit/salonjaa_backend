import { StaffRepository } from "@/modules/staff/staff.repository";
import { CreateLeaveInput, CreateStaffInput, LeaveDTO, StaffDTO, UpdateStaffInput } from "@/modules/staff/staff.types";
import { BranchService } from "@/modules/branch/branch.service";
import { NotFoundError } from "@/shared/errors";

export class StaffService {
  constructor(
    private readonly repo: StaffRepository = new StaffRepository(),
    private readonly branchService: BranchService = new BranchService()
  ) {}

  async create(userId: string, input: CreateStaffInput): Promise<StaffDTO> {
    await this.branchService.assertOwned(userId, input.branchId);
    const row = await this.repo.create(input);
    return this.toDTO(row);
  }

  async list(userId: string, branchId?: string): Promise<StaffDTO[]> {
    if (branchId) {
      await this.branchService.assertOwned(userId, branchId);
    }
    const rows = await this.repo.listOwned(userId, branchId);
    return rows.map((r) => this.toDTO(r));
  }

  async getOne(userId: string, staffId: string): Promise<StaffDTO> {
    const row = await this.assertOwned(userId, staffId);
    return this.toDTO(row);
  }

  async update(userId: string, staffId: string, input: UpdateStaffInput): Promise<StaffDTO> {
    await this.assertOwned(userId, staffId);
    const updated = await this.repo.update(staffId, input);
    return this.toDTO(updated);
  }

  async remove(userId: string, staffId: string): Promise<void> {
    await this.assertOwned(userId, staffId);
    await this.repo.softDelete(staffId);
  }

  async createLeave(userId: string, staffId: string, input: CreateLeaveInput): Promise<LeaveDTO> {
    await this.assertOwned(userId, staffId);
    const leave = await this.repo.createLeave(staffId, input.startDateTime, input.endDateTime, input.reason);
    return this.toLeaveDTO(leave);
  }

  async cancelLeave(userId: string, staffId: string, leaveId: string): Promise<void> {
    await this.assertOwned(userId, staffId);
    const leave = await this.repo.findLeave(staffId, leaveId);
    if (!leave) {
      throw new NotFoundError("Leave not found");
    }
    await this.repo.cancelLeave(leaveId);
  }

  /**
   * Raw lookup with no ownership check, for cross-module use (e.g. Service module verifying
   * a staffId belongs to the same branch as a service it already confirmed is owned).
   */
  async findRawById(staffId: string) {
    return this.repo.findById(staffId);
  }

  private async assertOwned(userId: string, staffId: string) {
    const row = await this.repo.findById(staffId);
    if (!row) {
      throw new NotFoundError("Staff not found");
    }
    await this.branchService.assertOwned(userId, row.branchId);
    return row;
  }

  private toDTO(staff: {
    id: string;
    branchId: string;
    fullName: string;
    phone: string | null;
    profileImage: string | null;
    gender: string | null;
    joiningDate: string | null;
    experienceYears: number | null;
    bio: string | null;
    staffType: string;
    consultationFee: number | null;
    salary: number | null;
    status: string;
  }): StaffDTO {
    return {
      id: staff.id,
      branchId: staff.branchId,
      fullName: staff.fullName,
      phone: staff.phone,
      profileImage: staff.profileImage,
      gender: staff.gender,
      joiningDate: staff.joiningDate,
      experienceYears: staff.experienceYears,
      bio: staff.bio,
      staffType: staff.staffType,
      consultationFee: staff.consultationFee,
      salary: staff.salary,
      status: staff.status,
    };
  }

  private toLeaveDTO(leave: {
    id: string;
    staffId: string;
    startDateTime: Date;
    endDateTime: Date;
    reason: string | null;
    status: string;
  }): LeaveDTO {
    return {
      id: leave.id,
      staffId: leave.staffId,
      startDateTime: leave.startDateTime.toISOString(),
      endDateTime: leave.endDateTime.toISOString(),
      reason: leave.reason,
      status: leave.status,
    };
  }
}
