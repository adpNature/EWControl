import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '../interface-adapters/auth-guard/jwt-auth.guard';
import { RolesGuard } from '../interface-adapters/auth-guard/roles.guard';
import { TypeOrmUnitOfWork } from '../interface-adapters/persistence/postgres/typeorm/typeorm-unit-of-work';
import { UserTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/user.typeorm-repository';
import { RefreshTokenTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/refresh-token.typeorm-repository';
import { AuthAuditLogTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/auth-audit-log.typeorm-repository';
import { AuthController } from '../interface-adapters/rest/auth/auth.controller';
import { BcryptPasswordHasher } from '../interface-adapters/security/bcrypt-password-hasher';
import { CryptoIdGenerator } from '../interface-adapters/security/crypto-id-generator';
import { JwtTokenService } from '../interface-adapters/security/jwt-token.service';
import { CLOCK } from '../use-cases/history/ports/clock.port';
import { SystemClock } from '../interface-adapters/system/system-clock';
import { AUTH_AUDIT_REPOSITORY } from '../use-cases/auth/ports/auth-audit-repository.port';
import { AUTH_USER_REPOSITORY } from '../use-cases/auth/ports/auth-user-repository.port';
import { ID_GENERATOR } from '../use-cases/auth/ports/id-generator.port';
import { REFRESH_TOKEN_REPOSITORY } from '../use-cases/auth/ports/refresh-token-repository.port';
import { TOKEN_SERVICE } from '../use-cases/auth/ports/token.port';
import { LoginUseCase } from '../use-cases/auth/login.use-case';
import { LogoutUseCase } from '../use-cases/auth/logout.use-case';
import { RefreshUseCase } from '../use-cases/auth/refresh.use-case';
import { PASSWORD_HASHER } from '../use-cases/seed-demo-environment/ports/password-hasher.port';
import { UNIT_OF_WORK } from '../use-cases/seed-demo-environment/ports/unit-of-work.port';

/**
 * Wiring de docs/specs/05-auth-login.md: conecta los puertos de `use-cases/auth`
 * con sus implementaciones concretas y registra `JwtAuthGuard` como guard global
 * (`APP_GUARD`), protegiendo automáticamente cualquier endpoint que no marque
 * `@Public()` — incluye `SimulatorController` sin modificarlo. También registra
 * `RolesGuard` (docs/specs/10-gestion-companies-users.md) justo después: Nest
 * ejecuta los `APP_GUARD` en orden de registro, y `RolesGuard` necesita que
 * `JwtAuthGuard` ya haya poblado `request.user`.
 */
@Module({
  imports: [JwtModule.register({})], // sin secreto por defecto: cada sign/verify pasa el suyo (JwtTokenService)
  controllers: [AuthController],
  providers: [
    LoginUseCase,
    RefreshUseCase,
    LogoutUseCase,
    JwtAuthGuard,
    RolesGuard,
    { provide: AUTH_USER_REPOSITORY, useClass: UserTypeOrmRepository },
    { provide: REFRESH_TOKEN_REPOSITORY, useClass: RefreshTokenTypeOrmRepository },
    { provide: AUTH_AUDIT_REPOSITORY, useClass: AuthAuditLogTypeOrmRepository },
    { provide: TOKEN_SERVICE, useClass: JwtTokenService },
    { provide: ID_GENERATOR, useClass: CryptoIdGenerator },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    { provide: UNIT_OF_WORK, useClass: TypeOrmUnitOfWork },
    { provide: CLOCK, useClass: SystemClock },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
