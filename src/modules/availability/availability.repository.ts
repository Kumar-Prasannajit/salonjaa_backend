import { and, eq, gt, gte, inArray, isNull, lt, lte, sql } from "drizzle-orm";
import { db } from "@/config/database";
import { branches, salons, branchHolidays, branchCapacityRules, branchServices, staff, staffServices, staffLeaves, bookings } from "@/db/schema";
import { CAPACITY_CONSUMING_BOOKING_STATUSES } from "@/shared/constants";

export class AvailabilityRepository {
  /** Public discovery lookup: only an ACTIVE branch under an ACTIVE+VERIFIED salon is bookable. */
  async findBookableBranch(branchId: string) {
    const [row] = await db
      .select({ branch: branches })
      .from(branches)
      .innerJoin(salons, eq(branches.salonId, salons.id))
      .where(
        and(
          eq(branches.id, branchId),
          isNull(branches.deletedAt),
          eq(branches.status, "ACTIVE"),
          isNull(salons.deletedAt),
          eq(salons.status, "ACTIVE"),
          eq(salons.verificationStatus, "VERIFIED")
        )
      )
      .limit(1);
    return row?.branch ?? null;
  }

  async findActiveServices(branchId: string, serviceIds: string[]) {
    return db
      .select()
      .from(branchServices)
      .where(
        and(
          eq(branchServices.branchId, branchId),
          inArray(branchServices.id, serviceIds),
          eq(branchServices.status, "ACTIVE"),
          isNull(branchServices.deletedAt)
        )
      );
  }

  async findHoliday(branchId: string, date: string) {
    const [row] = await db
      .select()
      .from(branchHolidays)
      .where(and(eq(branchHolidays.branchId, branchId), eq(branchHolidays.holidayDate, date)))
      .limit(1);
    return row ?? null;
  }

  async findCapacityOverride(branchId: string) {
    const [row] = await db
      .select()
      .from(branchCapacityRules)
      .where(eq(branchCapacityRules.branchId, branchId))
      .limit(1);
    return row ?? null;
  }

  /** Active staff at this branch assigned to EVERY requested service (not just any one of them). */
  async findEligibleStaff(branchId: string, serviceIds: string[]) {
    const rows = await db
      .select({ staff })
      .from(staff)
      .innerJoin(staffServices, eq(staffServices.staffId, staff.id))
      .where(
        and(
          eq(staff.branchId, branchId),
          eq(staff.status, "ACTIVE"),
          isNull(staff.deletedAt),
          inArray(staffServices.serviceId, serviceIds)
        )
      )
      .groupBy(staff.id)
      .having(sql`count(distinct ${staffServices.serviceId}) = ${serviceIds.length}`);
    return rows.map((r) => r.staff);
  }

  /** APPROVED leaves for these staff that overlap [rangeStart, rangeEnd). */
  async findLeavesInRange(staffIds: string[], rangeStart: Date, rangeEnd: Date) {
    if (staffIds.length === 0) return [];
    return db
      .select({ staffId: staffLeaves.staffId, startDateTime: staffLeaves.startDateTime, endDateTime: staffLeaves.endDateTime })
      .from(staffLeaves)
      .where(
        and(
          inArray(staffLeaves.staffId, staffIds),
          eq(staffLeaves.status, "APPROVED"),
          lt(staffLeaves.startDateTime, rangeEnd),
          gt(staffLeaves.endDateTime, rangeStart)
        )
      );
  }

  /** Staff whose APPROVED leave fully covers [dayStart, dayEnd) — used for the day-level staff listing. */
  async findStaffFullyOnLeave(staffIds: string[], dayStart: Date, dayEnd: Date): Promise<Set<string>> {
    if (staffIds.length === 0) return new Set();
    const rows = await db
      .select({ staffId: staffLeaves.staffId })
      .from(staffLeaves)
      .where(
        and(
          inArray(staffLeaves.staffId, staffIds),
          eq(staffLeaves.status, "APPROVED"),
          lte(staffLeaves.startDateTime, dayStart),
          gte(staffLeaves.endDateTime, dayEnd)
        )
      );
    return new Set(rows.map((r) => r.staffId));
  }

  /** Capacity-consuming bookings (PENDING/APPROVED) for this branch overlapping [rangeStart, rangeEnd). */
  async findBookingsInRange(branchId: string, rangeStart: Date, rangeEnd: Date) {
    return db
      .select({ scheduledStart: bookings.scheduledStart, scheduledEnd: bookings.scheduledEnd })
      .from(bookings)
      .where(
        and(
          eq(bookings.branchId, branchId),
          inArray(bookings.bookingStatus, [...CAPACITY_CONSUMING_BOOKING_STATUSES]),
          lt(bookings.scheduledStart, rangeEnd),
          gt(bookings.scheduledEnd, rangeStart)
        )
      );
  }
}
