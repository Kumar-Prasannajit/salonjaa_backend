export interface OtpProvider {
  /** Deliver a plaintext OTP code to the given destination (email address, phone, etc). */
  deliver(destination: string, code: string, purpose: string): Promise<void>;
}
