import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Body de `PATCH /api/v1/machines/:machineId/signals/:id` (docs/11-api-rest.md,
 * sección "Signal"). A diferencia de create-signal.dto.ts, `signalSource` no se
 * valida con la forma discriminada por `signalType`: el PATCH no reenvía
 * `signalType` (es inmutable tras la creación), así que a nivel de DTO no hay
 * forma de saber si la Signal persistida es DIRECT o FORMULA sin ir a BD. Esa
 * validación de forma y de variables desconocidas ocurre en UpdateSignalUseCase
 * contra el `signalType` ya persistido, que es la única fuente de verdad fiable.
 */
export class UpdateSignalDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  unit?: string;

  @IsOptional()
  @IsObject()
  signalSource?: Record<string, unknown>;
}
