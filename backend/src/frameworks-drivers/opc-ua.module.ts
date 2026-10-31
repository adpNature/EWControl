import { Module } from '@nestjs/common';
import { createNodeOpcUaDriver } from '../interface-adapters/data-providers/opc-ua/node-opcua.driver';
import { OPCUA_DRIVER_FACTORY } from '../interface-adapters/data-providers/opc-ua/opc-ua-driver.port';
import { OpcUaProviderRegistry } from '../interface-adapters/data-providers/opc-ua/opc-ua-provider.registry';
import { NestEventEmitterPublisher } from '../interface-adapters/events/nest-event-emitter.publisher';
import { MachineConnectionTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/machine-connection.typeorm-repository';
import { MachineTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/machine.typeorm-repository';
import { TypeOrmUnitOfWork } from '../interface-adapters/persistence/postgres/typeorm/typeorm-unit-of-work';
import { SystemClock } from '../interface-adapters/system/system-clock';
import { CLOCK } from '../use-cases/history/ports/clock.port';
import { MACHINE_CONNECTION_REPOSITORY } from '../use-cases/seed-demo-environment/ports/machine-connection-repository.port';
import { MACHINE_REPOSITORY } from '../use-cases/seed-demo-environment/ports/machine-repository.port';
import { UNIT_OF_WORK } from '../use-cases/seed-demo-environment/ports/unit-of-work.port';
import { EVENT_PUBLISHER } from '../use-cases/simulator-control/ports/event-publisher.port';
import { MACHINE_WRITER } from '../use-cases/write-packages/ports/machine-writer.port';
import { MetricsModule } from './metrics.module';
import { SimulatorModule } from './simulator.module';

/**
 * Wiring de docs/specs/18-integracion-opc-ua.md: el `OpcUaProviderRegistry`
 * con el driver real de `node-opcua`. Importa `SimulatorModule` únicamente por
 * `IngestSignalTickUseCase` (misma instancia del Signal Engine y de su
 * `RAW_VARIABLE_CACHE` que el Simulador) y `MetricsModule` por el registro
 * Prometheus compartido. Exporta el registry como `MACHINE_WRITER`
 * (docs/specs/20-paquetes-escritura-opc-ua.md) para escribir con sus sesiones.
 */
@Module({
  imports: [SimulatorModule, MetricsModule],
  providers: [
    OpcUaProviderRegistry,
    { provide: OPCUA_DRIVER_FACTORY, useValue: createNodeOpcUaDriver },
    { provide: MACHINE_REPOSITORY, useClass: MachineTypeOrmRepository },
    { provide: MACHINE_CONNECTION_REPOSITORY, useClass: MachineConnectionTypeOrmRepository },
    { provide: UNIT_OF_WORK, useClass: TypeOrmUnitOfWork },
    { provide: EVENT_PUBLISHER, useClass: NestEventEmitterPublisher },
    { provide: CLOCK, useClass: SystemClock },
    { provide: MACHINE_WRITER, useExisting: OpcUaProviderRegistry },
  ],
  exports: [MACHINE_WRITER],
})
export class OpcUaModule {}
