import { env } from "@/config/env";
import { EmailProvider } from "@/providers/email/email-provider.interface";
import { LogEmailProvider } from "@/providers/email/log-email.provider";
import { SmtpEmailProvider } from "@/providers/email/smtp-email.provider";

export const emailProvider: EmailProvider = env.SMTP_HOST ? new SmtpEmailProvider() : new LogEmailProvider();

export * from "@/providers/email/email-provider.interface";
