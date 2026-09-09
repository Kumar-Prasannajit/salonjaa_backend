import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/config/database";
import { branches, branchHolidays, branchCapacityRules, branchSlotTemplates, salons, salonOwnerProfiles } from "@/db/schema";
import { CreateBranchInput, UpdateBranchInput, SlotTemplateInput } from "@/modules/branch/branch.types";

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
        genderServed: input.genderServed,
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

  // ---- Module 16: slot templates ----

  async listSlotTemplates(branchId: string) {
    return db.select().from(branchSlotTemplates).where(eq(branchSlotTemplates.branchId, branchId));
  }

  async listActiveSlotTemplates(branchId: string) {
    return db
      .select()
      .from(branchSlotTemplates)
      .where(and(eq(branchSlotTemplates.branchId, branchId), eq(branchSlotTemplates.active, true)));
  }

  async createSlotTemplate(branchId: string, input: SlotTemplateInput) {
    const [row] = await db
      .insert(branchSlotTemplates)
      .values({
        branchId,
        name: input.name,
        startTime: input.startTime,
        endTime: input.endTime,
        slotDurationMinutes: input.slotDurationMinutes,
      })
      .returning();
    return row;
  }

  async findSlotTemplate(branchId: string, templateId: string) {
    const [row] = await db
      .select()
      .from(branchSlotTemplates)
      .where(and(eq(branchSlotTemplates.id, templateId), eq(branchSlotTemplates.branchId, branchId)))
      .limit(1);
    return row ?? null;
  }

  async updateSlotTemplate(templateId: string, input: Partial<SlotTemplateInput> & { active?: boolean }) {
    const [row] = await db
      .update(branchSlotTemplates)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(branchSlotTemplates.id, templateId))
      .returning();
    return row ?? null;
  }

  async deleteSlotTemplate(templateId: string): Promise<void> {
    await db.delete(branchSlotTemplates).where(eq(branchSlotTemplates.id, templateId));
  }
}
