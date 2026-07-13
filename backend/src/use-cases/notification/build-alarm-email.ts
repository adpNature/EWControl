export type BuildAlarmEmailInput = {
  companyName: string;
  machineName: string;
  signalName: string;
  value: number | boolean | string;
  threshold: number | boolean | string;
  timestamp: Date;
};

export type AlarmEmailContent = { subject: string; text: string };

/**
 * Contenido del email de notificación (Documento 2, apartado 2.10, "Contenido
 * de una Notificación"): Empresa, Máquina, Signal, Valor, Límite, Fecha.
 */
export function buildAlarmEmail(input: BuildAlarmEmailInput): AlarmEmailContent {
  return {
    subject: `Alarma activada: ${input.signalName} en ${input.machineName}`,
    text: [
      `Empresa: ${input.companyName}`,
      `Máquina: ${input.machineName}`,
      `Signal: ${input.signalName}`,
      `Valor: ${input.value}`,
      `Límite: ${input.threshold}`,
      `Fecha: ${input.timestamp.toISOString()}`,
    ].join('\n'),
  };
}
