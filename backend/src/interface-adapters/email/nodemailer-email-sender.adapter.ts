import { Inject, Injectable } from '@nestjs/common';
import type { Transporter } from 'nodemailer';
import { NODEMAILER_TRANSPORTER } from '../../frameworks-drivers/email/nodemailer.client';
import { smtpConnectionOptions } from '../../frameworks-drivers/config/smtp.config';
import { EmailMessage, IEmailSender } from '../../use-cases/notification/ports/email-sender.port';

/** Implementación de `IEmailSender` sobre `nodemailer` (docs/specs/09-alarmas.md). */
@Injectable()
export class NodemailerEmailSenderAdapter implements IEmailSender {
  constructor(@Inject(NODEMAILER_TRANSPORTER) private readonly transporter: Transporter) {}

  async send(message: EmailMessage): Promise<void> {
    const { from } = smtpConnectionOptions();
    await this.transporter.sendMail({
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
  }
}
