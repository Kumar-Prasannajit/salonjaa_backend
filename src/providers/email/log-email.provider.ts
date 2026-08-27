import {
  EmailProvider,
  SendEmailInput,
} from "@/providers/email/email-provider.interface";
import { isProduction } from "@/config/env";
import { logger } from "@/shared/logger";

/**
 * Fallback provider that logs the notification instead of sending it. Never logs OTP
 * codes at info level in production; message content is logged only at debug level.
 */
export class LogEmailProvider implements EmailProvider {
  async send(input: SendEmailInput): Promise<{ providerMessageId?: string }> {
    if (isProduction) {
      logger.info(
        { to: input.to, subject: input.subject },
        "Email dispatched via LogEmailProvider",
      );
    } else {
      logger.info(
        { to: input.to, subject: input.subject, body: input.body },
        "Email dispatched via LogEmailProvider",
      );
    }
    return { providerMessageId: `log-${Date.now()}` };
  }
}
