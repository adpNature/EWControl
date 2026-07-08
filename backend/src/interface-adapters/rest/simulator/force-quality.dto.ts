import { IsEnum, IsInt, IsUUID, Min } from 'class-validator';
import { ForcedSignalQuality } from '../../../entities/forced-signal-quality.enum';

/** Body de `POST /api/v1/machines/:machineId/simulator/force-quality` (docs/11-api-rest.md). */
export class ForceQualityDto {
  @IsUUID()
  signalId: string;

  @IsEnum(ForcedSignalQuality)
  quality: ForcedSignalQuality;

  @IsInt()
  @Min(1)
  durationTicks: number;
}
