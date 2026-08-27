import crypto from "node:crypto";

/** SHA-256 hex digest, used for refresh-token-at-rest hashing (fast lookup, not user-guessable input). */
export function sha256Hex(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/** Cryptographically random numeric OTP of the given length, e.g. "483920". */
export function generateNumericOtp(length: number): string {
  const digits = "0123456789";
  let otp = "";
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    otp += digits[bytes[i] % digits.length];
  }
  return otp;
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}
