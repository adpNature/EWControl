import { Module } from '@nestjs/common';
import { NodeOpcUaExplorer } from '../interface-adapters/data-providers/opc-ua/node-opcua.explorer';
import { NestEventEmitterPublisher } from '../interface-adapters/events/nest-event-emitter.publisher';
import { MachineConnectionTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/machine-connection.typeorm-repository';
import { MachineTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/machine.typeorm-repository';
import { SignalTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/signal.typeorm-repository';
import { TypeOrmUnitOfWork } from '../interface-adapters/persistence/postgres/typeorm/typeorm-unit-of-work';
import { SignalsHistoryController } from '../interface-adapters/rest/history/signals-history.controller';
import { MachineConnectionController } from '../interface-adapters/rest/machine-management/machine-connection.controller';
import { MachineController } from '../interface-adapters/rest/machine-management/machine.controller';
import { SignalController } from '../interface-adapters/rest/machine-management/signal.controller';
import { opcuaAllowedHosts } from './config/opcua.config';
import { DashboardModule } from './dashboard.module';
import { HistoryPersistenceModule } from './history-persistence.module';
import { MACHINE_CONNECTION_REPOSITORY } from '../use-cases/seed-demo-environment/ports/machine-connection-repository.port';
import { MACHINE_REPOSITORY } from '../use-cases/seed-demo-environment/ports/machine-repository.port';
import { SIGNAL_REPOSITORY } from '../use-cases/seed-demo-environment/ports/signal-repository.port';
import { UNIT_OF_WORK } from '../use-cases/seed-demo-environment/ports/unit-of-work.port';
import { EVENT_PUBLISHER } from '../use-cases/simulator-control/ports/event-publisher.port';
import { BrowseOpcUaNodesUseCase } from '../use-cases/machine-management/browse-opc-ua-nodes.use-case';
import { CreateMachineUseCase } from '../use-cases/machine-management/create-machine.use-case';
import { CreateSignalUseCase } from '../use-cases/machine-management/create-signal.use-case';
import { DeleteMachineUseCase } from '../use-cases/machine-management/delete-machine.use-case';
import { DeleteSignalUseCase } from '../use-cases/machine-management/delete-signal.use-case';
import { GetMachineConnectionUseCase } from '../use-cases/machine-management/get-machine-connection.use-case';
import { GetMachineUseCase } from '../use-cases/machine-management/get-machine.use-case';
import { GetSignalUseCase } from '../use-cases/machine-management/get-signal.use-case';
import { GetSignalValueUseCase } from '../use-cases/machine-management/get-signal-value.use-case';
import { ListMachinesUseCase } from '../use-cases/machine-management/list-machines.use-case';
import { ListSignalsUseCase } from '../use-cases/machine-management/list-signals.use-case';
import { MachineAccessResolver } from '../use-cases/machine-management/machine-access.resolver';
import { OpcUaEndpointPolicy } from '../use-cases/machine-management/opc-ua-endpoint-policy';
import { OPCUA_ALLOWED_HOSTS } from '../use-cases/machine-management/ports/opc-ua-allowed-hosts.token';
import { OPCUA_EXPLORER } from '../use-cases/machine-management/ports/opc-ua-explorer.port';
import { ReplaceMachineConnectionUseCase } from '../use-cases/machine-management/replace-machine-connection.use-case';
import { TestOpcUaConnectionUseCase } from '../use-cases/machine-management/test-opc-ua-connection.use-case';
import { UpdateMachineUseCase } from '../use-cases/machine-management/update-machine.use-case';
import { UpdateSignalUseCase } from '../use-cases/machine-management/update-signal.use-case';
import { GetSignalHistoryUseCase } from '../use-cases/history/get-signal-history.use-case';
import { GetSignalsHistoryUseCase } from '../use-cases/history/get-signals-history.use-case';

/**
 * Wiring de docs/specs/06-gestion-machines-signals.md: conecta los use-cases de
 * `machine-management` con TypeORM, mismo estilo que `simulator.module.ts`.
 * No registra `APP_GUARD` — el `JwtAuthGuard` ya es global (`auth.module.ts`).
 * Importa `DashboardModule` únicamente por `REALTIME_CACHE`, que consume
 * `GetSignalValueUseCase` (docs/specs/07-dashboard-tiempo-real.md), y
 * `HistoryPersistenceModule` por `HISTORY_READER`, que consume
 * `GetSignalHistoryUseCase` (docs/specs/08-historicos.md) y
 * `GetSignalsHistoryUseCase` (docs/specs/14-historicos-comparativas.md).
 * docs/specs/18-integracion-opc-ua.md añade la prueba de conexión y la
 * exploración de nodos OPC UA (`NodeOpcUaExplorer`, sesiones efímeras), la
 * allowlist anti-SSRF `OPCUA_ALLOWED_HOSTS` y el `EVENT_PUBLISHER` con el que
 * se avisa a los registries de Data Providers de un cambio de conexión o una baja.
 */
@Module({
  imports: [DashboardModule, HistoryPersistenceModule],
  controllers: [
    MachineController,
    MachineConnectionController,
    SignalController,
    SignalsHistoryController,
  ],
  providers: [
    MachineAccessResolver,
    CreateMachineUseCase,
    ListMachinesUseCase,
    GetMachineUseCase,
    UpdateMachineUseCase,
    DeleteMachineUseCase,
    GetMachineConnectionUseCase,
    ReplaceMachineConnectionUseCase,
    TestOpcUaConnectionUseCase,
    BrowseOpcUaNodesUseCase,
    OpcUaEndpointPolicy,
    CreateSignalUseCase,
    ListSignalsUseCase,
    GetSignalUseCase,
    GetSignalValueUseCase,
    GetSignalHistoryUseCase,
    GetSignalsHistoryUseCase,
    UpdateSignalUseCase,
    DeleteSignalUseCase,
    { provide: MACHINE_REPOSITORY, useClass: MachineTypeOrmRepository },
    { provide: MACHINE_CONNECTION_REPOSITORY, useClass: MachineConnectionTypeOrmRepository },
    { provide: SIGNAL_REPOSITORY, useClass: SignalTypeOrmRepository },
    { provide: UNIT_OF_WORK, useClass: TypeOrmUnitOfWork },
    { provide: EVENT_PUBLISHER, useClass: NestEventEmitterPublisher },
    { provide: OPCUA_EXPLORER, useClass: NodeOpcUaExplorer },
    { provide: OPCUA_ALLOWED_HOSTS, useFactory: opcuaAllowedHosts },
  ],
})
export class MachineManagementModule {}
