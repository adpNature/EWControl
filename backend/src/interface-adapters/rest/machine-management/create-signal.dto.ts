import { Type } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsString, MaxLength, ValidateNested } from 'class-validator';
import { SignalType } from '../../../entities/signal-type.enum';
import { DirectSignalSourceDto, FormulaSignalSourceDto } from './signal-source.dto';

/**
 * Body de `POST /api/v1/machines/:machineId/signals` (docs/11-api-rest.md,
 * sección "Signal"). `signalSource` se valida con la forma correspondiente a
 * `signalType` (unión discriminada resuelta con `@Type()` dinámico de
 * class-transformer, ya que class-validator no soporta discriminated unions
 * de forma nativa).
 */
export class CreateSignalDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsEnum(SignalType)
  signalType: SignalType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  unit: string;

  @ValidateNested()
  @Type((options) =>
    (options?.object as CreateSignalDto)?.signalType === SignalType.FORMULA
      ? FormulaSignalSourceDto
      : DirectSignalSourceDto,
  )
  signalSource: DirectSignalSourceDto | FormulaSignalSourceDto;
}
