import { Module } from '@nestjs/common';
import { CompanyTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/company.typeorm-repository';
import { TypeOrmUnitOfWork } from '../interface-adapters/persistence/postgres/typeorm/typeorm-unit-of-work';
import { CompanyController } from '../interface-adapters/rest/company-management/company.controller';
import { COMPANY_REPOSITORY } from '../use-cases/seed-demo-environment/ports/company-repository.port';
import { UNIT_OF_WORK } from '../use-cases/seed-demo-environment/ports/unit-of-work.port';
import { CreateCompanyUseCase } from '../use-cases/company-management/create-company.use-case';
import { DeactivateCompanyUseCase } from '../use-cases/company-management/deactivate-company.use-case';
import { GetCompanyUseCase } from '../use-cases/company-management/get-company.use-case';
import { ListCompaniesUseCase } from '../use-cases/company-management/list-companies.use-case';
import { UpdateCompanyUseCase } from '../use-cases/company-management/update-company.use-case';

/**
 * Wiring de docs/specs/10-gestion-companies-users.md (Company): mismo estilo
 * que `machine-management.module.ts`. No registra `APP_GUARD` — `JwtAuthGuard`
 * y `RolesGuard` ya son globales (`auth.module.ts`).
 */
@Module({
  controllers: [CompanyController],
  providers: [
    CreateCompanyUseCase,
    ListCompaniesUseCase,
    GetCompanyUseCase,
    UpdateCompanyUseCase,
    DeactivateCompanyUseCase,
    { provide: COMPANY_REPOSITORY, useClass: CompanyTypeOrmRepository },
    { provide: UNIT_OF_WORK, useClass: TypeOrmUnitOfWork },
  ],
})
export class CompanyManagementModule {}
