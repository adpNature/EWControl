import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Body de `POST /api/v1/companies` (docs/11-api-rest.md, sección "Company"). */
export class CreateCompanyDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;
}
