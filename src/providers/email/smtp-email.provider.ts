import { EmailProvider, SendEmailInput } from "@/providers/email/email-provider.interface";
import { env } from "@/config/env";
import { logger } from "@/shared/logger";

/**
 * Thin SMTP adapter. Kept dependency-free (no nodemailer) by using a lazy require so the
 * package is optional; add "nodemailer" to package.json if SMTP is enabled in an environment.
 */
export class SmtpEmailProvider implements EmailProvider {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private transporter: any | null = null;

  private getTransporter() {
    if (this.transporter) return this.transporter;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const nodemailer = require("nodemailer");
    this.transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
    return this.transporter!;
  }

  async send(input: SendEmailInput): Promise<{ providerMessageId?: string }> {
    try {
      const info = await this.getTransporter().sendMail({
        from: env.SMTP_FROM,
        to: input.to,
        subject: input.subject,
        text: input.body,
      });
      return { providerMessageId: info?.messageId };
    } catch (err) {
      logger.error({ err, to: input.to }, "SMTP email send failed");
      throw err;
    }
  }
}
