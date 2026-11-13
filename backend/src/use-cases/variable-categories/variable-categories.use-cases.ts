import { Inject, Injectable } from '@nestjs/common';
import { MAX_NODE_ID_LENGTH } from '../../entities/connection-config.vo';
import { catalogNodeId, GVL_EXPORT_LIMITS, parseGvlExport } from '../../entities/gvl-export';
import type { VariableCategory } from '../../entities/variable-category.entity';
import { type IUnitOfWork, UNIT_OF_WORK } from '../seed-demo-environment/ports/unit-of-work.port';
import {
  assertMachineActive,
  MachineAccessResolver,
  type Requester,
} from '../machine-management/machine-access.resolver';
import { InvalidGvlExportError } from './errors/invalid-gvl-export.error';
import { InvalidVariableCategoryNameError } from './errors/invalid-variable-category-name.error';
import { VariableCategoryNameTakenError } from './errors/variable-category-name-taken.error';
import { VariableCategoryNotFoundError } from './errors/variable-category-not-found.error';
import {
  type IVariableCategoryRepository,
  VARIABLE_CATEGORY_REPOSITORY,
} from './ports/variable-category-repository.port';

export type ImportVariableCategoriesInput = {
  machineId: string;
  requester: Requester;
  /** NodeId de la carpeta de la GVL en el servidor OPC UA. */
  rootNodeId: string;
  csv: string;
};

export type ImportVariableCategoriesSummary = {
  categories: number;
  subcategories: number;
  variables: number;
  categorized: number;
  uncategorized: number;
  withComment: number;
};

/**
 * docs/specs/23-categorias-variables-plc.md, criterios backend 4 y 5: importa la
 * exportación CSV de la GVL y sustituye, en una transacción, todas las
 * categorías y el catálogo de la Machine. Nunca toca el `nodeMapping` ni el PLC.
 */
@Injectable()
export class ImportVariableCategoriesUseCase {
  constructor(
    private readonly resolver: MachineAccessResolver,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
    @Inject(VARIABLE_CATEGORY_REPOSITORY)
    private readonly repository: IVariableCategoryRepository,
  ) {}

  /**
   * @throws InvalidGvlExportError si el CSV o la carpeta no son válidos.
   * @throws MachineNotFoundError / MachineInactiveError.
   */
  async execute(input: ImportVariableCategoriesInput): Promise<ImportVariableCategoriesSummary> {
    const rootNodeId = input.rootNodeId.trim();
    if (rootNodeId.length === 0 || rootNodeId.length > MAX_NODE_ID_LENGTH) {
      throw new InvalidGvlExportError(
        `La carpeta OPC UA debe tener entre 1 y ${MAX_NODE_ID_LENGTH} caracteres.`,
      );
    }
    if (input.csv.length > GVL_EXPORT_LIMITS.maxCsvLength) {
      throw new InvalidGvlExportError(
        `El CSV supera los ${GVL_EXPORT_LIMITS.maxCsvLength} caracteres.`,
      );
    }
    const parsed = parseGvlExport(input.csv);
    if (!parsed.ok) {
      throw new InvalidGvlExportError(parsed.reason);
    }
    const { categories, variables } = parsed.export;

    await this.unitOfWork.runInTransaction(async (ctx) => {
      const machine = await this.resolver.resolveAny(input.machineId, input.requester, ctx);
      assertMachineActive(machine);
      await this.repository.replaceForMachine(
        machine.id,
        categories,
        variables.map((variable) => ({
          nodeId: catalogNodeId(rootNodeId, variable.name),
          categoryKey: variable.categoryKey,
          comment: variable.comment,
          position: variable.position,
        })),
        ctx,
      );
    });

    const categorized = variables.filter((variable) => variable.categoryKey !== null).length;
    return {
      categories: categories.filter((category) => category.parentKey === null).length,
      subcategories: categories.filter((category) => category.parentKey !== null).length,
      variables: variables.length,
      categorized,
      uncategorized: variables.length - categorized,
      withComment: variables.filter((variable) => variable.comment !== null).length,
    };
  }
}

