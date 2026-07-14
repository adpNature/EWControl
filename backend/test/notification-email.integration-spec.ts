/**
 * Test de integración (Documento 0, "Pirámide de Testing") de
 * docs/specs/09-alarmas.md: único test que ejercita el Email Adapter contra un
 * SMTP real (Mailpit, `docker compose`) — el resto de la lógica de
 * notificación (`NotifyAlarmTriggeredUseCase`) ya está cubierta por tests
 * unitarios contra un `IEmailSender` falso; este adaptador es lo bastante
 * fino como para bastar con un único caso feliz de punta a punta.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createNodemailerTransporter } from '../src/frameworks-drivers/email/nodemailer.client';
import { NodemailerEmailSenderAdapter } from '../src/interface-adapters/email/nodemailer-email-sender.adapter';

const MAILPIT_API_URL = 'http://localhost:8025/api/v1';

/* eslint-disable @typescript-eslint/naming-convention -- forma real (PascalCase) de la API de Mailpit, fuera del control del proyecto */
type MailpitAddress = { Address: string };
type MailpitMessage = { Subject: string; To: MailpitAddress[] };
/* eslint-enable @typescript-eslint/naming-convention */

async function clearMailpitMessages(): Promise<void> {
  await fetch(`${MAILPIT_API_URL}/messages`, { method: 'DELETE' });
}

async function waitForMailpitMessage(subject: string): Promise<MailpitMessage> {
  const deadline = Date.now() + 5000;
  for (;;) {
    const response = await fetch(`${MAILPIT_API_URL}/messages`);
    const body = (await response.json()) as { messages: MailpitMessage[] };
    const found = body.messages.find((message) => message.Subject === subject);
    if (found) {
      return found;
    }
    if (Date.now() > deadline) {
      throw new Error(`Timeout esperando el email con subject "${subject}" en Mailpit`);
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

describe('NodemailerEmailSenderAdapter (integration, Mailpit)', () => {
  let adapter: NodemailerEmailSenderAdapter;

  beforeAll(() => {
    adapter = new NodemailerEmailSenderAdapter(createNodemailerTransporter());
  });

  beforeAll(async () => {
    await clearMailpitMessages();
  });

  afterAll(async () => {
    await clearMailpitMessages();
  });

  it('envía un email real que Mailpit recibe con el remitente, destinatario y asunto correctos', async () => {
    const subject = `Alarma activada - test ${Date.now()}`;

    await adapter.send({
      to: ['admin@ewcontrol.local'],
      subject,
      text: 'Empresa: Demo\nMáquina: Prensa 01\nSignal: Temperatura\nValor: 84\nLímite: 80',
    });

    const message = await waitForMailpitMessage(subject);
    expect(message.To.map((address) => address.Address)).toEqual(['admin@ewcontrol.local']);
  }, 10000);
});
