import { Inject, Injectable } from '@nestjs/common';
import { DashboardWidget } from '../../entities/dashboard-widget.entity';
import type { WidgetConfig } from '../../entities/widget-config.vo';
import { WidgetType } from '../../entities/widget-type.enum';
import {
  type IMachineRepository,
  MACHINE_REPOSITORY,
} from '../seed-demo-environment/ports/machine-repository.port';
import {
  type ISignalRepository,
  SIGNAL_REPOSITORY,
} from '../seed-demo-environment/ports/signal-repository.port';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import { DashboardAccessResolver, Requester } from './dashboard-access.resolver';
import {
  DASHBOARD_WIDGET_REPOSITORY,
  type IDashboardWidgetRepository,
} from './ports/dashboard-widget-repository.port';
import { validateWidgetSignalIds } from './validate-widget-signal-ids';

export type CreateWidgetInput = {
  dashboardId: string;
  requester: Requester;
  widgetType: WidgetType;
  widgetConfig: WidgetConfig;
  signalIds: string[];
  position?: number;
};

/** docs/specs/07-dashboard-tiempo-real.md, criterio de aceptación backend 7. */
@Injectable()
export class CreateWidgetUseCase {
  constructor(
    private readonly resolver: DashboardAccessResolver,
    @Inject(DASHBOARD_WIDGET_REPOSITORY)
    private readonly widgetRepository: IDashboardWidgetRepository,
    @Inject(SIGNAL_REPOSITORY) private readonly signalRepository: ISignalRepository,
    @Inject(MACHINE_REPOSITORY) private readonly machineRepository: IMachineRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  execute(input: CreateWidgetInput): Promise<DashboardWidget> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const dashboard = await this.resolver.resolveAny(input.dashboardId, input.requester, ctx);
      await validateWidgetSignalIds(
        input.signalIds,
        dashboard.companyId,
        { signalRepository: this.signalRepository, machineRepository: this.machineRepository },
        ctx,
      );
      return this.widgetRepository.create(
        {
          dashboardId: dashboard.id,
          widgetType: input.widgetType,
          widgetConfig: input.widgetConfig,
          position: input.position ?? 0,
          signalIds: input.signalIds,
        },
        ctx,
      );
    });
  }
}
