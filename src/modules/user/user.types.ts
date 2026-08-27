export interface UpdateProfileInput {
  fullName?: string;
  gender?: "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY";
  dob?: string;
}

export interface UserProfileDTO {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  gender: string | null;
  dob: string | null;
  profileImage: string | null;
}
