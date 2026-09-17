export interface CreateBranchInput {
  salonId: string;
  name: string;
  phone?: string;
  email?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  latitude?: number;
  longitude?: number;
  totalChairs: number;
  openingTime: string;
  closingTime: string;
  // Module 21 — optional, defaults to UNISEX at the DB level when omitted.
  genderServed?: "UNISEX" | "MEN" | "WOMEN" | "KIDS";
}

export type UpdateBranchInput = Partial<Omit<CreateBranchInput, "salonId">>;

export interface BranchDTO {
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
}

export interface CreateHolidayInput {
  date: string;
  reason?: string;
}

export interface HolidayDTO {
  id: string;
  date: string;
  reason: string | null;
}

export interface CapacityRuleInput {
  maxCapacityOverride: number;
}

export interface CapacityRuleDTO {
  branchId: string;
  maxCapacityOverride: number | null;
}

export interface SlotTemplateInput {
  name: string;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
}

export interface UpdateSlotTemplateInput extends Partial<SlotTemplateInput> {
  active?: boolean;
}

export interface SlotTemplateDTO {
  id: string;
  branchId: string;
  name: string;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  active: boolean;
}
