import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { WidgetType } from '../../../entities/widget-type.enum';
import {
  AlarmListWidgetConfigDto,
  ChartWidgetConfigDto,
  GaugeWidgetConfigDto,
  TableWidgetConfigDto,
  ValueWidgetConfigDto,
  widgetConfigDtoFor,
} from './widget-config.dto';

/** Body de `POST /api/v1/dashboards/:id/widgets` (docs/11-api-rest.md). */
export class CreateWidgetDto {
  @IsEnum(WidgetType)
  widgetType: WidgetType;

  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  signalIds: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @ValidateNested()
  @Type((options) => widgetConfigDtoFor((options?.object as CreateWidgetDto)?.widgetType))
  config:
    | ValueWidgetConfigDto
    | GaugeWidgetConfigDto
    | ChartWidgetConfigDto
    | TableWidgetConfigDto
    | AlarmListWidgetConfigDto;
}
