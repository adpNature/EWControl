import { Inject, Injectable } from '@nestjs/common';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import { DashboardAccessResolver, Requester } from './dashboard-access.resolver';
import { WidgetNotFoundError } from './errors/widget-not-found.error';
import {
  DASHBOARD_WIDGET_REPOSITORY,
  type IDashboardWidgetRepository,
} from './ports/dashboard-widget-repository.port';

export type DeleteWidgetInput = { dashboardId: string; widgetId: string; requester: Requester };

/** docs/specs/07-dashboard-tiempo-real.md, criterio de aceptación backend 6. */
@Injectable()
export class DeleteWidgetUseCase {
  constructor(
    private readonly resolver: DashboardAccessResolver,
    @Inject(DASHBOARD_WIDGET_REPOSITORY)
    private readonly widgetRepository: IDashboardWidgetRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
  ) {}

  execute(input: DeleteWidgetInput): Promise<void> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const dashboard = await this.resolver.resolveAny(input.dashboardId, input.requester, ctx);
      const widget = await this.widgetRepository.findById(input.widgetId, ctx);
      if (!widget || widget.dashboardId !== dashboard.id) {
        throw new WidgetNotFoundError(input.widgetId);
      }
      await this.widgetRepository.delete(widget.id, ctx);
    });
  }
}
