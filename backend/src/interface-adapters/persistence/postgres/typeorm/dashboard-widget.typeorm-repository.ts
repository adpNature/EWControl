import { Injectable } from '@nestjs/common';
import { EntityManager, In } from 'typeorm';
import { DashboardWidget } from '../../../../entities/dashboard-widget.entity';
import { Signal } from '../../../../entities/signal.entity';
import type { WidgetConfig } from '../../../../entities/widget-config.vo';
import { WidgetType } from '../../../../entities/widget-type.enum';
import { IDashboardWidgetRepository } from '../../../../use-cases/dashboard/ports/dashboard-widget-repository.port';
import { TransactionContext } from '../../../../use-cases/seed-demo-environment/ports/transaction-context';

@Injectable()
export class DashboardWidgetTypeOrmRepository implements IDashboardWidgetRepository {
  async create(
    data: {
      dashboardId: string;
      widgetType: WidgetType;
      widgetConfig: WidgetConfig;
      position: number;
      signalIds: string[];
    },
    ctx: TransactionContext,
  ): Promise<DashboardWidget> {
    const repository = (ctx as EntityManager).getRepository(DashboardWidget);
    const signals = await this.findSignals(data.signalIds, ctx);
    const widget = repository.create({
      dashboardId: data.dashboardId,
      widgetType: data.widgetType,
      widgetConfig: data.widgetConfig,
      position: data.position,
      signals,
    });
    return repository.save(widget);
  }

  findById(id: string, ctx: TransactionContext): Promise<DashboardWidget | null> {
    return (ctx as EntityManager)
      .getRepository(DashboardWidget)
      .findOne({ where: { id }, relations: ['signals'] });
  }

  findAllByDashboardId(dashboardId: string, ctx: TransactionContext): Promise<DashboardWidget[]> {
    return (ctx as EntityManager)
      .getRepository(DashboardWidget)
      .find({ where: { dashboardId }, relations: ['signals'], order: { position: 'ASC' } });
  }

  async update(
    id: string,
    changes: Partial<{ widgetConfig: WidgetConfig; position: number; signalIds: string[] }>,
    ctx: TransactionContext,
  ): Promise<DashboardWidget> {
    const repository = (ctx as EntityManager).getRepository(DashboardWidget);
    const widget = await repository.findOneOrFail({ where: { id }, relations: ['signals'] });
    if (changes.widgetConfig !== undefined) {
      widget.widgetConfig = changes.widgetConfig;
    }
    if (changes.position !== undefined) {
      widget.position = changes.position;
    }
    if (changes.signalIds !== undefined) {
      widget.signals = await this.findSignals(changes.signalIds, ctx);
    }
    return repository.save(widget);
  }

  async delete(id: string, ctx: TransactionContext): Promise<void> {
    await (ctx as EntityManager).getRepository(DashboardWidget).delete(id);
  }

  private findSignals(signalIds: string[], ctx: TransactionContext): Promise<Signal[]> {
    if (signalIds.length === 0) {
      return Promise.resolve([]);
    }
    return (ctx as EntityManager).getRepository(Signal).findBy({ id: In(signalIds) });
  }
}
