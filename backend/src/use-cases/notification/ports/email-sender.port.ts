export const EMAIL_SENDER = Symbol('EmailSender');

export type EmailMessage = { to: string[]; subject: string; text: string };

/**
 * Adapter de envío de email (Documento 2, apartado 2.10, "Notification Service").
 * El use-case nunca conoce SMTP/nodemailer, solo este puerto.
 */
export interface IEmailSender {
  send(message: EmailMessage): Promise<void>;
}
