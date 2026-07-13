/**
 * Operador de comparación de una AlarmDefinition (Documento 2, apartado 2.8,
 * "Tipos de Condición"). No es un TS `enum` porque `>=`/`<=`/`==`/`!=` no son
 * identificadores válidos.
 */
export type AlarmOperator = '>' | '>=' | '<' | '<=' | '==' | '!=';

export const ALARM_OPERATORS: AlarmOperator[] = ['>', '>=', '<', '<=', '==', '!='];

export function isAlarmOperator(value: unknown): value is AlarmOperator {
  return typeof value === 'string' && (ALARM_OPERATORS as string[]).includes(value);
}

/**
 * `>`,`>=`,`<`,`<=` solo tienen sentido sobre números; `==`/`!=` sirven para
 * cualquier tipo de valor de Signal (Documento 2, apartado 2.8, ejemplos
 * "Running == true", "Estado != OK").
 */
export function isNumericOperator(operator: AlarmOperator): boolean {
  return operator === '>' || operator === '>=' || operator === '<' || operator === '<=';
}
