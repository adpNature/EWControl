import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  Validate,
} from 'class-validator';
import { OptionalGaugeRangeValidConstraint } from './widget-config.dto';

/**
 * Body de `PATCH /api/v1/dashboards/:id/widgets/:widgetId` (docs/11-api-rest.md).
 * `widgetType` es inmutable tras la creación y no se reenvía; `config` se valida
 * como objeto genérico, igual que `UpdateSignalDto`/`signalSource`.
 */
export class UpdateWidgetDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsString({ each: true })
  signalIds?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;

  @IsOptional()
  @IsObject()
  @Validate(OptionalGaugeRangeValidConstraint)
  config?: Record<string, unknown>;
}
