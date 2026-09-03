export interface CreateStaffInput {
  branchId: string;
  fullName: string;
  phone?: string;
  staffType: "NORMAL" | "STAR";
  experienceYears?: number;
  salary?: number;
}

export interface UpdateStaffInput {
  fullName?: string;
  phone?: string;
  staffType?: "NORMAL" | "STAR";
  experienceYears?: number;
  salary?: number;
  profileImage?: string;
  gender?: "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY";
  joiningDate?: string;
  bio?: string;
  consultationFee?: number;
}

export interface StaffDTO {
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
}

export interface CreateLeaveInput {
  startDateTime: string;
  endDateTime: string;
  reason?: string;
}

export interface LeaveDTO {
  id: string;
  staffId: string;
  startDateTime: string;
  endDateTime: string;
  reason: string | null;
  status: string;
}
