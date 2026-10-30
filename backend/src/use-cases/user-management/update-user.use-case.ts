import { Inject, Injectable } from '@nestjs/common';
import { User } from '../../entities/user.entity';
import { UserRole } from '../../entities/user-role.enum';
import {
  type IRefreshTokenRepository,
  REFRESH_TOKEN_REPOSITORY,
} from '../auth/ports/refresh-token-repository.port';
import {
  type IUserRepository,
  USER_REPOSITORY,
} from '../seed-demo-environment/ports/user-repository.port';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import { Requester, UserAccessResolver } from './user-access.resolver';
import { CannotCreateSuperAdminError } from './errors/cannot-create-superadmin.error';
import { EmailAlreadyExistsError } from './errors/email-already-exists.error';

export type UpdateUserInput = {
  userId: string;
  requester: Requester;
  email?: string;
  role?: UserRole;
};

/**
 * docs/specs/10-gestion-companies-users.md, flujo principal backend: un
 * `AdminCliente` nunca puede ascender un User a `SuperAdmin` (mismo criterio
 * que crear uno); el email sigue siendo único en toda la plataforma.
 * docs/specs/19-rol-operador.md, criterio backend 6: un cambio de rol revoca
 * los refresh tokens activos del User, para que el rol nuevo se aplique en el
 * siguiente login en lugar de esperar a que caduquen (OWASP A07).
 */
@Injectable()
export class UpdateUserUseCase {
  constructor(
    private readonly resolver: UserAccessResolver,
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepository: IRefreshTokenRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  execute(input: UpdateUserInput): Promise<User> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      if (input.requester.role === UserRole.AdminCliente && input.role === UserRole.SuperAdmin) {
        throw new CannotCreateSuperAdminError();
      }

      const user = await this.resolver.resolveAny(input.userId, input.requester, ctx);

      if (input.email) {
        const existing = await this.userRepository.findByEmail(input.email, ctx);
        if (existing && existing.id !== user.id) {
          throw new EmailAlreadyExistsError(input.email);
        }
      }

      const updated = await this.userRepository.update(
        user.id,
        { email: input.email, role: input.role },
        ctx,
      );
      if (input.role && input.role !== user.role) {
        await this.refreshTokenRepository.revokeAllActiveForUser(user.id, ctx);
      }
      return updated;
    });
  }
}
