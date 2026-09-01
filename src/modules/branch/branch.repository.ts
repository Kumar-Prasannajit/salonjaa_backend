import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/config/database";
import { branches, branchHolidays, branchCapacityRules, salons, salonOwnerProfiles } from "@/db/schema";
import { CreateBranchInput, UpdateBranchInput } from "@/modules/branch/branch.types";

export class BranchRepository {
  /** Verifies the branch's parent salon belongs to the given owner-profile user. */
  async findOwnedBranch(userId: string, branchId: string) {
    const [row] = await db
      .select({ branch: branches })
      .from(branches)
      .innerJoin(salons, eq(branches.salonId, salons.id))
      .innerJoin(salonOwnerProfiles, eq(salons.ownerProfileId, salonOwnerProfiles.id))
      .where(
        and(
          eq(branches.id, branchId),
          eq(salonOwnerProfiles.userId, userId),
          isNull(salonOwnerProfiles.deletedAt),
          isNull(salons.deletedAt),
          isNull(branches.deletedAt)
        )
      )
      .limit(1);
    return row?.branch ?? null;
  }

  async listOwnedBranches(userId: string, salonId?: string) {
    const conditions = [
      eq(salonOwnerProfiles.userId, userId),
      isNull(salonOwnerProfiles.deletedAt),
      isNull(salons.deletedAt),
      isNull(branches.deletedAt),
    ];
    if (salonId) conditions.push(eq(branches.salonId, salonId));

    const rows = await db
      .select({ branch: branches })
      .from(branches)
      .innerJoin(salons, eq(branches.salonId, salons.id))
      .innerJoin(salonOwnerProfiles, eq(salons.ownerProfileId, salonOwnerProfiles.id))
      .where(and(...conditions));
    return rows.map((r) => r.branch);
  }

  async create(input: CreateBranchInput) {
    const [branch] = await db
      .insert(branches)
      .values({
        salonId: input.salonId,
        name: input.name,
        phone: input.phone,
        email: input.email,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2,
        city: input.city,
        state: input.state,
        postalCode: input.postalCode,
        latitude: input.latitude,
        longitude: input.longitude,
        totalChairs: input.totalChairs,
        openingTime: input.openingTime,
        closingTime: input.closingTime,
      })
      .returning();
    return branch;
  }

  async update(branchId: string, input: UpdateBranchInput) {
    const [branch] = await db
      .update(branches)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(branches.id, branchId))
      .returning();
    return branch;
  }

  // ---- Holidays ----

  async listHolidays(branchId: string) {
    return db.select().from(branchHolidays).where(eq(branchHolidays.branchId, branchId));
  }

  async createHoliday(branchId: string, date: string, reason: string | undefined, createdBy: string) {
    const [holiday] = await db
      .insert(branchHolidays)
      .values({ branchId, holidayDate: date, reason, createdBy })
      .returning();
    return holiday;
  }

  async findHoliday(branchId: string, holidayId: string) {
    const [holiday] = await db
      .select()
      .from(branchHolidays)
      .where(and(eq(branchHolidays.id, holidayId), eq(branchHolidays.branchId, branchId)))
      .limit(1);
    return holiday ?? null;
  }

  async deleteHoliday(holidayId: string) {
    await db.delete(branchHolidays).where(eq(branchHolidays.id, holidayId));
  }

  // ---- Capacity rule ----

  async upsertCapacityRule(branchId: string, maxCapacityOverride: number) {
    const [existing] = await db
      .select()
      .from(branchCapacityRules)
      .where(eq(branchCapacityRules.branchId, branchId))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(branchCapacityRules)
        .set({ maxCapacityOverride, updatedAt: new Date() })
        .where(eq(branchCapacityRules.branchId, branchId))
        .returning();
      return updated;
    }

    const [created] = await db.insert(branchCapacityRules).values({ branchId, maxCapacityOverride }).returning();
    return created;
  }
}
