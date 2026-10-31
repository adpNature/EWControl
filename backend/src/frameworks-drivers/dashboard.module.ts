import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { InMemoryRealtimeCache, REALTIME_CACHE } from '../entities/realtime-cache';
import { NestEventEmitterPublisher } from '../interface-adapters/events/nest-event-emitter.publisher';
import { MachineDisconnectedListener } from '../interface-adapters/events/machine-disconnected.listener';
import { MachineTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/machine.typeorm-repository';
import { DashboardTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/dashboard.typeorm-repository';
import { DashboardWidgetTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/dashboard-widget.typeorm-repository';
import { SignalTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/signal.typeorm-repository';
import { TypeOrmUnitOfWork } from '../interface-adapters/persistence/postgres/typeorm/typeorm-unit-of-work';
import { DashboardWidgetController } from '../interface-adapters/rest/dashboard/dashboard-widget.controller';
import { DashboardController } from '../interface-adapters/rest/dashboard/dashboard.controller';
import { JwtTokenService } from '../interface-adapters/security/jwt-token.service';
import { SystemClock } from '../interface-adapters/system/system-clock';
import { RealtimeGateway } from '../interface-adapters/websocket/realtime.gateway';
import { TOKEN_SERVICE } from '../use-cases/auth/ports/token.port';
import { CLOCK } from '../use-cases/history/ports/clock.port';
import { DashboardAccessResolver } from '../use-cases/dashboard/dashboard-access.resolver';
import { CreateDashboardUseCase } from '../use-cases/dashboard/create-dashboard.use-case';
import { CreateWidgetUseCase } from '../use-cases/dashboard/create-widget.use-case';
import { DeleteDashboardUseCase } from '../use-cases/dashboard/delete-dashboard.use-case';
import { DeleteWidgetUseCase } from '../use-cases/dashboard/delete-widget.use-case';
import { GetDashboardUseCase } from '../use-cases/dashboard/get-dashboard.use-case';
import { ListDashboardsUseCase } from '../use-cases/dashboard/list-dashboards.use-case';
import { MarkMachineSignalsOfflineUseCase } from '../use-cases/dashboard/mark-machine-signals-offline.use-case';
import { DASHBOARD_REPOSITORY } from '../use-cases/dashboard/ports/dashboard-repository.port';
import { DASHBOARD_WIDGET_REPOSITORY } from '../use-cases/dashboard/ports/dashboard-widget-repository.port';
import { UpdateDashboardUseCase } from '../use-cases/dashboard/update-dashboard.use-case';
import { UpdateWidgetUseCase } from '../use-cases/dashboard/update-widget.use-case';
import { MACHINE_REPOSITORY } from '../use-cases/seed-demo-environment/ports/machine-repository.port';
import { SIGNAL_REPOSITORY } from '../use-cases/seed-demo-environment/ports/signal-repository.port';
import { WritePackageTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/write-package.typeorm-repository';
import { WRITE_PACKAGE_REPOSITORY } from '../use-cases/write-packages/ports/write-package-repository.port';
import { UNIT_OF_WORK } from '../use-cases/seed-demo-environment/ports/unit-of-work.port';
import { EVENT_PUBLISHER } from '../use-cases/simulator-control/ports/event-publisher.port';
import { MetricsModule } from './metrics.module';

/**
 * Wiring de docs/specs/07-dashboard-tiempo-real.md. Dueño único de `REALTIME_CACHE`
 * (lo exporta): a diferencia de los repositorios TypeORM, que sí se duplican por
 * módulo por convención porque envuelven el mismo Postgres, la Realtime Cache es
 * estado en memoria — dos instancias serían dos mapas desincronizados. `SimulatorModule`
 * y `MachineManagementModule` importan este módulo únicamente por ese token.
 */
@Module({
  imports: [JwtModule.register({}), MetricsModule],
  controllers: [DashboardController, DashboardWidgetController],
  providers: [
    { provide: REALTIME_CACHE, useClass: InMemoryRealtimeCache },
    RealtimeGateway,
    DashboardAccessResolver,
    CreateDashboardUseCase,
    ListDashboardsUseCase,
    GetDashboardUseCase,
    UpdateDashboardUseCase,
    DeleteDashboardUseCase,
    CreateWidgetUseCase,
    UpdateWidgetUseCase,
    DeleteWidgetUseCase,
    MarkMachineSignalsOfflineUseCase,
    MachineDisconnectedListener,
    { provide: DASHBOARD_REPOSITORY, useClass: DashboardTypeOrmRepository },
    { provide: DASHBOARD_WIDGET_REPOSITORY, useClass: DashboardWidgetTypeOrmRepository },
    { provide: SIGNAL_REPOSITORY, useClass: SignalTypeOrmRepository },
    { provide: MACHINE_REPOSITORY, useClass: MachineTypeOrmRepository },
    // docs/specs/20-paquetes-escritura-opc-ua.md: validar el paquete de un widget PACKAGE.
    { provide: WRITE_PACKAGE_REPOSITORY, useClass: WritePackageTypeOrmRepository },
    { provide: UNIT_OF_WORK, useClass: TypeOrmUnitOfWork },
    { provide: EVENT_PUBLISHER, useClass: NestEventEmitterPublisher },
    { provide: TOKEN_SERVICE, useClass: JwtTokenService },
    { provide: CLOCK, useClass: SystemClock },
  ],
  exports: [REALTIME_CACHE],
})
export class DashboardModule {}
