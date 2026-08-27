export interface SendOtpInput {
  email: string;
}

export interface VerifyOtpInput {
  email: string;
  otp: string;
}

export interface RefreshTokenInput {
  refreshToken: string;
}

export interface AuthUserDTO {
  id: string;
  email: string;
  fullName: string | null;
  roles: string[];
}

export interface VerifyOtpResult {
  accessToken: string;
  refreshToken: string;
  user: AuthUserDTO;
}

export interface RefreshTokenResult {
  accessToken: string;
}
