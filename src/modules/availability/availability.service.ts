import { AvailabilityRepository } from "@/modules/availability/availability.repository";
import { BranchService } from "@/modules/branch/branch.service";
import { AvailabilityQuery, EligibleStaffDTO, SlotDTO } from "@/modules/availability/availability.types";
import { BadRequestError, NotFoundError } from "@/shared/errors";
import { DEFAULT_SLOT_INTERVAL_MINUTES } from "@/shared/constants";

interface CandidateWindow {
  start: Date;
  end: Date;
  startLabel: string;
  endLabel: string;
}

export class AvailabilityService {
  constructor(
    private readonly repo: AvailabilityRepository = new AvailabilityRepository(),
    private readonly branchService: BranchService = new BranchService()
  ) {}

  async getSlots(query: AvailabilityQuery): Promise<SlotDTO[]> {
    const branch = await this.repo.findBookableBranch(query.branchId);
    if (!branch) {
      throw new NotFoundError("Branch not found");
    }

    const totalDurationMinutes = await this.resolveTotalDuration(query.branchId, query.serviceIds);

    const holiday = await this.repo.findHoliday(query.branchId, query.date);
    if (holiday) {
      return [];
    }

    const eligibleStaff = await this.repo.findEligibleStaff(query.branchId, query.serviceIds);
    const capacityRule = await this.repo.findCapacityOverride(query.branchId);

    const dayStart = this.buildDayBoundary(query.date, branch.openingTime);
    const dayEnd = this.buildDayBoundary(query.date, branch.closingTime);

    const eligibleStaffIds = eligibleStaff.map((s) => s.id);
    const [leaves, dayBookings] = await Promise.all([
      this.repo.findLeavesInRange(eligibleStaffIds, dayStart, dayEnd),
      this.repo.findBookingsInRange(query.branchId, dayStart, dayEnd),
    ]);

    const templates = await this.branchService.findActiveSlotTemplates(query.branchId);
    const candidates = this.buildCandidateWindows(query.date, dayStart, dayEnd, totalDurationMinutes, templates);

    return candidates.map(({ start, end, startLabel, endLabel }) => {
      const staffOnLeave = new Set(
        leaves.filter((l) => l.startDateTime < end && l.endDateTime > start).map((l) => l.staffId)
      );
      const activeStaffCount = eligibleStaff.length - staffOnLeave.size;
      const effectiveCapacity = Math.min(
        branch.totalChairs,
        activeStaffCount,
        capacityRule?.maxCapacityOverride ?? Number.POSITIVE_INFINITY
      );
      const bookedCount = dayBookings.filter((b) => b.scheduledStart < end && b.scheduledEnd > start).length;

      return {
        // Slot IDs are a UI helper only (TRD §8): they encode the start/end time so a later
        // POST /bookings can resolve them without any persisted slot table. Not a DB row.
        slotId: `${startLabel}-${endLabel}`,
        startTime: startLabel,
        endTime: endLabel,
        available: effectiveCapacity > 0 && bookedCount < effectiveCapacity,
      };
    });
  }

  async getEligibleStaff(query: AvailabilityQuery): Promise<EligibleStaffDTO[]> {
    const branch = await this.repo.findBookableBranch(query.branchId);
    if (!branch) {
      throw new NotFoundError("Branch not found");
    }

    await this.resolveTotalDuration(query.branchId, query.serviceIds);

    const holiday = await this.repo.findHoliday(query.branchId, query.date);
    if (holiday) {
      return [];
    }

    const eligibleStaff = await this.repo.findEligibleStaff(query.branchId, query.serviceIds);
    if (eligibleStaff.length === 0) {
      return [];
    }

    // Contract only supplies `date`, not a specific time window (frontend_handover.md), so
    // this is a day-level listing: exclude only staff whose approved leave covers the ENTIRE
    // business-hours window. A staff member partially on leave that day still appears here;
    // the real per-slot conflict is re-checked when a specific slot is chosen (GET
    // /availability/slots) and again inside the booking-creation transaction (Module 6).
    const dayStart = this.buildDayBoundary(query.date, branch.openingTime);
    const dayEnd = this.buildDayBoundary(query.date, branch.closingTime);
    const fullyOnLeave = await this.repo.findStaffFullyOnLeave(
      eligibleStaff.map((s) => s.id),
      dayStart,
      dayEnd
    );

    return eligibleStaff
      .filter((s) => !fullyOnLeave.has(s.id))
      .map((s) => ({ staffId: s.id, name: s.fullName, type: s.staffType }));
  }

  private async resolveTotalDuration(branchId: string, serviceIds: string[]): Promise<number> {
    const services = await this.repo.findActiveServices(branchId, serviceIds);
    if (services.length !== serviceIds.length) {
      throw new BadRequestError("One or more services are invalid, inactive, or not part of this branch");
    }
    return services.reduce((sum, s) => sum + s.durationMinutes, 0);
  }

  private buildDayBoundary(date: string, time: string): Date {
    const [hh, mm] = time.split(":");
    return new Date(`${date}T${hh}:${mm}:00`);
  }

  /**
   * Module 16 — wires in branch_slot_templates (previously deferred since Module 3/5: "no CRUD
   * endpoint anywhere, so slots are generated at a fixed DEFAULT_SLOT_INTERVAL_MINUTES
   * instead"). A branch with one or more active templates now gets its candidate windows
   * generated per-template (each template's own startTime/endTime bounds the walk, its own
   * slotDurationMinutes is the step between candidate starts) instead of one flat walk across
   * the whole day at the fixed interval. A branch with zero active templates — every branch
   * that existed before this module, and any that simply never configures one — keeps the
   * exact original fallback behavior unchanged, so this is purely additive.
   */
  private buildCandidateWindows(
    date: string,
    dayStart: Date,
    dayEnd: Date,
    durationMinutes: number,
    templates: { startTime: string; endTime: string; slotDurationMinutes: number }[]
  ): CandidateWindow[] {
    if (templates.length === 0) {
      return this.walkWindow(dayStart, dayEnd, DEFAULT_SLOT_INTERVAL_MINUTES, durationMinutes);
    }
    return templates.flatMap((t) =>
      this.walkWindow(this.buildDayBoundary(date, t.startTime), this.buildDayBoundary(date, t.endTime), t.slotDurationMinutes, durationMinutes)
    );
  }

  private walkWindow(rangeStart: Date, rangeEnd: Date, intervalMinutes: number, durationMinutes: number): CandidateWindow[] {
    const intervalMs = intervalMinutes * 60_000;
    const durationMs = durationMinutes * 60_000;
    const candidates: CandidateWindow[] = [];

    for (let startMs = rangeStart.getTime(); startMs + durationMs <= rangeEnd.getTime(); startMs += intervalMs) {
      const start = new Date(startMs);
      const end = new Date(startMs + durationMs);
      candidates.push({ start, end, startLabel: this.formatTime(start), endLabel: this.formatTime(end) });
    }
    return candidates;
  }

  private formatTime(d: Date): string {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }
}
