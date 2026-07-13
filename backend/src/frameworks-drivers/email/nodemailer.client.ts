import nodemailer, { Transporter } from 'nodemailer';
import { smtpConnectionOptions } from '../config/smtp.config';

export const NODEMAILER_TRANSPORTER = Symbol('NodemailerTransporter');

/** Cliente SMTP compartido del Notification Service (docs/specs/09-alarmas.md). */
export function createNodemailerTransporter(): Transporter {
  const { host, port, user, password } = smtpConnectionOptions();
  return nodemailer.createTransport({
    host,
    port,
    auth: user ? { user, pass: password } : undefined,
  });
}
