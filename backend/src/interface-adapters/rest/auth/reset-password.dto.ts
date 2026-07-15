import { IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { PASSWORD_POLICY_MESSAGE, PASSWORD_POLICY_REGEX } from '../shared/password-policy';

/** Body de `POST /api/v1/auth/reset-password` (docs/11-api-rest.md, sección Auth). */
export class ResetPasswordDto {
  @IsUUID()
  token: string;

  @IsString()
  @Matches(PASSWORD_POLICY_REGEX, { message: PASSWORD_POLICY_MESSAGE })
  @MaxLength(72)
  newPassword: string;
}
