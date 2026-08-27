export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
}

export interface EmailProvider {
  send(input: SendEmailInput): Promise<{ providerMessageId?: string }>;
}
