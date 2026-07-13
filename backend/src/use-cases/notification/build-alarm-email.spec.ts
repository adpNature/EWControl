import { describe, expect, it } from 'vitest';
import { buildAlarmEmail } from './build-alarm-email';

describe('buildAlarmEmail', () => {
  it('incluye Empresa, Máquina, Signal, Valor, Límite y Fecha (Documento 2, apartado 2.10)', () => {
    const email = buildAlarmEmail({
      companyName: 'Metalúrgica López',
      machineName: 'Prensa 01',
      signalName: 'Temperatura',
      value: 84,
      threshold: 80,
      timestamp: new Date('2026-07-02T18:45:22Z'),
    });

    expect(email.subject).toContain('Temperatura');
    expect(email.subject).toContain('Prensa 01');
    expect(email.text).toContain('Empresa: Metalúrgica López');
    expect(email.text).toContain('Máquina: Prensa 01');
    expect(email.text).toContain('Signal: Temperatura');
    expect(email.text).toContain('Valor: 84');
    expect(email.text).toContain('Límite: 80');
    expect(email.text).toContain('Fecha: 2026-07-02T18:45:22.000Z');
  });
});
