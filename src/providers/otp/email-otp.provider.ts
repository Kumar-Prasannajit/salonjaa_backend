import { eq } from "drizzle-orm";
import { OtpProvider } from "@/providers/otp/otp-provider.interface";
import { emailProvider } from "@/providers/email";
import { db } from "@/config/database";
import { notifications } from "@/db/schema";
import { logger } from "@/shared/logger";

const OTP_SUBJECT: Record<string, string> = {
  LOGIN: "Your Salonjaa login code",
  REGISTER: "Your Salonjaa verification code",
  VERIFY_EMAIL: "Verify your Salonjaa email",
  BOOKING_CHECKIN: "Your Salonjaa booking check-in code",
};

export class EmailOtpProvider implements OtpProvider {
  async deliver(destination: string, code: string, purpose: string): Promise<void> {
    const subject = OTP_SUBJECT[purpose] ?? "Your Salonjaa verification code";
    const body = `Your Salonjaa verification code is ${code}. It expires shortly. Do not share this code with anyone.`;

    // Persist the notification record before enqueueing/sending delivery.
    const [record] = await db
      .insert(notifications)
      .values({
        userId: null,
        type: "EMAIL",
        eventType: `OTP_${purpose}`,
        subject,
        message: body,
        status: "PENDING",
      })
      .returning();

    try {
      await emailProvider.send({ to: destination, subject, body });
      await db
        .update(notifications)
        .set({ status: "SENT", sentAt: new Date() })
        .where(eq(notifications.id, record.id));
    } catch (err) {
      logger.error({ err, destination, purpose }, "OTP email delivery failed");
      await db.update(notifications).set({ status: "FAILED" }).where(eq(notifications.id, record.id));
      throw err;
    }
  }
}