export type VariableCategoryView = {
  id: string;
  parentId: string | null;
  name: string;
  position: number;
  /** Variables de la categoría; en las raíz, también las de sus subcategorías. */
  variableCount: number;
};

export type VariableCatalogEntryView = {
  nodeId: string;
  categoryId: string | null;
  comment: string | null;
  position: number;
};

export type VariableCategoryList = {
  categories: VariableCategoryView[];
  variables: VariableCatalogEntryView[];
};

/** docs/specs/23-categorias-variables-plc.md, criterio backend 6: árbol y catálogo de una Machine. */
@Injectable()
export class ListVariableCategoriesUseCase {
  constructor(
    private readonly resolver: MachineAccessResolver,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
    @Inject(VARIABLE_CATEGORY_REPOSITORY)
    private readonly repository: IVariableCategoryRepository,
  ) {}

  /** @throws MachineNotFoundError. */
  execute(input: { machineId: string; requester: Requester }): Promise<VariableCategoryList> {
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const machine = await this.resolver.resolveAny(input.machineId, input.requester, ctx);
      const [categories, entries] = await Promise.all([
        this.repository.listCategories(machine.id, ctx),
        this.repository.listEntries(machine.id, ctx),
      ]);

      const parentOf = new Map(categories.map((category) => [category.id, category.parentId]));
      const counts = new Map<string, number>();
      for (const entry of entries) {
        let categoryId = entry.categoryId;
        while (categoryId) {
          counts.set(categoryId, (counts.get(categoryId) ?? 0) + 1);
          categoryId = parentOf.get(categoryId) ?? null;
        }
      }

      return {
        categories: categories.map((category) => ({
          id: category.id,
          parentId: category.parentId,
          name: category.name,
          position: category.position,
          variableCount: counts.get(category.id) ?? 0,
        })),
        variables: entries.map((entry) => ({
          nodeId: entry.nodeId,
          categoryId: entry.categoryId,
          comment: entry.comment,
          position: entry.position,
        })),
      };
    });
  }
}

export type RenameVariableCategoryInput = {
  machineId: string;
  categoryId: string;
  requester: Requester;
  name: string;
};

/**
 * docs/specs/23-categorias-variables-plc.md, criterio backend 7: renombra una
 * categoría validando la longitud y que no repita el nombre de una hermana
 * (sin distinguir mayúsculas).
 */
@Injectable()
export class RenameVariableCategoryUseCase {
  constructor(
    private readonly resolver: MachineAccessResolver,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork,
    @Inject(VARIABLE_CATEGORY_REPOSITORY)
    private readonly repository: IVariableCategoryRepository,
  ) {}

  /**
   * @throws InvalidVariableCategoryNameError / VariableCategoryNameTakenError.
   * @throws VariableCategoryNotFoundError si la categoría no es de esa Machine.
   * @throws MachineNotFoundError / MachineInactiveError.
   */
  async execute(input: RenameVariableCategoryInput): Promise<VariableCategory> {
    const name = input.name.trim();
    if (name.length === 0 || name.length > GVL_EXPORT_LIMITS.maxCategoryNameLength) {
      throw new InvalidVariableCategoryNameError(GVL_EXPORT_LIMITS.maxCategoryNameLength);
    }
    return this.unitOfWork.runInTransaction(async (ctx) => {
      const machine = await this.resolver.resolveAny(input.machineId, input.requester, ctx);
      assertMachineActive(machine);
      const category = await this.repository.findCategory(machine.id, input.categoryId, ctx);
      if (!category) {
        throw new VariableCategoryNotFoundError(input.categoryId);
      }
      const siblings = await this.repository.listCategories(machine.id, ctx);
      const taken = siblings.some(
        (sibling) =>
          sibling.id !== category.id &&
          sibling.parentId === category.parentId &&
          sibling.name.localeCompare(name, 'es', { sensitivity: 'base' }) === 0,
      );
      if (taken) {
        throw new VariableCategoryNameTakenError(name);
      }
      return this.repository.rename(category.id, name, ctx);
    });
  }
}
