import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { ALARM_OPERATORS, isNumericOperator } from '../../../entities/alarm-operator.vo';

/**
 * `>`,`>=`,`<`,`<=` solo tienen sentido sobre números (Documento 2, apartado 2.8);
 * `==`/`!=` aceptan cualquier valor comparable de Signal (number/boolean/string).
 * Mismo patrón que `GaugeRangeValidConstraint` (dashboard/widget-config.dto.ts):
 * valida un campo (`threshold`) contra otro (`operator`) del mismo DTO.
 */
@ValidatorConstraint({ name: 'OperatorThresholdValid', async: false })
export class OperatorThresholdValidConstraint implements ValidatorConstraintInterface {
  validate(threshold: unknown, args: ValidationArguments): boolean {
    const operator = (args.object as { operator?: unknown }).operator;
    if (typeof operator !== 'string' || !(ALARM_OPERATORS as string[]).includes(operator)) {
      return false;
    }
    if (isNumericOperator(operator as (typeof ALARM_OPERATORS)[number])) {
      return typeof threshold === 'number';
    }
    return (
      typeof threshold === 'number' ||
      typeof threshold === 'boolean' ||
      typeof threshold === 'string'
    );
  }

  defaultMessage(): string {
    return 'threshold debe ser un número cuando operator es >,>=,< o <=.';
  }
}

/**
 * Variante para `PATCH` (`UpdateAlarmDefinitionDto`): ninguno de los dos campos
 * es obligatorio en un PATCH, así que solo valida la coherencia operator/threshold
 * cuando ambos llegan en el mismo body — mismo criterio que
 * `OptionalGaugeRangeValidConstraint` (dashboard/widget-config.dto.ts).
 */
@ValidatorConstraint({ name: 'OptionalOperatorThresholdValid', async: false })
export class OptionalOperatorThresholdValidConstraint implements ValidatorConstraintInterface {
  validate(threshold: unknown, args: ValidationArguments): boolean {
    if (threshold === undefined) {
      return true;
    }
    if (
      typeof threshold !== 'number' &&
      typeof threshold !== 'boolean' &&
      typeof threshold !== 'string'
    ) {
      return false;
    }
    const operator = (args.object as { operator?: unknown }).operator;
    if (typeof operator !== 'string' || !(ALARM_OPERATORS as string[]).includes(operator)) {
      return true;
    }
    if (isNumericOperator(operator as (typeof ALARM_OPERATORS)[number])) {
      return typeof threshold === 'number';
    }
    return true;
  }

  defaultMessage(): string {
    return 'Si operator es >,>=,< o <=, threshold debe ser un número.';
  }
}
