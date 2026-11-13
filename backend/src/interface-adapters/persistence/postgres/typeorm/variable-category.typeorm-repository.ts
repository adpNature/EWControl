import { Injectable } from '@nestjs/common';
import { EntityManager } from 'typeorm';
import { VariableCatalogEntry } from '../../../../entities/variable-catalog-entry.entity';
import { VariableCategory } from '../../../../entities/variable-category.entity';
import type { TransactionContext } from '../../../../use-cases/seed-demo-environment/ports/transaction-context';
import type {
  IVariableCategoryRepository,
  NewVariableCatalogEntry,
  NewVariableCategory,
} from '../../../../use-cases/variable-categories/ports/variable-category-repository.port';

/** Filas por `INSERT` del catálogo: muy por debajo del límite de parámetros de PostgreSQL. */
const INSERT_CHUNK_SIZE = 500;

/** docs/specs/23-categorias-variables-plc.md: categorías y catálogo de variables en PostgreSQL. */
@Injectable()
export class VariableCategoryTypeOrmRepository implements IVariableCategoryRepository {
  async replaceForMachine(
    machineId: string,
    categories: readonly NewVariableCategory[],
    entries: readonly NewVariableCatalogEntry[],
    ctx: TransactionContext,
  ): Promise<void> {
    const manager = ctx as EntityManager;
    await manager.getRepository(VariableCatalogEntry).delete({ machineId });
    await manager.getRepository(VariableCategory).delete({ machineId });

    // Las padres siempre tienen una `key` menor que sus hijas: se insertan en orden.
    const idByKey = new Map<number, string>();
    const categoryRepository = manager.getRepository(VariableCategory);
    for (const category of [...categories].sort((a, b) => a.key - b.key)) {
      const saved = await categoryRepository.save(
        categoryRepository.create({
          machineId,
          parentId: category.parentKey === null ? null : (idByKey.get(category.parentKey) ?? null),
          name: category.name,
          position: category.position,
        }),
      );
      idByKey.set(category.key, saved.id);
    }

    const rows = entries.map((entry) => ({
      machineId,
      nodeId: entry.nodeId,
      categoryId: entry.categoryKey === null ? null : (idByKey.get(entry.categoryKey) ?? null),
      comment: entry.comment,
      position: entry.position,
    }));
    for (let start = 0; start < rows.length; start += INSERT_CHUNK_SIZE) {
      await manager
        .getRepository(VariableCatalogEntry)
        .insert(rows.slice(start, start + INSERT_CHUNK_SIZE));
    }
  }

  listCategories(machineId: string, ctx: TransactionContext): Promise<VariableCategory[]> {
    return (ctx as EntityManager)
      .getRepository(VariableCategory)
      .find({ where: { machineId }, order: { position: 'ASC' } });
  }

  listEntries(machineId: string, ctx: TransactionContext): Promise<VariableCatalogEntry[]> {
    return (ctx as EntityManager)
      .getRepository(VariableCatalogEntry)
      .find({ where: { machineId }, order: { position: 'ASC' } });
  }

  findCategory(
    machineId: string,
    categoryId: string,
    ctx: TransactionContext,
  ): Promise<VariableCategory | null> {
    return (ctx as EntityManager)
      .getRepository(VariableCategory)
      .findOne({ where: { id: categoryId, machineId } });
  }

  async rename(
    categoryId: string,
    name: string,
    ctx: TransactionContext,
  ): Promise<VariableCategory> {
    const repository = (ctx as EntityManager).getRepository(VariableCategory);
    await repository.update({ id: categoryId }, { name });
    return repository.findOneByOrFail({ id: categoryId });
  }
}
