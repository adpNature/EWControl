/**
 * Test de integración (Documento 0, "Pirámide de Testing") de
 * docs/specs/23-categorias-variables-plc.md: arranca `VariableCategoriesModule`
 * real contra el Postgres de `docker compose`, sin pasar por HTTP. Cubre el
 * flujo importar → listar → renombrar → reimportar, que ejercita el
 * repositorio (borrado e inserción en una transacción, enlace padre/hija,
 * `ON DELETE CASCADE` desde la Machine).
 */
import { INestApplicationContext } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { UserRole } from '../src/entities/user-role.enum';
import { SeedModule } from '../src/frameworks-drivers/seed.module';
import { VariableCategoriesModule } from '../src/frameworks-drivers/variable-categories.module';
import { InvalidGvlExportError } from '../src/use-cases/variable-categories/errors/invalid-gvl-export.error';
import {
  ImportVariableCategoriesUseCase,
  ListVariableCategoriesUseCase,
  RenameVariableCategoryUseCase,
} from '../src/use-cases/variable-categories/variable-categories.use-cases';

const ROOT = 'ns=4;s=|var|PLC.Application.GVL_HMI';
const HASH = '#'.repeat(20);
const STAR = '*'.repeat(20);
const CSV = [
  'Type,Name,Address,DataType,InitValue,Comment,Attribute',
  'VAR_GLOBAL CONSTANT,ciPagina,,INT,1,,',
  `VAR_GLOBAL,iPagina,,INT,,"${HASH}\n PAGINA RECETA \n${HASH}\n${STAR}\n PROGRAMACION \n${STAR}",`,
  'VAR_GLOBAL,xHome,,BOOL,,Home,',
  `VAR_GLOBAL,rLimite,,REAL,,"${STAR}\n LIMITES \n${STAR}",`,
].join('\n');

describe('Categorías de variables del PLC (integration)', () => {
  let app: INestApplicationContext;
  let dataSource: DataSource;
  let importUseCase: ImportVariableCategoriesUseCase;
  let listUseCase: ListVariableCategoriesUseCase;
  let renameUseCase: RenameVariableCategoryUseCase;
  let machineId: string;
  let requester: { companyId: string; role: UserRole };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [SeedModule, VariableCategoriesModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    dataSource = app.get(getDataSourceToken());
    importUseCase = app.get(ImportVariableCategoriesUseCase);
    listUseCase = app.get(ListVariableCategoriesUseCase);
    renameUseCase = app.get(RenameVariableCategoryUseCase);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE "variable_catalog_entries", "variable_categories", "machines", "companies" RESTART IDENTITY CASCADE',
    );
    const [company] = await dataSource.query(
      "INSERT INTO companies (name, is_active) VALUES ('Empresa', true) RETURNING id",
    );
    const [machine] = await dataSource.query(
      "INSERT INTO machines (company_id, name, is_active) VALUES ($1, 'Bobinadora', true) RETURNING id",
      [company.id],
    );
    machineId = machine.id;
    requester = { companyId: company.id, role: UserRole.AdminCliente };
  });

  it('importa, lista con recuentos, renombra y reimporta sustituyendo todo', async () => {
    const summary = await importUseCase.execute({
      machineId,
      requester,
      rootNodeId: ROOT,
      csv: CSV,
    });
    expect(summary).toMatchObject({
      categories: 1,
      subcategories: 2,
      variables: 4,
      uncategorized: 1,
    });

    const listed = await listUseCase.execute({ machineId, requester });
    expect(listed.categories.map((category) => [category.name, category.variableCount])).toEqual([
      ['Pagina receta', 3],
      ['Programacion', 2],
      ['Limites', 1],
    ]);
    const [parent, programacion] = listed.categories;
    expect(programacion.parentId).toBe(parent.id);
    expect(listed.variables.map((variable) => variable.nodeId)).toEqual([
      `${ROOT}.ciPagina`,
      `${ROOT}.iPagina`,
      `${ROOT}.xHome`,
      `${ROOT}.rLimite`,
    ]);
    expect(listed.variables[2]).toMatchObject({ categoryId: programacion.id, comment: 'Home' });

    const renamed = await renameUseCase.execute({
      machineId,
      categoryId: parent.id,
      requester,
      name: 'Página programación receta',
    });
    expect(renamed.name).toBe('Página programación receta');

    await importUseCase.execute({ machineId, requester, rootNodeId: ROOT, csv: CSV });
    const [count] = await dataSource.query(
      'SELECT COUNT(*)::int AS total FROM variable_categories WHERE machine_id = $1',
      [machineId],
    );
    expect(count.total).toBe(3);
  });

  it('un CSV no válido no borra lo que había', async () => {
    await importUseCase.execute({ machineId, requester, rootNodeId: ROOT, csv: CSV });

    await expect(
      importUseCase.execute({ machineId, requester, rootNodeId: ROOT, csv: 'Type,Name\nX,a' }),
    ).rejects.toBeInstanceOf(InvalidGvlExportError);

    const listed = await listUseCase.execute({ machineId, requester });
    expect(listed.categories).toHaveLength(3);
  });

  it('borrar la Machine físicamente borra sus categorías y su catálogo', async () => {
    await importUseCase.execute({ machineId, requester, rootNodeId: ROOT, csv: CSV });

    await dataSource.query('DELETE FROM machines WHERE id = $1', [machineId]);

    const [categories] = await dataSource.query(
      'SELECT COUNT(*)::int AS total FROM variable_categories',
    );
    const [entries] = await dataSource.query(
      'SELECT COUNT(*)::int AS total FROM variable_catalog_entries',
    );
    expect([categories.total, entries.total]).toEqual([0, 0]);
  });
});
