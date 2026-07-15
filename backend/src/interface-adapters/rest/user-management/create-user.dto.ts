import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { UserRole } from '../../../entities/user-role.enum';
import { PASSWORD_POLICY_MESSAGE, PASSWORD_POLICY_REGEX } from '../shared/password-policy';

/**
 * Body de `POST /api/v1/users` (docs/11-api-rest.md, sección "User"). `companyId`
 * solo es obligatorio en la práctica cuando el requester es `SuperAdmin`
 * (docs/specs/10-gestion-companies-users.md, flujo principal backend); para un
 * `AdminCliente` se ignora siempre en favor del `companyId` de su token.
 */
export class CreateUserDto {
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @IsEmail()
  email: string;

  @IsString()
  @Matches(PASSWORD_POLICY_REGEX, { message: PASSWORD_POLICY_MESSAGE })
  @MaxLength(72) // límite práctico de bcrypt, docs/06-seguridad-global.md 6.2
  password: string;

  @IsEnum(UserRole)
  role: UserRole;
}
