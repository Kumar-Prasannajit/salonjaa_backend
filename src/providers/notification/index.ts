import { NotificationChannelProvider } from "@/providers/notification/notification-provider.interface";
import { EmailChannelProvider } from "@/providers/notification/email-channel.provider";

// Register a channel here (SmsChannelProvider, WhatsAppChannelProvider, ...) when that
// provider is actually implemented — the dispatch worker already looks providers up
// generically by `notifications.type` and treats a missing entry as "not deliverable yet"
// rather than crashing, so adding a channel later is a one-line change here.
export const notificationChannelProviders: Partial<Record<"EMAIL" | "SMS" | "WHATSAPP" | "IN_APP", NotificationChannelProvider>> = {
  EMAIL: new EmailChannelProvider(),
};

export * from "@/providers/notification/notification-provider.interface";
