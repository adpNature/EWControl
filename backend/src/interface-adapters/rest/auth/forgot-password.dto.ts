import { IsEmail } from 'class-validator';

/** Body de `POST /api/v1/auth/forgot-password` (docs/11-api-rest.md, sección Auth). */
export class ForgotPasswordDto {
  @IsEmail()
  email: string;
}
