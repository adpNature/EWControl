import { AlarmOperator, isNumericOperator } from './alarm-operator.vo';

export type EvaluateAlarmConditionInput = {
  operator: AlarmOperator;
  threshold: number | boolean | string;
  value: number | boolean | string;
};

/**
 * Alarm Engine (Documento 2, apartado 2.8): evalúa si un valor de Signal
 * cumple la condición de una AlarmDefinition. Devuelve `undefined` (no lanza)
 * cuando el operador es numérico (`>`,`>=`,`<`,`<=`) pero `value` no es un
 * número — mismo criterio de tolerancia que `typeof value === 'number'` en
 * `ingest-signal-tick.use-case.ts` para la escritura de histórico: el tick se
 * descarta silenciosamente, sin cambiar el AlarmState.
 */
export function evaluateAlarmCondition(input: EvaluateAlarmConditionInput): boolean | undefined {
  const { operator, threshold, value } = input;

  if (isNumericOperator(operator)) {
    if (typeof value !== 'number' || typeof threshold !== 'number') {
      return undefined;
    }
    switch (operator) {
      case '>':
        return value > threshold;
      case '>=':
        return value >= threshold;
      case '<':
        return value < threshold;
      case '<=':
        return value <= threshold;
    }
  }

  return operator === '==' ? value === threshold : value !== threshold;
}
