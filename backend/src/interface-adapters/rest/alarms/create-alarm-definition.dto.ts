import { IsBoolean, IsIn, Validate } from 'class-validator';
import { ALARM_OPERATORS, type AlarmOperator } from '../../../entities/alarm-operator.vo';
import { AlarmPriority } from '../../../entities/alarm-priority.enum';
import { OperatorThresholdValidConstraint } from './operator-threshold-valid.constraint';

/** Body de `POST /api/v1/signals/:signalId/alarm-definitions` (docs/11-api-rest.md, sección "AlarmDefinition"). */
export class CreateAlarmDefinitionDto {
  @IsIn(ALARM_OPERATORS)
  operator: AlarmOperator;

  @Validate(OperatorThresholdValidConstraint)
  threshold: number | boolean | string;

  @IsIn(Object.values(AlarmPriority))
  priority: AlarmPriority;

  @IsBoolean()
  notifyByEmail: boolean;

  @IsBoolean()
  showOnDashboard: boolean;
}
