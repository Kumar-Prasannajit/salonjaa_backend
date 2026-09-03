export interface NotificationPayload {
  to: string; // channel-specific destination: email address, phone number, etc.
  subject?: string; // channels without a subject concept (SMS/WhatsApp) may ignore this
  message: string;
}

/**
 * One implementation per channel (EMAIL now; SMS/WhatsApp adapters slot in behind this same
 * interface later — TRD §11: "Keep SMSProvider and WhatsAppProvider adapters behind the same
 * interface; no SMS/WhatsApp provider is implemented in MVP.")
 */
export interface NotificationChannelProvider {
  send(payload: NotificationPayload): Promise<{ providerMessageId?: string }>;
}
