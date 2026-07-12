import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { isValidGaugeWidgetConfig } from '../../../entities/widget-config.vo';
import { WidgetType } from '../../../entities/widget-type.enum';

export class ValueWidgetConfigDto {
  @IsOptional()
  @IsInt()
  decimals?: number;

  @IsOptional()
  @IsString()
  label?: string;
}

@ValidatorConstraint({ name: 'GaugeRangeValid', async: false })
class GaugeRangeValidConstraint implements ValidatorConstraintInterface {
  validate(_min: number, args: ValidationArguments): boolean {
    const dto = args.object as GaugeWidgetConfigDto;
    return isValidGaugeWidgetConfig({ min: dto.min, max: dto.max });
  }
  defaultMessage(): string {
    return 'min debe ser un número menor que max.';
  }
}

export class GaugeWidgetConfigDto {
  @IsNumber()
  @Validate(GaugeRangeValidConstraint)
  min: number;

  @IsNumber()
  max: number;

  @IsOptional()
  @IsInt()
  decimals?: number;
}

export class ChartWidgetConfigDto {
  @IsOptional()
  @IsInt()
  maxPoints?: number;

  @IsOptional()
  @IsString()
  yAxisLabel?: string;
}

export class TableWidgetConfigDto {
  @IsOptional()
  @IsArray()
  @IsIn(['value', 'quality', 'timestamp'], { each: true })
  columns?: Array<'value' | 'quality' | 'timestamp'>;
}

export class AlarmListWidgetConfigDto {}

/**
 * `PATCH` no reenvía `widgetType` (inmutable tras la creación, igual que
 * `UpdateSignalDto`/`signalSource`): valida el rango GAUGE solo si `config`
 * ya trae ambas claves `min`/`max`, sin necesitar conocer el widgetType persistido.
 */
@ValidatorConstraint({ name: 'OptionalGaugeRangeValid', async: false })
export class OptionalGaugeRangeValidConstraint implements ValidatorConstraintInterface {
  validate(config: Record<string, unknown> | undefined): boolean {
    if (!config || typeof config.min !== 'number' || typeof config.max !== 'number') {
      return true;
    }
    return isValidGaugeWidgetConfig({ min: config.min, max: config.max });
  }
  defaultMessage(): string {
    return 'Si config incluye min y max, min debe ser un número menor que max.';
  }
}

/**
 * Resuelve el DTO de `config` correspondiente a `widgetType` (unión discriminada,
 * mismo patrón que `signal-source.dto.ts` para `SignalSource`).
 */
export function widgetConfigDtoFor(widgetType: WidgetType | undefined): new () => object {
  switch (widgetType) {
    case WidgetType.Gauge:
      return GaugeWidgetConfigDto;
    case WidgetType.Chart:
      return ChartWidgetConfigDto;
    case WidgetType.Table:
      return TableWidgetConfigDto;
    case WidgetType.AlarmList:
      return AlarmListWidgetConfigDto;
    case WidgetType.Value:
    default:
      return ValueWidgetConfigDto;
  }
}
