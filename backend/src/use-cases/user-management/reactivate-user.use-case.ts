import { Inject, Injectable } from '@nestjs/common';
import { User } from '../../entities/user.entity';
import {
  type IUserRepository,
  USER_REPOSITORY,
} from '../seed-demo-environment/ports/user-repository.port';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import { Requester, UserAccessResolver } from './user-access.resolver';

export type ReactivateUserInput = { userId: string; requester: Requester };

/**
 * docs/specs/10-gestion-companies-users.md, flujo principal backend:
 * reactiva un User dado de baja, permitiéndole volver a autenticarse.
 * Idempotente: no falla si el User ya estaba activo.
 */
@Injectable()
export class ReactivateUserUseCase {
  constructor(
    private readonly resolver: UserAccessResolver,
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  execute(input: ReactivateUserInput): Promise<User> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const user = await this.resolver.resolveAny(input.userId, input.requester, ctx);
      return this.userRepository.reactivate(user.id, ctx);
    });
  }
}
