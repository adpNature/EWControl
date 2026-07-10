import { Module } from '@nestjs/common';
import { MachineConnectionTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/machine-connection.typeorm-repository';
import { MachineTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/machine.typeorm-repository';
import { SignalTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/signal.typeorm-repository';
import { TypeOrmUnitOfWork } from '../interface-adapters/persistence/postgres/typeorm/typeorm-unit-of-work';
import { MachineConnectionController } from '../interface-adapters/rest/machine-management/machine-connection.controller';
import { MachineController } from '../interface-adapters/rest/machine-management/machine.controller';
import { SignalController } from '../interface-adapters/rest/machine-management/signal.controller';
import { MACHINE_CONNECTION_REPOSITORY } from '../use-cases/seed-demo-environment/ports/machine-connection-repository.port';
import { MACHINE_REPOSITORY } from '../use-cases/seed-demo-environment/ports/machine-repository.port';
import { SIGNAL_REPOSITORY } from '../use-cases/seed-demo-environment/ports/signal-repository.port';
import { UNIT_OF_WORK } from '../use-cases/seed-demo-environment/ports/unit-of-work.port';
import { CreateMachineUseCase } from '../use-cases/machine-management/create-machine.use-case';
import { CreateSignalUseCase } from '../use-cases/machine-management/create-signal.use-case';
import { DeleteMachineUseCase } from '../use-cases/machine-management/delete-machine.use-case';
import { DeleteSignalUseCase } from '../use-cases/machine-management/delete-signal.use-case';
import { GetMachineConnectionUseCase } from '../use-cases/machine-management/get-machine-connection.use-case';
import { GetMachineUseCase } from '../use-cases/machine-management/get-machine.use-case';
import { GetSignalUseCase } from '../use-cases/machine-management/get-signal.use-case';
import { ListMachinesUseCase } from '../use-cases/machine-management/list-machines.use-case';
import { ListSignalsUseCase } from '../use-cases/machine-management/list-signals.use-case';
import { MachineAccessResolver } from '../use-cases/machine-management/machine-access.resolver';
import { ReplaceMachineConnectionUseCase } from '../use-cases/machine-management/replace-machine-connection.use-case';
import { UpdateMachineUseCase } from '../use-cases/machine-management/update-machine.use-case';
import { UpdateSignalUseCase } from '../use-cases/machine-management/update-signal.use-case';

/**
 * Wiring de docs/specs/06-gestion-machines-signals.md: conecta los use-cases de
 * `machine-management` con TypeORM, mismo estilo que `simulator.module.ts`.
 * No registra `APP_GUARD` — el `JwtAuthGuard` ya es global (`auth.module.ts`).
 */
@Module({
  controllers: [MachineController, MachineConnectionController, SignalController],
  providers: [
    MachineAccessResolver,
    CreateMachineUseCase,
    ListMachinesUseCase,
    GetMachineUseCase,
    UpdateMachineUseCase,
    DeleteMachineUseCase,
    GetMachineConnectionUseCase,
    ReplaceMachineConnectionUseCase,
    CreateSignalUseCase,
    ListSignalsUseCase,
    GetSignalUseCase,
    UpdateSignalUseCase,
    DeleteSignalUseCase,
    { provide: MACHINE_REPOSITORY, useClass: MachineTypeOrmRepository },
    { provide: MACHINE_CONNECTION_REPOSITORY, useClass: MachineConnectionTypeOrmRepository },
    { provide: SIGNAL_REPOSITORY, useClass: SignalTypeOrmRepository },
    { provide: UNIT_OF_WORK, useClass: TypeOrmUnitOfWork },
  ],
})
export class MachineManagementModule {}
