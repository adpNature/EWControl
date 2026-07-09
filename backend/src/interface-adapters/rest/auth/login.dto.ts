import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Body de `POST /api/v1/auth/login` (docs/11-api-rest.md, sección Auth). */
export class LoginDto {
  @IsEmail()
  email: string;

  // 72 = límite práctico de bcrypt (docs/06-seguridad-global.md, apartado 6.2).
  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  password: string;
}
