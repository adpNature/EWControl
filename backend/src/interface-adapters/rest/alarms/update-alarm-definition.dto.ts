import { IsBoolean, IsIn, IsOptional, Validate } from 'class-validator';
import { ALARM_OPERATORS, type AlarmOperator } from '../../../entities/alarm-operator.vo';
import { AlarmPriority } from '../../../entities/alarm-priority.enum';
import { OptionalOperatorThresholdValidConstraint } from './operator-threshold-valid.constraint';

/** Body de `PATCH /api/v1/alarm-definitions/:id` (docs/11-api-rest.md, sección "AlarmDefinition"). */
export class UpdateAlarmDefinitionDto {
  @IsOptional()
  @IsIn(ALARM_OPERATORS)
  operator?: AlarmOperator;

  @IsOptional()
  @Validate(OptionalOperatorThresholdValidConstraint)
  threshold?: number | boolean | string;

  @IsOptional()
  @IsIn(Object.values(AlarmPriority))
  priority?: AlarmPriority;

  @IsOptional()
  @IsBoolean()
  notifyByEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  showOnDashboard?: boolean;
}
