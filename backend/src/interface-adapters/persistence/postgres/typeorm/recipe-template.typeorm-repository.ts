import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { RecipeTemplate } from '../../../../entities/recipe-template.entity';
import type { RecipeTemplateContent } from '../../../../entities/recipe-template.vo';
import type { IRecipeTemplateRepository } from '../../../../use-cases/recipes/ports/recipe-template-repository.port';
import { TransactionContext } from '../../../../use-cases/seed-demo-environment/ports/transaction-context';

/** docs/specs/26-receta-base.md: receta base en PostgreSQL (tabla `recipe_templates`). */
@Injectable()
export class RecipeTemplateTypeOrmRepository implements IRecipeTemplateRepository {
  findByMachineId(machineId: string, ctx: TransactionContext): Promise<RecipeTemplate | null> {
    return repositoryOf(ctx).findOne({ where: { machineId } });
  }

  async save(
    machineId: string,
    expectedVersion: number,
    content: RecipeTemplateContent,
    by: { actorEmail: string; at: Date },
    ctx: TransactionContext,
  ): Promise<RecipeTemplate | null> {
    const repository = repositoryOf(ctx);
    if (expectedVersion === 0) {
      // `ON CONFLICT DO NOTHING`: si otro administrador la creó entretanto, no se pisa.
      const result = await repository
        .createQueryBuilder()
        .insert()
        .into(RecipeTemplate)
        .values({
          machineId,
          variables: content.variables,
          layout: content.layout,
          version: 1,
          createdAt: by.at,
          updatedAt: by.at,
          updatedByEmail: by.actorEmail,
        })
        .orIgnore()
        .returning('id')
        .execute();
      return (result.raw as unknown[]).length > 0
        ? repository.findOneByOrFail({ machineId })
        : null;
    }
    const result = await repository
      .createQueryBuilder()
      .update(RecipeTemplate)
      .set({
        variables: content.variables,
        layout: content.layout,
        updatedAt: by.at,
        updatedByEmail: by.actorEmail,
        version: () => 'version + 1',
      })
      .where('machine_id = :machineId AND version = :expectedVersion', {
        machineId,
        expectedVersion,
      })
      .execute();
    return result.affected ? repository.findOneByOrFail({ machineId }) : null;
  }
}

function repositoryOf(ctx: TransactionContext) {
  return (ctx as EntityManager).getRepository(RecipeTemplate);
}
