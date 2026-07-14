import { Inject, Injectable } from '@nestjs/common';
import { User } from '../../entities/user.entity';
import { UserRole } from '../../entities/user-role.enum';
import {
  type IUserRepository,
  USER_REPOSITORY,
} from '../seed-demo-environment/ports/user-repository.port';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import { Requester } from './user-access.resolver';

export type ListUsersInput = {
  requester: Requester;
  /** docs/08-frontend-dashboard.md, 8.8: filtro del switcher de Company de un SuperAdmin. Ignorado para AdminCliente. */
  companyId?: string;
  pagination: { limit: number; offset: number };
};
export type ListUsersResult = { data: User[]; total: number; limit: number; offset: number };

/**
 * docs/specs/10-gestion-companies-users.md, flujo principal backend: todos
 * los Users (activos e inactivos) de la Company del requester, para poder
 * reactivar los dados de baja. Un SuperAdmin ve todas las Companies por
 * defecto, o puede acotar a una concreta vía `companyId`.
 */
@Injectable()
export class ListUsersUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepository: IUserRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(input: ListUsersInput): Promise<ListUsersResult> {
    const companyId =
      input.requester.role === UserRole.SuperAdmin
        ? (input.companyId ?? null)
        : input.requester.companyId;
    const { data, total } = await this.unitOfWork.runInTransaction((ctx) =>
      this.userRepository.list({ companyId }, input.pagination, ctx),
    );
    return { data, total, limit: input.pagination.limit, offset: input.pagination.offset };
  }
}
