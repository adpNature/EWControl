import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';
import { PASSWORD_POLICY_MESSAGE, PASSWORD_POLICY_REGEX } from '../shared/password-policy';

/** Body de `PATCH /api/v1/users/me/password` (docs/11-api-rest.md, sección "User"). */
export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(72) // límite práctico de bcrypt, docs/06-seguridad-global.md 6.2
  currentPassword: string;

  @IsString()
  @Matches(PASSWORD_POLICY_REGEX, { message: PASSWORD_POLICY_MESSAGE })
  @MaxLength(72)
  newPassword: string;
}
