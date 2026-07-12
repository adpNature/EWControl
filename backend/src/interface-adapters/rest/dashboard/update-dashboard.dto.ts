import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Body de `PATCH /api/v1/dashboards/:id`: solo renombra (docs/specs/07-dashboard-tiempo-real.md). */
export class UpdateDashboardDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;
}
