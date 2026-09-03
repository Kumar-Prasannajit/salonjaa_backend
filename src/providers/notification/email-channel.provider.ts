import { emailProvider } from "@/providers/email";
import { NotificationChannelProvider, NotificationPayload } from "@/providers/notification/notification-provider.interface";

/** Adapts the existing (transport-level) EmailProvider to the channel-agnostic NotificationChannelProvider shape. */
export class EmailChannelProvider implements NotificationChannelProvider {
  async send(payload: NotificationPayload): Promise<{ providerMessageId?: string }> {
    return emailProvider.send({
      to: payload.to,
      subject: payload.subject ?? "Salonjaa notification",
      body: payload.message,
    });
  }
}
