import { Inject, Injectable } from '@nestjs/common';
import { Dashboard } from '../../entities/dashboard.entity';
import { UserRole } from '../../entities/user-role.enum';
import { TransactionContext } from '../seed-demo-environment/ports/transaction-context';
import { DASHBOARD_REPOSITORY, type IDashboardRepository } from './ports/dashboard-repository.port';
import { DashboardNotFoundError } from './errors/dashboard-not-found.error';

export type Requester = { companyId: string; role: UserRole };

/**
 * Aislamiento multiempresa de Dashboard (mismo criterio que `MachineAccessResolver`,
 * docs/06-seguridad-global.md 6.7): inexistente o de otra Company responde 404,
 * nunca 403. Sin baja lógica: Dashboard no tiene concepto de "inactivo".
 */
@Injectable()
export class DashboardAccessResolver {
  constructor(
    @Inject(DASHBOARD_REPOSITORY) private readonly dashboardRepository: IDashboardRepository,
  ) {}

  async resolveAny(
    dashboardId: string,
    requester: Requester,
    ctx: TransactionContext,
  ): Promise<Dashboard> {
    const dashboard = await this.dashboardRepository.findById(dashboardId, ctx);
    if (!dashboard || !this.belongsToRequester(dashboard, requester)) {
      throw new DashboardNotFoundError(dashboardId);
    }
    return dashboard;
  }

  private belongsToRequester(dashboard: Dashboard, requester: Requester): boolean {
    return requester.role === UserRole.SuperAdmin || dashboard.companyId === requester.companyId;
  }
}
