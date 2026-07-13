import { describe, expect, it, vi } from 'vitest';
import type { Transporter } from 'nodemailer';
import { NodemailerEmailSenderAdapter } from './nodemailer-email-sender.adapter';

describe('NodemailerEmailSenderAdapter', () => {
  it('delega el envío en transporter.sendMail con el remitente configurado', async () => {
    const transporter = {
      sendMail: vi.fn().mockResolvedValue(undefined),
    } as unknown as Transporter;
    const adapter = new NodemailerEmailSenderAdapter(transporter);

    await adapter.send({
      to: ['admin@ewcontrol.local'],
      subject: 'Alarma activada',
      text: 'Empresa: Demo',
    });

    expect(transporter.sendMail).toHaveBeenCalledWith({
      from: 'alerts@ewcontrol.local',
      to: ['admin@ewcontrol.local'],
      subject: 'Alarma activada',
      text: 'Empresa: Demo',
    });
  });

  it('propaga el error de transporter.sendMail (el use-case es quien lo atrapa)', async () => {
    const transporter = {
      sendMail: vi.fn().mockRejectedValue(new Error('SMTP down')),
    } as unknown as Transporter;
    const adapter = new NodemailerEmailSenderAdapter(transporter);

    await expect(
      adapter.send({ to: ['admin@ewcontrol.local'], subject: 'x', text: 'y' }),
    ).rejects.toThrow('SMTP down');
  });
});
