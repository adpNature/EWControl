import { Module } from '@nestjs/common';
import { MachineConnectionTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/machine-connection.typeorm-repository';
import { MachineTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/machine.typeorm-repository';
import { CompanyTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/company.typeorm-repository';
import { SignalTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/signal.typeorm-repository';
import { TypeOrmUnitOfWork } from '../interface-adapters/persistence/postgres/typeorm/typeorm-unit-of-work';
import { UserTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/user.typeorm-repository';
import { CompanyController } from '../interface-adapters/rest/company-management/company.controller';
import { SystemClock } from '../interface-adapters/system/system-clock';
import { CLOCK } from '../use-cases/history/ports/clock.port';
import { MACHINE_CONNECTION_REPOSITORY } from '../use-cases/seed-demo-environment/ports/machine-connection-repository.port';
import { MACHINE_REPOSITORY } from '../use-cases/seed-demo-environment/ports/machine-repository.port';
import { COMPANY_REPOSITORY } from '../use-cases/seed-demo-environment/ports/company-repository.port';
import { SIGNAL_REPOSITORY } from '../use-cases/seed-demo-environment/ports/signal-repository.port';
import { UNIT_OF_WORK } from '../use-cases/seed-demo-environment/ports/unit-of-work.port';
import { USER_REPOSITORY } from '../use-cases/seed-demo-environment/ports/user-repository.port';
import { CreateCompanyUseCase } from '../use-cases/company-management/create-company.use-case';
import { DeactivateCompanyUseCase } from '../use-cases/company-management/deactivate-company.use-case';
import { DeleteCompanyPermanentlyUseCase } from '../use-cases/company-management/delete-company-permanently.use-case';
import { GetCompanyUseCase } from '../use-cases/company-management/get-company.use-case';
import { ListCompaniesUseCase } from '../use-cases/company-management/list-companies.use-case';
import { ReactivateCompanyUseCase } from '../use-cases/company-management/reactivate-company.use-case';
import { UpdateCompanyUseCase } from '../use-cases/company-management/update-company.use-case';
import { HistoryPersistenceModule } from './history-persistence.module';

/**
 * Wiring de docs/specs/10-gestion-companies-users.md (Company): mismo estilo
 * que `machine-management.module.ts`. No registra `APP_GUARD` — `JwtAuthGuard`
 * y `RolesGuard` ya son globales (`auth.module.ts`). Necesita
 * `MACHINE_REPOSITORY`/`SIGNAL_REPOSITORY`/`MACHINE_CONNECTION_REPOSITORY`/
 * `USER_REPOSITORY` además de `COMPANY_REPOSITORY` para
 * `DeleteCompanyPermanentlyUseCase` (borrado físico en cascada); importa
 * `HistoryPersistenceModule` únicamente por `HISTORY_WRITER`, que ese mismo
 * use-case usa para borrar el histórico de InfluxDB de la Company.
 */
@Module({
  imports: [HistoryPersistenceModule],
  controllers: [CompanyController],
  providers: [
    CreateCompanyUseCase,
    ListCompaniesUseCase,
    GetCompanyUseCase,
    UpdateCompanyUseCase,
    DeactivateCompanyUseCase,
    ReactivateCompanyUseCase,
    DeleteCompanyPermanentlyUseCase,
    { provide: COMPANY_REPOSITORY, useClass: CompanyTypeOrmRepository },
    { provide: MACHINE_REPOSITORY, useClass: MachineTypeOrmRepository },
    { provide: SIGNAL_REPOSITORY, useClass: SignalTypeOrmRepository },
    { provide: MACHINE_CONNECTION_REPOSITORY, useClass: MachineConnectionTypeOrmRepository },
    { provide: USER_REPOSITORY, useClass: UserTypeOrmRepository },
    { provide: UNIT_OF_WORK, useClass: TypeOrmUnitOfWork },
    { provide: CLOCK, useClass: SystemClock },
  ],
})
export class CompanyManagementModule {}
