import { Inject, Injectable } from '@nestjs/common';
import { Dashboard } from '../../entities/dashboard.entity';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import { DashboardAccessResolver, Requester } from './dashboard-access.resolver';
import { DASHBOARD_REPOSITORY, type IDashboardRepository } from './ports/dashboard-repository.port';

export type UpdateDashboardInput = { dashboardId: string; requester: Requester; name: string };

/** docs/specs/07-dashboard-tiempo-real.md: PATCH /dashboards/:id renombra (nunca reordena widgets aquí). */
@Injectable()
export class UpdateDashboardUseCase {
  constructor(
    private readonly resolver: DashboardAccessResolver,
    @Inject(DASHBOARD_REPOSITORY) private readonly dashboardRepository: IDashboardRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  execute(input: UpdateDashboardInput): Promise<Dashboard> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const dashboard = await this.resolver.resolveAny(input.dashboardId, input.requester, ctx);
      return this.dashboardRepository.update(dashboard.id, { name: input.name }, ctx);
    });
  }
}
