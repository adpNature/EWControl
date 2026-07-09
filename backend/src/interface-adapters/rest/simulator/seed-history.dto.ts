import { IsBoolean, IsOptional } from 'class-validator';

/** Body de `POST /api/v1/machines/:machineId/simulator/seed-history` (docs/11-api-rest.md). */
export class SeedHistoryDto {
  @IsOptional()
  @IsBoolean()
  force?: boolean;
}
