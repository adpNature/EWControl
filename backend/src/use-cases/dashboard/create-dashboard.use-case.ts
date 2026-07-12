import { Inject, Injectable } from '@nestjs/common';
import { Dashboard } from '../../entities/dashboard.entity';
import { DASHBOARD_REPOSITORY, type IDashboardRepository } from './ports/dashboard-repository.port';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';

export type CreateDashboardInput = { companyId: string; name: string };

/** docs/specs/07-dashboard-tiempo-real.md, criterio de aceptación backend 5. */
@Injectable()
export class CreateDashboardUseCase {
  constructor(
    @Inject(DASHBOARD_REPOSITORY) private readonly dashboardRepository: IDashboardRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  execute(input: CreateDashboardInput): Promise<Dashboard> {
    return this.unitOfWork.runInTransaction((ctx) =>
      this.dashboardRepository.create({ companyId: input.companyId, name: input.name }, ctx),
    );
  }
}
