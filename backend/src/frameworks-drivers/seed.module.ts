import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ENTITIES } from '../entities';
import { CompanyTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/company.typeorm-repository';
import { MachineConnectionTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/machine-connection.typeorm-repository';
import { MachineTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/machine.typeorm-repository';
import { SignalTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/signal.typeorm-repository';
import { TypeOrmSchemaReadinessChecker } from '../interface-adapters/persistence/postgres/typeorm/typeorm-schema-readiness.checker';
import { TypeOrmUnitOfWork } from '../interface-adapters/persistence/postgres/typeorm/typeorm-unit-of-work';
import { UserTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/user.typeorm-repository';
import { BcryptPasswordHasher } from '../interface-adapters/security/bcrypt-password-hasher';
import { COMPANY_REPOSITORY } from '../use-cases/seed-demo-environment/ports/company-repository.port';
import { MACHINE_CONNECTION_REPOSITORY } from '../use-cases/seed-demo-environment/ports/machine-connection-repository.port';
import { MACHINE_REPOSITORY } from '../use-cases/seed-demo-environment/ports/machine-repository.port';
import { PASSWORD_HASHER } from '../use-cases/seed-demo-environment/ports/password-hasher.port';
import { SCHEMA_READINESS_CHECKER } from '../use-cases/seed-demo-environment/ports/schema-readiness-checker.port';
import { SIGNAL_REPOSITORY } from '../use-cases/seed-demo-environment/ports/signal-repository.port';
import { UNIT_OF_WORK } from '../use-cases/seed-demo-environment/ports/unit-of-work.port';
import { USER_REPOSITORY } from '../use-cases/seed-demo-environment/ports/user-repository.port';
import { SeedDemoEnvironmentUseCase } from '../use-cases/seed-demo-environment/seed-demo-environment.use-case';
import { postgresConnectionOptions } from './database/postgres.config';

/**
 * Módulo de arranque para `src/seed.ts`: un contexto Nest sin HTTP, separado de
 * `AppModule` para no acoplar el seed al logging HTTP de Pino.
 */
@Module({
  imports: [
    TypeOrmModule.forRoot({
      ...postgresConnectionOptions(),
      entities: ENTITIES,
    }),
  ],
  providers: [
    SeedDemoEnvironmentUseCase,
    { provide: COMPANY_REPOSITORY, useClass: CompanyTypeOrmRepository },
    { provide: USER_REPOSITORY, useClass: UserTypeOrmRepository },
    { provide: MACHINE_REPOSITORY, useClass: MachineTypeOrmRepository },
    { provide: MACHINE_CONNECTION_REPOSITORY, useClass: MachineConnectionTypeOrmRepository },
    { provide: SIGNAL_REPOSITORY, useClass: SignalTypeOrmRepository },
    { provide: PASSWORD_HASHER, useClass: BcryptPasswordHasher },
    { provide: UNIT_OF_WORK, useClass: TypeOrmUnitOfWork },
    { provide: SCHEMA_READINESS_CHECKER, useClass: TypeOrmSchemaReadinessChecker },
  ],
})
export class SeedModule {}
