import { Module } from '@nestjs/common';
import { MachineConnectionTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/machine-connection.typeorm-repository';
import { MachineTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/machine.typeorm-repository';
import { RecipeTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/recipe.typeorm-repository';
import { TypeOrmUnitOfWork } from '../interface-adapters/persistence/postgres/typeorm/typeorm-unit-of-work';
import { VariableCategoryTypeOrmRepository } from '../interface-adapters/persistence/postgres/typeorm/variable-category.typeorm-repository';
import { RecipeController } from '../interface-adapters/rest/recipes/recipe.controller';
import { SystemClock } from '../interface-adapters/system/system-clock';
import { CLOCK } from '../use-cases/history/ports/clock.port';
import { MachineAccessResolver } from '../use-cases/machine-management/machine-access.resolver';
import { RECIPE_REPOSITORY } from '../use-cases/recipes/ports/recipe-repository.port';
import { RecipeAccessResolver } from '../use-cases/recipes/recipe-access.resolver';
import {
  ActivateRecipeUseCase,
  CreateRecipeUseCase,
  DeactivateRecipeUseCase,
  DeleteRecipeUseCase,
  GetRecipeUseCase,
  GetRecipeVariablesUseCase,
  ListRecipesUseCase,
  UpdateRecipeUseCase,
} from '../use-cases/recipes/recipes.use-cases';
import { MACHINE_CONNECTION_REPOSITORY } from '../use-cases/seed-demo-environment/ports/machine-connection-repository.port';
import { MACHINE_REPOSITORY } from '../use-cases/seed-demo-environment/ports/machine-repository.port';
import { UNIT_OF_WORK } from '../use-cases/seed-demo-environment/ports/unit-of-work.port';
import { VARIABLE_CATEGORY_REPOSITORY } from '../use-cases/variable-categories/ports/variable-category-repository.port';

/**
 * Wiring de docs/specs/25-recetas.md: recetas por Machine. Solo PostgreSQL; no
 * depende de `OpcUaModule` porque las recetas no se comunican con el PLC.
 */
@Module({
  controllers: [RecipeController],
  providers: [
    MachineAccessResolver,
    RecipeAccessResolver,
    GetRecipeVariablesUseCase,
    ListRecipesUseCase,
    GetRecipeUseCase,
    CreateRecipeUseCase,
    UpdateRecipeUseCase,
    DeleteRecipeUseCase,
    ActivateRecipeUseCase,
    DeactivateRecipeUseCase,
    { provide: MACHINE_REPOSITORY, useClass: MachineTypeOrmRepository },
    { provide: MACHINE_CONNECTION_REPOSITORY, useClass: MachineConnectionTypeOrmRepository },
    { provide: VARIABLE_CATEGORY_REPOSITORY, useClass: VariableCategoryTypeOrmRepository },
    { provide: RECIPE_REPOSITORY, useClass: RecipeTypeOrmRepository },
    { provide: UNIT_OF_WORK, useClass: TypeOrmUnitOfWork },
    { provide: CLOCK, useClass: SystemClock },
  ],
})
export class RecipesModule {}
