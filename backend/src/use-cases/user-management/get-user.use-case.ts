import { Inject, Injectable } from '@nestjs/common';
import { User } from '../../entities/user.entity';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import { Requester, UserAccessResolver } from './user-access.resolver';

export type GetUserInput = { userId: string; requester: Requester };

/** docs/specs/10-gestion-companies-users.md, flujo principal backend. */
@Injectable()
export class GetUserUseCase {
  constructor(
    private readonly resolver: UserAccessResolver,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  execute(input: GetUserInput): Promise<User> {
    return this.unitOfWork.runInTransaction((ctx) =>
      this.resolver.resolveActive(input.userId, input.requester, ctx),
    );
  }
}
