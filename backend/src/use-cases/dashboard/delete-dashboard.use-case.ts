import { Inject, Injectable } from '@nestjs/common';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import { DashboardAccessResolver, Requester } from './dashboard-access.resolver';
import { DASHBOARD_REPOSITORY, type IDashboardRepository } from './ports/dashboard-repository.port';

export type DeleteDashboardInput = { dashboardId: string; requester: Requester };

/**
 * docs/specs/07-dashboard-tiempo-real.md, criterio de aceptación backend 6:
 * baja física (no lógica) del Dashboard y en cascada de sus widgets (FK `ON DELETE CASCADE`).
 */
@Injectable()
export class DeleteDashboardUseCase {
  constructor(
    private readonly resolver: DashboardAccessResolver,
    @Inject(DASHBOARD_REPOSITORY) private readonly dashboardRepository: IDashboardRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  execute(input: DeleteDashboardInput): Promise<void> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const dashboard = await this.resolver.resolveAny(input.dashboardId, input.requester, ctx);
      await this.dashboardRepository.delete(dashboard.id, ctx);
    });
  }
}
