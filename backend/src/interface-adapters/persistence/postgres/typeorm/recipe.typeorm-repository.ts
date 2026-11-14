import { Injectable } from '@nestjs/common';
import { EntityManager, QueryFailedError } from 'typeorm';
import { Recipe } from '../../../../entities/recipe.entity';
import { RecipeTitleTakenError } from '../../../../use-cases/recipes/errors/recipe-title-taken.error';
import type {
  IRecipeRepository,
  RecipeContent,
  RecipeListQuery,
} from '../../../../use-cases/recipes/ports/recipe-repository.port';
import { TransactionContext } from '../../../../use-cases/seed-demo-environment/ports/transaction-context';

const TITLE_UNIQUE_INDEX = 'UQ_recipes_machine_title_key';

/** docs/specs/25-recetas.md: recetas en PostgreSQL (tabla `recipes`). */
@Injectable()
export class RecipeTypeOrmRepository implements IRecipeRepository {
  countByMachine(machineId: string, ctx: TransactionContext): Promise<number> {
    return repositoryOf(ctx).count({ where: { machineId } });
  }

  findById(id: string, ctx: TransactionContext): Promise<Recipe | null> {
    return repositoryOf(ctx).findOne({ where: { id } });
  }

  findByTitleKey(
    machineId: string,
    titleKey: string,
    ctx: TransactionContext,
  ): Promise<Recipe | null> {
    return repositoryOf(ctx).findOne({ where: { machineId, titleKey } });
  }

  async list(
    machineId: string,
    query: RecipeListQuery,
    ctx: TransactionContext,
  ): Promise<{ data: Recipe[]; total: number }> {
    const builder = repositoryOf(ctx)
      .createQueryBuilder('recipe')
      .where('recipe.machine_id = :machineId', { machineId });
    if (query.search) {
      // `%`, `_` y `\` del texto se escapan para que no actúen como comodines (OWASP A03).
      builder.andWhere("recipe.search_key LIKE :search ESCAPE '\\'", {
        search: `%${query.search.replace(/[\\%_]/g, (char) => `\\${char}`)}%`,
      });
    }
    const [data, total] = await builder
      .orderBy('recipe.is_activated', 'DESC')
      .addOrderBy('recipe.updated_at', 'DESC')
      .addOrderBy('recipe.id', 'ASC')
      .take(query.limit)
      .skip(query.offset)
      .getManyAndCount();
    return { data, total };
  }

  async create(
    data: RecipeContent & { machineId: string; actorEmail: string; at: Date },
    ctx: TransactionContext,
  ): Promise<Recipe> {
    const repository = repositoryOf(ctx);
    const { actorEmail, at, ...content } = data;
    const saved = await withTitleConflict(content.title, () =>
      repository.save(
        repository.create({
          ...content,
          createdAt: at,
          createdByEmail: actorEmail,
          updatedAt: at,
          updatedByEmail: actorEmail,
        }),
      ),
    );
    return repository.findOneByOrFail({ id: saved.id });
  }

  async update(
    id: string,
    expectedVersion: number,
    data: RecipeContent & { actorEmail: string; at: Date },
    ctx: TransactionContext,
  ): Promise<Recipe | null> {
    const repository = repositoryOf(ctx);
    const { actorEmail, at, ...content } = data;
    const result = await withTitleConflict(content.title, () =>
      repository
        .createQueryBuilder()
        .update(Recipe)
        .set({
          ...content,
          updatedAt: at,
          updatedByEmail: actorEmail,
          version: () => 'version + 1',
        })
        .where('id = :id AND version = :expectedVersion', { id, expectedVersion })
        .execute(),
    );
    return result.affected ? repository.findOneByOrFail({ id }) : null;
  }

  async delete(id: string, ctx: TransactionContext): Promise<void> {
    await repositoryOf(ctx).delete({ id });
  }

  async activate(
    machineId: string,
    id: string,
    by: { actorEmail: string; at: Date },
    ctx: TransactionContext,
  ): Promise<Recipe> {
    const manager = ctx as EntityManager;
    // Serializa las activaciones de la Machine: la segunda espera a la primera y
    // después desmarca la que esta dejó activa (índice único parcial como red).
    await manager.query('SELECT id FROM machines WHERE id = $1 FOR UPDATE', [machineId]);
    const repository = repositoryOf(ctx);
    await repository.update(
      { machineId, isActivated: true },
      { isActivated: false, activatedAt: null, activatedByEmail: null },
    );
    await repository.update(
      { id },
      { isActivated: true, activatedAt: by.at, activatedByEmail: by.actorEmail },
    );
    return repository.findOneByOrFail({ id });
  }

  async deactivate(id: string, ctx: TransactionContext): Promise<Recipe> {
    const repository = repositoryOf(ctx);
    await repository.update(
      { id },
      { isActivated: false, activatedAt: null, activatedByEmail: null },
    );
    return repository.findOneByOrFail({ id });
  }
}

function repositoryOf(ctx: TransactionContext) {
  return (ctx as EntityManager).getRepository(Recipe);
}

/** Traduce la violación del índice único de títulos (petición simultánea) a `RecipeTitleTakenError`. */
async function withTitleConflict<T>(title: string, work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    const driverError = (
      error as QueryFailedError & { driverError?: { code?: string; constraint?: string } }
    ).driverError;
    if (
      error instanceof QueryFailedError &&
      driverError?.code === '23505' &&
      driverError.constraint === TITLE_UNIQUE_INDEX
    ) {
      throw new RecipeTitleTakenError(title);
    }
    throw error;
  }
}
