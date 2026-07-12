import { Module } from '@nestjs/common';
import { SimulationProviderRegistry } from '../interface-adapters/data-providers/simulation/simulation-provider.registry';
import { NestEventEmitterPublisher } from '../interface-adapters/events/nest-event-emitter.publisher';
import { MachineConnectionTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/machine-connection.typeorm-repository';
import { MachineTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/machine.typeorm-repository';
import { SignalTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/signal.typeorm-repository';
import { TypeOrmUnitOfWork } from '../interface-adapters/persistence/postgres/typeorm/typeorm-unit-of-work';
import { SimulatorController } from '../interface-adapters/rest/simulator/simulator.controller';
import { MathRandomSource } from '../interface-adapters/system/math-random-source';
import { SystemClock } from '../interface-adapters/system/system-clock';
import { DashboardModule } from './dashboard.module';
import { HistoryPersistenceModule } from './history-persistence.module';
import { IngestSignalTickUseCase } from '../use-cases/dashboard/ingest-signal-tick.use-case';
import { CLOCK } from '../use-cases/history/ports/clock.port';
import { RANDOM_SOURCE } from '../use-cases/history/ports/random-source.port';
import { SeedHistoryUseCase } from '../use-cases/history/seed-history.use-case';
import { MACHINE_CONNECTION_REPOSITORY } from '../use-cases/seed-demo-environment/ports/machine-connection-repository.port';
import { MACHINE_REPOSITORY } from '../use-cases/seed-demo-environment/ports/machine-repository.port';
import { SIGNAL_REPOSITORY } from '../use-cases/seed-demo-environment/ports/signal-repository.port';
import { UNIT_OF_WORK } from '../use-cases/seed-demo-environment/ports/unit-of-work.port';
import { EVENT_PUBLISHER } from '../use-cases/simulator-control/ports/event-publisher.port';
import { SIMULATOR_RUNTIME } from '../use-cases/simulator-control/ports/simulator-runtime.port';
import { ForceDisconnectSimulatorUseCase } from '../use-cases/simulator-control/force-disconnect-simulator.use-case';
import { ForceSignalQualityUseCase } from '../use-cases/simulator-control/force-signal-quality.use-case';
import { ReconnectSimulatorUseCase } from '../use-cases/simulator-control/reconnect-simulator.use-case';
import { SimulatorMachineResolver } from '../use-cases/simulator-control/simulator-machine-resolver';

/**
 * Wiring de las specs 03-simulador-forzar-fallo.md, 04-simulador-seed-historico.md,
 * 07-dashboard-tiempo-real.md y 08-historicos.md: conecta los puertos de
 * `simulator-control` y `history` con sus implementaciones concretas (TypeORM,
 * EventEmitter2, el registry de `SimulationProvider`), igual que `seed.module.ts`
 * para el seed. Importa `DashboardModule` únicamente por el token compartido
 * `REALTIME_CACHE`, que consume `IngestSignalTickUseCase` al procesar cada tick
 * del Simulador, y `HistoryPersistenceModule` por `HISTORY_WRITER` (persistencia
 * continua a InfluxDB y backfill puntual del seed).
 */
@Module({
  imports: [DashboardModule, HistoryPersistenceModule],
  controllers: [SimulatorController],
  providers: [
    ForceDisconnectSimulatorUseCase,
    ReconnectSimulatorUseCase,
    ForceSignalQualityUseCase,
    SeedHistoryUseCase,
    SimulatorMachineResolver,
    SimulationProviderRegistry,
    IngestSignalTickUseCase,
    { provide: MACHINE_REPOSITORY, useClass: MachineTypeOrmRepository },
    { provide: MACHINE_CONNECTION_REPOSITORY, useClass: MachineConnectionTypeOrmRepository },
    { provide: SIGNAL_REPOSITORY, useClass: SignalTypeOrmRepository },
    { provide: UNIT_OF_WORK, useClass: TypeOrmUnitOfWork },
    { provide: SIMULATOR_RUNTIME, useExisting: SimulationProviderRegistry },
    { provide: EVENT_PUBLISHER, useClass: NestEventEmitterPublisher },
    { provide: CLOCK, useClass: SystemClock },
    { provide: RANDOM_SOURCE, useClass: MathRandomSource },
  ],
})
export class SimulatorModule {}
