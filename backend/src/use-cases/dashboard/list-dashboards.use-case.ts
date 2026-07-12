import { Inject, Injectable } from '@nestjs/common';
import { Dashboard } from '../../entities/dashboard.entity';
import { UserRole } from '../../entities/user-role.enum';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import { Requester } from './dashboard-access.resolver';
import { DASHBOARD_REPOSITORY, type IDashboardRepository } from './ports/dashboard-repository.port';

export type ListDashboardsInput = {
  requester: Requester;
  pagination: { limit: number; offset: number };
};
export type ListDashboardsResult = {
  data: Dashboard[];
  total: number;
  limit: number;
  offset: number;
};

/** docs/specs/07-dashboard-tiempo-real.md, criterio de aceptación backend 5. */
@Injectable()
export class ListDashboardsUseCase {
  constructor(
    @Inject(DASHBOARD_REPOSITORY) private readonly dashboardRepository: IDashboardRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  async execute(input: ListDashboardsInput): Promise<ListDashboardsResult> {
    const companyId =
      input.requester.role === UserRole.SuperAdmin ? null : input.requester.companyId;
    const { data, total } = await this.unitOfWork.runInTransaction((ctx) =>
      this.dashboardRepository.list({ companyId }, input.pagination, ctx),
    );
    return { data, total, limit: input.pagination.limit, offset: input.pagination.offset };
  }
}
