import { OtpProvider } from "@/providers/otp/otp-provider.interface";
import { EmailOtpProvider } from "@/providers/otp/email-otp.provider";

export const otpProvider: OtpProvider = new EmailOtpProvider();

export * from "@/providers/otp/otp-provider.interface";
