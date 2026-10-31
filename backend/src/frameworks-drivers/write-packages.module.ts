import { Module } from '@nestjs/common';
import { NestEventEmitterPublisher } from '../interface-adapters/events/nest-event-emitter.publisher';
import { MachineConnectionTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/machine-connection.typeorm-repository';
import { MachineTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/machine.typeorm-repository';
import { TypeOrmUnitOfWork } from '../interface-adapters/persistence/postgres/typeorm/typeorm-unit-of-work';
import { WritePackageExecutionTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/write-package-execution.typeorm-repository';
import { WritePackageTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/write-package.typeorm-repository';
import { WritePackageController } from '../interface-adapters/rest/write-packages/write-package.controller';
import { SystemClock } from '../interface-adapters/system/system-clock';
import { CLOCK } from '../use-cases/history/ports/clock.port';
import { MachineAccessResolver } from '../use-cases/machine-management/machine-access.resolver';
import { MACHINE_CONNECTION_REPOSITORY } from '../use-cases/seed-demo-environment/ports/machine-connection-repository.port';
import { MACHINE_REPOSITORY } from '../use-cases/seed-demo-environment/ports/machine-repository.port';
import { UNIT_OF_WORK } from '../use-cases/seed-demo-environment/ports/unit-of-work.port';
import { EVENT_PUBLISHER } from '../use-cases/simulator-control/ports/event-publisher.port';
import { ExecuteWritePackageUseCase } from '../use-cases/write-packages/execute-write-package.use-case';
import { WRITE_PACKAGE_EXECUTION_REPOSITORY } from '../use-cases/write-packages/ports/write-package-execution-repository.port';
import { WRITE_PACKAGE_REPOSITORY } from '../use-cases/write-packages/ports/write-package-repository.port';
import { WritePackageAccessResolver } from '../use-cases/write-packages/write-package-access.resolver';
import {
  CreateWritePackageUseCase,
  DeactivateWritePackageUseCase,
  GetWritePackageUseCase,
  ListWritePackageExecutionsUseCase,
  ListWritePackagesUseCase,
  UpdateWritePackageUseCase,
} from '../use-cases/write-packages/write-package-management.use-cases';
import { MetricsModule } from './metrics.module';
import { OpcUaModule } from './opc-ua.module';

/**
 * Wiring de docs/specs/20-paquetes-escritura-opc-ua.md: gestión, ejecución y
 * auditoría de paquetes de escritura. Importa `OpcUaModule` por `MACHINE_WRITER`
 * (el `OpcUaProviderRegistry`, misma instancia que mantiene las sesiones OPC UA)
 * y `MetricsModule` por `METRICS_RECORDER`.
 */
@Module({
  imports: [OpcUaModule, MetricsModule],
  controllers: [WritePackageController],
  providers: [
    MachineAccessResolver,
    WritePackageAccessResolver,
    ListWritePackagesUseCase,
    GetWritePackageUseCase,
    CreateWritePackageUseCase,
    UpdateWritePackageUseCase,
    DeactivateWritePackageUseCase,
    ExecuteWritePackageUseCase,
    ListWritePackageExecutionsUseCase,
    { provide: MACHINE_REPOSITORY, useClass: MachineTypeOrmRepository },
    { provide: MACHINE_CONNECTION_REPOSITORY, useClass: MachineConnectionTypeOrmRepository },
    { provide: WRITE_PACKAGE_REPOSITORY, useClass: WritePackageTypeOrmRepository },
    {
      provide: WRITE_PACKAGE_EXECUTION_REPOSITORY,
      useClass: WritePackageExecutionTypeOrmRepository,
    },
    { provide: UNIT_OF_WORK, useClass: TypeOrmUnitOfWork },
    { provide: CLOCK, useClass: SystemClock },
    { provide: EVENT_PUBLISHER, useClass: NestEventEmitterPublisher },
  ],
})
export class WritePackagesModule {}
