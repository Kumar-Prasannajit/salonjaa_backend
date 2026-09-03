import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/config/database";
import { staff, staffLeaves, branches, salons, salonOwnerProfiles } from "@/db/schema";
import { CreateStaffInput, UpdateStaffInput } from "@/modules/staff/staff.types";

export class StaffRepository {
  async create(input: CreateStaffInput) {
    const [row] = await db
      .insert(staff)
      .values({
        branchId: input.branchId,
        fullName: input.fullName,
        phone: input.phone,
        staffType: input.staffType,
        experienceYears: input.experienceYears,
        salary: input.salary,
      })
      .returning();
    return row;
  }

  /** Raw lookup by id (non-deleted), no ownership check — caller verifies branch ownership. */
  async findById(staffId: string) {
    const [row] = await db
      .select()
      .from(staff)
      .where(and(eq(staff.id, staffId), isNull(staff.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  async listByBranch(branchId: string) {
    return db
      .select()
      .from(staff)
      .where(and(eq(staff.branchId, branchId), isNull(staff.deletedAt)));
  }

  /** Lists staff across every branch owned (transitively) by this user, optionally filtered to one branch. */
  async listOwned(userId: string, branchId?: string) {
    const conditions = [
      eq(salonOwnerProfiles.userId, userId),
      isNull(salonOwnerProfiles.deletedAt),
      isNull(salons.deletedAt),
      isNull(branches.deletedAt),
      isNull(staff.deletedAt),
    ];
    if (branchId) conditions.push(eq(staff.branchId, branchId));

    const rows = await db
      .select({ staff })
      .from(staff)
      .innerJoin(branches, eq(staff.branchId, branches.id))
      .innerJoin(salons, eq(branches.salonId, salons.id))
      .innerJoin(salonOwnerProfiles, eq(salons.ownerProfileId, salonOwnerProfiles.id))
      .where(and(...conditions));
    return rows.map((r) => r.staff);
  }

  async update(staffId: string, input: UpdateStaffInput) {
    const [row] = await db
      .update(staff)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(staff.id, staffId))
      .returning();
    return row;
  }

  async softDelete(staffId: string) {
    await db.update(staff).set({ deletedAt: new Date() }).where(eq(staff.id, staffId));
  }

  // ---- Leaves ----

  async createLeave(staffId: string, startDateTime: string, endDateTime: string, reason?: string) {
    const [row] = await db
      .insert(staffLeaves)
      .values({ staffId, startDateTime: new Date(startDateTime), endDateTime: new Date(endDateTime), reason })
      .returning();
    return row;
  }

  async findLeave(staffId: string, leaveId: string) {
    const [row] = await db
      .select()
      .from(staffLeaves)
      .where(and(eq(staffLeaves.id, leaveId), eq(staffLeaves.staffId, staffId)))
      .limit(1);
    return row ?? null;
  }

  async cancelLeave(leaveId: string) {
    await db.update(staffLeaves).set({ status: "CANCELLED" }).where(eq(staffLeaves.id, leaveId));
  }
}
