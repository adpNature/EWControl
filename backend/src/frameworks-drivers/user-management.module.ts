import { Module } from '@nestjs/common';
import { RefreshTokenTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/refresh-token.typeorm-repository';
import { UserTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/user.typeorm-repository';
import { TypeOrmUnitOfWork } from '../interface-adapters/persistence/postgres/typeorm/typeorm-unit-of-work';
import { UserController } from '../interface-adapters/rest/user-management/user.controller';
import { REFRESH_TOKEN_REPOSITORY } from '../use-cases/auth/ports/refresh-token-repository.port';
import { PASSWORD_HASHER } from '../use-cases/seed-demo-environment/ports/password-hasher.port';
import { UNIT_OF_WORK } from '../use-cases/seed-demo-environment/ports/unit-of-work.port';
import { USER_REPOSITORY } from '../use-cases/seed-demo-environment/ports/user-repository.port';
import { BcryptPasswordHasher } from '../interface-adapters/security/bcrypt-password-hasher';
import { CreateUserUseCase } from '../use-cases/user-management/create-user.use-case';
import { DeactivateUserUseCase } from '../use-cases/user-management/deactivate-user.use-case';
import { GetUserUseCase } from '../use-cases/user-management/get-user.use-case';
import { ListUsersUseCase } from '../use-cases/user-management/list-users.use-case';
import { UpdateUserUseCase } from '../use-cases/user-management/update-user.use-case';
import { UserAccessResolver } from '../use-cases/user-management/user-access.resolver';
import { AuthModule } from './auth.module';

/**
 * Wiring de docs/specs/10-gestion-companies-users.md (User): mismo estilo que
 * `machine-management.module.ts`/`company-management.module.ts`. No registra
 * `APP_GUARD` — `JwtAuthGuard` ya es global (`auth.module.ts`); tampoco
 * `RolesGuard`, ya que `UserController` no lleva `@roles()` (su alcance es por
 * `UserAccessResolver`, no un gate de rol). Importa `AuthModule` únicamente
 * por `ChangePasswordUseCase` (`PATCH /users/me/password`), que ya depende de
 * los puertos de `auth/` (`AUTH_USER_REPOSITORY`, `REFRESH_TOKEN_REPOSITORY`...).
 */
@Module({
  imports: [AuthModule],
  controllers: [UserController],
  providers: [
    UserAccessResolver,
    CreateUserUseCase,
    ListUsersUseCase,
    GetUserUseCase,
    UpdateUserUseCase,
    DeactivateUserUseCase,
    { provide: USER_REPOSITORY, useClass: UserTypeOrmRepository },
    { provide: REFRESH_TOKEN_REPOSITORY, useClass: RefreshTokenTypeOrmRepository },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    { provide: UNIT_OF_WORK, useClass: TypeOrmUnitOfWork },
  ],
})
export class UserManagementModule {}
