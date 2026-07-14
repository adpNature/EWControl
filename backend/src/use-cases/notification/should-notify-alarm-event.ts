/**
 * Documento 2, apartado 2.10, "Frecuencia de Envío": solo se notifica en la
 * transición INACTIVE→ACTIVE (evento `AlarmTriggered`), nunca en `AlarmCleared`
 * por defecto, y solo si la regla tiene `notifyByEmail: true`.
 */
export function shouldNotifyAlarmEvent(
  notifyByEmail: boolean,
  eventName: 'AlarmTriggered' | 'AlarmCleared',
): boolean {
  return notifyByEmail && eventName === 'AlarmTriggered';
}
