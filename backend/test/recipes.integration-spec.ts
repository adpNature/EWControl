/**
 * Test de integración (Documento 0, "Pirámide de Testing") de
 * docs/specs/25-recetas.md: arranca `RecipesModule` real contra el Postgres de
 * `docker compose`, sin pasar por HTTP. Un único flujo ejercita lo que no cubren
 * los unitarios: el buscador sin tildes (`search_key`), el control de versión
 * en el `UPDATE`, el índice parcial de «una receta activa por Machine» y que
 * reimportar la GVL deja incompleta una receta sin borrarla.
 */
import { INestApplicationContext } from '@nestjs/common';
import { getDataSourceToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { UserRole } from '../src/entities/user-role.enum';
import { RecipesModule } from '../src/frameworks-drivers/recipes.module';
import { SeedModule } from '../src/frameworks-drivers/seed.module';
import { VariableCategoriesModule } from '../src/frameworks-drivers/variable-categories.module';
import { RecipeIncompleteError } from '../src/use-cases/recipes/errors/recipe-incomplete.error';
import { RecipeModifiedError } from '../src/use-cases/recipes/errors/recipe-modified.error';
import { RecipeTitleTakenError } from '../src/use-cases/recipes/errors/recipe-title-taken.error';
import {
  ActivateRecipeUseCase,
  CreateRecipeUseCase,
  GetRecipeUseCase,
  ListRecipesUseCase,
  UpdateRecipeUseCase,
} from '../src/use-cases/recipes/recipes.use-cases';
import { ImportVariableCategoriesUseCase } from '../src/use-cases/variable-categories/variable-categories.use-cases';

const ROOT = 'ns=4;s=|var|PLC.Application.GVL_HMI';
const HASH = '#'.repeat(20);
const STAR = '*'.repeat(20);

function gvlCsv(recipeVariables: string[]): string {
  return [
    'Type,Name,Address,DataType,InitValue,Comment,Attribute',
    `VAR_GLOBAL,iPagina,,INT,,"${HASH}\n PAGINA PROGRAMACION RECETA \n${HASH}\n${STAR}\n PROGRAMACION PARA LA RECETA \n${STAR}",`,
    ...recipeVariables.map((name) => `VAR_GLOBAL,${name},,REAL,,,`),
    `VAR_GLOBAL,rMinEspiras,,REAL,,"${STAR}\n LIMITES DE LOS DATOS DE LA RECETA \n${STAR}",`,
  ].join('\n');
}

function mapping(name: string, dataType: string) {
  return { nodeId: `${ROOT}.${name}`, signalVariableName: name, dataType };
}

describe('Recetas (integration)', () => {
  let app: INestApplicationContext;
  let dataSource: DataSource;
  let machineId: string;
  const requester = { companyId: '', role: UserRole.Operador };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [SeedModule, VariableCategoriesModule, RecipesModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    dataSource = app.get(getDataSourceToken());
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE "recipes", "variable_catalog_entries", "variable_categories", "machine_connections", "machines", "companies" RESTART IDENTITY CASCADE',
    );
    const [company] = await dataSource.query(
      "INSERT INTO companies (name, is_active) VALUES ('Empresa', true) RETURNING id",
    );
    const [machine] = await dataSource.query(
      "INSERT INTO machines (company_id, name, is_active) VALUES ($1, 'Bobinadora', true) RETURNING id",
      [company.id],
    );
    machineId = machine.id;
    requester.companyId = company.id;
    await dataSource.query(
      "INSERT INTO machine_connections (machine_id, provider_type, connection_config) VALUES ($1, 'OpcUa', $2)",
      [
        machineId,
        JSON.stringify({
          endpointUrl: 'opc.tcp://127.0.0.1:4840',
          securityMode: 'None',
          securityPolicy: 'None',
          authMode: 'Anonymous',
          timeoutMs: 5000,
          samplingIntervalMs: 1000,
          nodeMapping: [
            mapping('rEspiras', 'Float'),
            mapping('xSentido', 'Boolean'),
            mapping('rVelocidad', 'Float'),
            mapping('rMinEspiras', 'Float'),
          ],
        }),
      ],
    );
    await app.get(ImportVariableCategoriesUseCase).execute({
      machineId,
      requester: { ...requester, role: UserRole.AdminCliente },
      rootNodeId: ROOT,
      csv: gvlCsv(['rEspiras', 'xSentido']),
    });
  });

  it('crea, busca sin tildes, controla la versión, activa una sola y queda incompleta al reimportar', async () => {
    const create = app.get(CreateRecipeUseCase);
    const values = [
      { signalVariableName: 'rEspiras', value: 350 },
      { signalVariableName: 'xSentido', value: true },
    ];
    const first = await create.execute({
      machineId,
      requester,
      actorEmail: 'operador@ewcontrol.local',
      title: 'Programación A',
      values,
    });
    const second = await create.execute({
      machineId,
      requester,
      actorEmail: 'operador@ewcontrol.local',
      title: 'Bobina B',
      description: 'Cliente Norte',
      values,
    });
    await expect(
      create.execute({ machineId, requester, actorEmail: 'x', title: 'programacion a', values }),
    ).rejects.toBeInstanceOf(RecipeTitleTakenError);

    const list = app.get(ListRecipesUseCase);
    const found = await list.execute({
      machineId,
      requester,
      search: 'PROGRAMACION',
      limit: 20,
      offset: 0,
    });
    expect(found.data.map((recipe) => recipe.title)).toEqual(['Programación A']);
    const byDescription = await list.execute({
      machineId,
      requester,
      search: 'norte',
      limit: 20,
      offset: 0,
    });
    expect(byDescription.data.map((recipe) => recipe.id)).toEqual([second.id]);
    const wildcard = await list.execute({
      machineId,
      requester,
      search: '%',
      limit: 20,
      offset: 0,
    });
    expect(wildcard.total).toBe(0);

    const update = app.get(UpdateRecipeUseCase);
    const edited = await update.execute({
      machineId,
      recipeId: first.id,
      requester,
      actorEmail: 'demo@ewcontrol.local',
      title: 'Programación A2',
      values,
      version: 1,
    });
    expect(edited).toMatchObject({ version: 2, updatedByEmail: 'demo@ewcontrol.local' });
    await expect(
      update.execute({
        machineId,
        recipeId: first.id,
        requester,
        actorEmail: 'otro@ewcontrol.local',
        title: 'Pisada',
        values,
        version: 1,
      }),
    ).rejects.toBeInstanceOf(RecipeModifiedError);

    const activate = app.get(ActivateRecipeUseCase);
    await activate.execute({ machineId, recipeId: first.id, requester, actorEmail: 'op' });
    await activate.execute({ machineId, recipeId: second.id, requester, actorEmail: 'op' });
    const [active] = await dataSource.query(
      'SELECT COUNT(*)::int AS total FROM recipes WHERE machine_id = $1 AND is_activated',
      [machineId],
    );
    expect(active.total).toBe(1);
    const ordered = await list.execute({ machineId, requester, limit: 20, offset: 0 });
    expect(ordered.data[0]).toMatchObject({ id: second.id, isActivated: true, isComplete: true });

    await app.get(ImportVariableCategoriesUseCase).execute({
      machineId,
      requester: { ...requester, role: UserRole.AdminCliente },
      rootNodeId: ROOT,
      csv: gvlCsv(['rEspiras', 'xSentido', 'rVelocidad']),
    });
    const incomplete = await app
      .get(GetRecipeUseCase)
      .execute({ machineId, recipeId: first.id, requester });
    expect(incomplete).toMatchObject({ isComplete: false, missingVariables: ['rVelocidad'] });
    await expect(
      activate.execute({ machineId, recipeId: first.id, requester, actorEmail: 'op' }),
    ).rejects.toBeInstanceOf(RecipeIncompleteError);
  });
});
