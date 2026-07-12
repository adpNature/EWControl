import { DashboardWidget } from '../../../entities/dashboard-widget.entity';
import type { WidgetConfig } from '../../../entities/widget-config.vo';
import { WidgetType } from '../../../entities/widget-type.enum';
import { TransactionContext } from '../../seed-demo-environment/ports/transaction-context';

export const DASHBOARD_WIDGET_REPOSITORY = Symbol('DashboardWidgetRepository');

export interface IDashboardWidgetRepository {
  create(
    data: {
      dashboardId: string;
      widgetType: WidgetType;
      widgetConfig: WidgetConfig;
      position: number;
      signalIds: string[];
    },
    ctx: TransactionContext,
  ): Promise<DashboardWidget>;
  /** Widget con sus Signals referenciadas ya cargadas (relación `signals`). */
  findById(id: string, ctx: TransactionContext): Promise<DashboardWidget | null>;
  findAllByDashboardId(dashboardId: string, ctx: TransactionContext): Promise<DashboardWidget[]>;
  update(
    id: string,
    changes: Partial<{ widgetConfig: WidgetConfig; position: number; signalIds: string[] }>,
    ctx: TransactionContext,
  ): Promise<DashboardWidget>;
  delete(id: string, ctx: TransactionContext): Promise<void>;
}
