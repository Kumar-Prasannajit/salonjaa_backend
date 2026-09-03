import { NotificationRepository } from "@/modules/notification/notification.repository";
import { renderNotification } from "@/modules/notification/notification.templates";
import { NotifyInput } from "@/modules/notification/notification.types";
import { scheduleNotificationDelivery } from "@/queues/notification-send.queue";
import { logger } from "@/shared/logger";

export class NotificationService {
  constructor(private readonly repo: NotificationRepository = new NotificationRepository()) {}

  /**
   * Best-effort, fire-and-forget: never throws. A notification failure must never break the
   * caller's primary action (booking approval, cancellation, etc.) — same defensive
   * philosophy as AuthService.sendOtp's delivery try/catch (Module 1).
   */
  async notify(input: NotifyInput): Promise<void> {
    try {
      const email = await this.repo.findUserEmail(input.userId);
      if (!email) {
        return; // no account/email to notify (e.g. a walk-in customer) — nothing to do
      }

      const { subject, body } = renderNotification(input.eventType, input.data);
      const record = await this.repo.create({
        userId: input.userId,
        type: "EMAIL",
        eventType: input.eventType,
        subject,
        message: body,
      });

      await scheduleNotificationDelivery(record.id);
    } catch (err) {
      logger.error({ err, input }, "Failed to enqueue notification");
    }
  }
}
