export interface AvailabilityQuery {
  branchId: string;
  date: string; // YYYY-MM-DD
  serviceIds: string[];
}

export interface SlotDTO {
  slotId: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  available: boolean;
}

export interface EligibleStaffDTO {
  staffId: string;
  name: string;
  type: string;
}
