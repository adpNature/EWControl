import { Module } from '@nestjs/common';
import { MachineTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/machine.typeorm-repository';
import { TypeOrmUnitOfWork } from '../interface-adapters/persistence/postgres/typeorm/typeorm-unit-of-work';
import { VariableCategoryTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/variable-category.typeorm-repository';
import { VariableCategoryController } from '../interface-adapters/rest/variable-categories/variable-category.controller';
import { MachineAccessResolver } from '../use-cases/machine-management/machine-access.resolver';
import { MACHINE_REPOSITORY } from '../use-cases/seed-demo-environment/ports/machine-repository.port';
import { UNIT_OF_WORK } from '../use-cases/seed-demo-environment/ports/unit-of-work.port';
import { VARIABLE_CATEGORY_REPOSITORY } from '../use-cases/variable-categories/ports/variable-category-repository.port';
import {
  ImportVariableCategoriesUseCase,
  ListVariableCategoriesUseCase,
  RenameVariableCategoryUseCase,
} from '../use-cases/variable-categories/variable-categories.use-cases';

/** Wiring de docs/specs/23-categorias-variables-plc.md: categorías de variables del PLC por Machine. */
@Module({
  controllers: [VariableCategoryController],
  providers: [
    MachineAccessResolver,
    ListVariableCategoriesUseCase,
    ImportVariableCategoriesUseCase,
    RenameVariableCategoryUseCase,
    { provide: MACHINE_REPOSITORY, useClass: MachineTypeOrmRepository },
    { provide: VARIABLE_CATEGORY_REPOSITORY, useClass: VariableCategoryTypeOrmRepository },
    { provide: UNIT_OF_WORK, useClass: TypeOrmUnitOfWork },
  ],
})
export class VariableCategoriesModule {}
