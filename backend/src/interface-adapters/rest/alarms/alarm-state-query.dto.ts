import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { AlarmPriority } from '../../../entities/alarm-priority.enum';
import { AlarmStateType } from '../../../entities/alarm-state-type.enum';
import { PaginationQueryDto } from '../shared/pagination-query.dto';

/** Query de `GET /api/v1/alarm-states` (docs/11-api-rest.md, sección "AlarmState"). */
export class AlarmStateQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(AlarmStateType)
  status?: AlarmStateType;

  @IsOptional()
  @IsUUID()
  machineId?: string;

  @IsOptional()
  @IsEnum(AlarmPriority)
  priority?: AlarmPriority;
}
