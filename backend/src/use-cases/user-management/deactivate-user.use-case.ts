import { Inject, Injectable } from '@nestjs/common';
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
import { CannotDeactivateSelfError } from './errors/cannot-deactivate-self.error';

export type DeactivateUserInput = { userId: string; requesterId: string; requester: Requester };

/**
 * docs/specs/10-gestion-companies-users.md, flujo principal backend: baja
 * lógica de un User que además invalida inmediatamente todos sus refresh
 * tokens activos (mismo `revokeAllActiveForUser` que la reutilización de
 * refresh token en docs/specs/05-auth-login.md). Un User no puede darse de
 * baja a sí mismo (evita bloquearse su propio acceso sin que otro pueda
 * revertirlo).
 */
@Injectable()
export class DeactivateUserUseCase {
  constructor(
    private readonly resolver: UserAccessResolver,
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepository: IRefreshTokenRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  execute(input: DeactivateUserInput): Promise<void> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      if (input.userId === input.requesterId) {
        throw new CannotDeactivateSelfError();
      }
      const user = await this.resolver.resolveAny(input.userId, input.requester, ctx);
      await this.userRepository.deactivate(user.id, ctx);
      await this.refreshTokenRepository.revokeAllActiveForUser(user.id, ctx);
    });
  }
}
