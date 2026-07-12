import { Inject, Injectable } from '@nestjs/common';
import type { WidgetConfig } from '../../entities/widget-config.vo';
import { WidgetType } from '../../entities/widget-type.enum';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import { DashboardAccessResolver, Requester } from './dashboard-access.resolver';
import {
  DASHBOARD_WIDGET_REPOSITORY,
  type IDashboardWidgetRepository,
} from './ports/dashboard-widget-repository.port';

export type GetDashboardInput = { dashboardId: string; requester: Requester };

export type ResolvedWidgetSignal = { id: string; name: string; unit: string; machineId: string };
export type DashboardWidgetView = {
  id: string;
  widgetType: WidgetType;
  widgetConfig: WidgetConfig;
  position: number;
  signals: ResolvedWidgetSignal[];
};
export type DashboardDetail = {
  id: string;
  companyId: string;
  name: string;
  widgets: DashboardWidgetView[];
};

/**
 * docs/specs/07-dashboard-tiempo-real.md, criterio de aceptación backend 5:
 * cada widget se devuelve con sus Signals ya resueltas (`{ id, name, unit, machineId }`),
 * no solo el id, para que el Frontend no necesite peticiones adicionales.
 */
@Injectable()
export class GetDashboardUseCase {
  constructor(
    private readonly resolver: DashboardAccessResolver,
    @Inject(DASHBOARD_WIDGET_REPOSITORY)
    private readonly widgetRepository: IDashboardWidgetRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  execute(input: GetDashboardInput): Promise<DashboardDetail> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const dashboard = await this.resolver.resolveAny(input.dashboardId, input.requester, ctx);
      const widgets = await this.widgetRepository.findAllByDashboardId(dashboard.id, ctx);
      return {
        id: dashboard.id,
        companyId: dashboard.companyId,
        name: dashboard.name,
        widgets: widgets.map((widget) => ({
          id: widget.id,
          widgetType: widget.widgetType,
          widgetConfig: widget.widgetConfig,
          position: widget.position,
          signals: widget.signals.map((signal) => ({
            id: signal.id,
            name: signal.name,
            unit: signal.unit,
            machineId: signal.machineId,
          })),
        })),
      };
    });
  }
}
