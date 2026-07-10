import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
} from '../../use-cases/auth/auth.config';
import {
  AccessTokenPayload,
  ITokenService,
  RefreshTokenPayload,
} from '../../use-cases/auth/ports/token.port';

/**
 * Firma access y refresh con secretos HS256 distintos (docs/06-seguridad-global.md,
 * apartado 6.2): que se filtre uno no compromete al otro. `JwtModule.register({})`
 * se registra sin secreto por defecto en `auth.module.ts` porque cada `sign`/`verify`
 * pasa el suyo explícitamente aquí.
 */
@Injectable()
export class JwtTokenService implements ITokenService {
  constructor(private readonly jwtService: JwtService) {}

  signAccessToken(payload: AccessTokenPayload): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    });
  }

  signRefreshToken(payload: RefreshTokenPayload): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: REFRESH_TOKEN_TTL_SECONDS,
    });
  }

  verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    return this.jwtService.verifyAsync<AccessTokenPayload>(token, {
      secret: process.env.JWT_ACCESS_SECRET,
    });
  }

  verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
    return this.jwtService.verifyAsync<RefreshTokenPayload>(token, {
      secret: process.env.JWT_REFRESH_SECRET,
    });
  }
}
