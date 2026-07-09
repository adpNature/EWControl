import {
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { publicRoute } from '../../auth-guard/public.decorator';
import { InvalidCredentialsError } from '../../../use-cases/auth/errors/invalid-credentials.error';
import { InvalidRefreshTokenError } from '../../../use-cases/auth/errors/invalid-refresh-token.error';
import { RefreshTokenReusedError } from '../../../use-cases/auth/errors/refresh-token-reused.error';
import { TooManyLoginAttemptsError } from '../../../use-cases/auth/errors/too-many-login-attempts.error';
import { LoginUseCase } from '../../../use-cases/auth/login.use-case';
import { LogoutUseCase } from '../../../use-cases/auth/logout.use-case';
import { RefreshUseCase } from '../../../use-cases/auth/refresh.use-case';
import { LoginDto } from './login.dto';

const REFRESH_TOKEN_COOKIE = 'refreshToken';
const REFRESH_TOKEN_COOKIE_PATH = '/api/v1/auth';

/**
 * docs/specs/05-auth-login.md, docs/11-api-rest.md sección Auth. `login`/`refresh`
 * son `@publicRoute()`; `logout` también lo es (ver "Correcciones de contrato cruzado"
 * del plan: identifica la sesión por la cookie, no por `req.user`, para poder
 * cerrar sesión aunque el accessToken ya haya expirado).
 */
@Controller('auth')
export class AuthController {
  constructor(
    private readonly loginUseCase: LoginUseCase,
    private readonly refreshUseCase: RefreshUseCase,
    private readonly logoutUseCase: LogoutUseCase,
  ) {}

  @publicRoute()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string; user: unknown }> {
    try {
      const session = await this.loginUseCase.execute(dto);
      this.setRefreshTokenCookie(res, session.refreshToken, session.refreshTokenExpiresAt);
      return { accessToken: session.accessToken, user: session.user };
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @publicRoute()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    try {
      const session = await this.refreshUseCase.execute({
        refreshToken: this.readRefreshTokenCookie(req),
      });
      this.setRefreshTokenCookie(res, session.refreshToken, session.refreshTokenExpiresAt);
      return { accessToken: session.accessToken };
    } catch (error) {
      throw this.toHttpException(error);
    }
  }

  @publicRoute()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.logoutUseCase.execute({ refreshToken: this.readRefreshTokenCookie(req) });
    res.clearCookie(REFRESH_TOKEN_COOKIE, { path: REFRESH_TOKEN_COOKIE_PATH });
  }

  private readRefreshTokenCookie(req: Request): string | undefined {
    const cookies = req.cookies as Record<string, string> | undefined;
    return cookies?.[REFRESH_TOKEN_COOKIE];
  }

  private setRefreshTokenCookie(res: Response, token: string, expiresAt: Date): void {
    res.cookie(REFRESH_TOKEN_COOKIE, token, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: REFRESH_TOKEN_COOKIE_PATH,
      expires: expiresAt,
    });
  }

  private toHttpException(error: unknown): HttpException {
    if (error instanceof InvalidCredentialsError) {
      return new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: error.message });
    }
    if (error instanceof TooManyLoginAttemptsError) {
      return new HttpException(
        { code: 'TOO_MANY_REQUESTS', message: error.message },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (error instanceof InvalidRefreshTokenError || error instanceof RefreshTokenReusedError) {
      return new UnauthorizedException({ code: 'INVALID_REFRESH_TOKEN', message: error.message });
    }
    if (error instanceof HttpException) {
      return error;
    }
    return new InternalServerErrorException();
  }
}
