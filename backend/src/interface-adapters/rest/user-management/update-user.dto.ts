import { IsEmail, IsEnum, IsOptional } from 'class-validator';
import { UserRole } from '../../../entities/user-role.enum';

/** Body de `PATCH /api/v1/users/:id` (docs/11-api-rest.md, sección "User"). */
export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}
