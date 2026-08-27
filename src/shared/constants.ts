export const ROLE_NAMES = {
  CUSTOMER: "CUSTOMER",
  SALON_OWNER: "SALON_OWNER",
  ADMIN: "ADMIN",
} as const;

export type RoleName = (typeof ROLE_NAMES)[keyof typeof ROLE_NAMES];

export const OTP_PURPOSES = {
  LOGIN: "LOGIN",
  REGISTER: "REGISTER",
  VERIFY_EMAIL: "VERIFY_EMAIL",
  BOOKING_CHECKIN: "BOOKING_CHECKIN",
} as const;

export type OtpPurpose = (typeof OTP_PURPOSES)[keyof typeof OTP_PURPOSES];

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
