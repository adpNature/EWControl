import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Body de `POST /api/v1/dashboards` (docs/11-api-rest.md, "Dashboard / DashboardWidget"). */
export class CreateDashboardDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;
}
