import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Body de `POST /api/v1/machines` (docs/11-api-rest.md, sección "Machine"). */
export class CreateMachineDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;
}
